import { prisma } from "@goyal/db";
import { apiResponse, apiError, withApiRoute } from "@/lib/api";

/**
 * Integration: resolve canonical lead identity + ALL CP×project associations
 * for Reception/Booking (same phone / email / public Lead ID).
 *
 * Auth: Bearer INTEGRATION_WEBHOOK_SECRET or X-Integration-Secret.
 */
export const GET = withApiRoute("integration.leads.by-identity", async (req: Request) => {
  const secret = process.env.INTEGRATION_WEBHOOK_SECRET?.trim();
  if (!secret) return apiError("INTEGRATION_WEBHOOK_SECRET is not configured", 500);

  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-integration-secret") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer !== secret && headerSecret !== secret) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId")?.trim();
  const phone = searchParams.get("phone")?.replace(/\D/g, "").slice(-10);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!leadId && !phone && !email) {
    return apiError("Provide leadId, phone, or email", 400);
  }

  const contactOr = [
    ...(leadId
      ? [
          { leadId: { equals: leadId, mode: "insensitive" as const } },
          { id: leadId },
        ]
      : []),
    ...(phone
      ? [
          { customerMobile: phone },
          { customerMobile: { endsWith: phone } },
        ]
      : []),
    ...(email
      ? [{ customerEmail: { equals: email, mode: "insensitive" as const } }]
      : []),
  ];

  const leadInclude = {
    project: { select: { id: true, name: true, eoiStatus: true } },
    cp: {
      select: {
        id: true,
        companyName: true,
        user: { select: { name: true, email: true } },
      },
    },
  } as const;

  // 1) Direct lead match (covers orphan rows not linked to LeadIdentity yet)
  const matchedLeads = await prisma.lead.findMany({
    where: {
      journeyStatus: { not: "REJECTED" },
      OR: contactOr,
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: leadInclude,
  });

  // 2) Identity match (canonical public Lead ID / primary phone / email)
  const identity = await prisma.leadIdentity.findFirst({
    where: {
      OR: [
        ...(leadId ? [{ leadId: { equals: leadId, mode: "insensitive" as const } }] : []),
        ...(phone ? [{ primaryPhone: phone }] : []),
        ...(email ? [{ primaryEmail: { equals: email, mode: "insensitive" as const } }] : []),
        {
          leads: {
            some: { OR: contactOr },
          },
        },
      ],
    },
    include: {
      leads: {
        where: { journeyStatus: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        include: leadInclude,
      },
    },
  });

  // 3) If we found an identity, also pull every lead on that identity
  //    (even when phone formatting differs on older rows)
  const identityLeads = identity?.leads ?? [];

  // 4) If phone/email known, expand via identity primary contact for siblings
  let siblingLeads: typeof matchedLeads = [];
  if (identity?.id) {
    siblingLeads = await prisma.lead.findMany({
      where: {
        identityId: identity.id,
        journeyStatus: { not: "REJECTED" },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: leadInclude,
    });
  } else if (phone || email) {
    // Cross-identity merge: any other identity with same phone/email
    const relatedIdentities = await prisma.leadIdentity.findMany({
      where: {
        OR: [
          ...(phone ? [{ primaryPhone: phone }] : []),
          ...(email
            ? [{ primaryEmail: { equals: email, mode: "insensitive" as const } }]
            : []),
        ],
      },
      select: { id: true },
      take: 10,
    });
    if (relatedIdentities.length) {
      siblingLeads = await prisma.lead.findMany({
        where: {
          identityId: { in: relatedIdentities.map((i) => i.id) },
          journeyStatus: { not: "REJECTED" },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
        include: leadInclude,
      });
    }
  }

  const byLeadRow = new Map<string, (typeof matchedLeads)[number]>();
  for (const lead of [...matchedLeads, ...identityLeads, ...siblingLeads]) {
    byLeadRow.set(lead.id, lead);
  }

  // 5) Expand by phones/emails found on matched rows (covers Lead-ID search → all projects)
  const expandPhones = new Set<string>();
  const expandEmails = new Set<string>();
  for (const lead of byLeadRow.values()) {
    const p = String(lead.customerMobile || "").replace(/\D/g, "").slice(-10);
    if (p.length >= 10) expandPhones.add(p);
    const e = String(lead.customerEmail || "").trim().toLowerCase();
    if (e.includes("@")) expandEmails.add(e);
  }
  if (phone) expandPhones.add(phone);
  if (email) expandEmails.add(email);

  if (expandPhones.size || expandEmails.size) {
    const expanded = await prisma.lead.findMany({
      where: {
        journeyStatus: { not: "REJECTED" },
        OR: [
          ...[...expandPhones].flatMap((p) => [
            { customerMobile: p },
            { customerMobile: { endsWith: p } },
          ]),
          ...[...expandEmails].map((e) => ({
            customerEmail: { equals: e, mode: "insensitive" as const },
          })),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: leadInclude,
    });
    for (const lead of expanded) byLeadRow.set(lead.id, lead);
  }

  const leads = [...byLeadRow.values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  if (!leads.length) return apiError("Lead identity not found", 404);

  const latest = leads[0];
  const publicLeadId =
    identity?.leadId ||
    leads.find((l) => l.leadId)?.leadId ||
    latest.leadId ||
    latest.id;

  const partnersMap = new Map<
    string,
    {
      cpId: string;
      name: string;
      companyName: string | null;
      email: string | null;
      eoiCpLeadIds: string[];
      projects: { id: string; name: string; eoiStatus: string }[];
    }
  >();

  for (const lead of leads) {
    const entry = partnersMap.get(lead.cpId) || {
      cpId: lead.cpId,
      name: lead.cp.user.name || "Partner",
      companyName: lead.cp.companyName,
      email: lead.cp.user.email,
      eoiCpLeadIds: [] as string[],
      projects: [] as { id: string; name: string; eoiStatus: string }[],
    };
    if (!entry.eoiCpLeadIds.includes(lead.id)) entry.eoiCpLeadIds.push(lead.id);
    if (!entry.projects.some((p) => p.id === lead.projectId)) {
      entry.projects.push({
        id: lead.project.id,
        name: lead.project.name,
        eoiStatus: lead.project.eoiStatus,
      });
    }
    partnersMap.set(lead.cpId, entry);
  }

  return apiResponse({
    identityId: identity?.id || null,
    leadId: publicLeadId,
    primaryPhone: identity?.primaryPhone || latest.customerMobile || phone || null,
    primaryEmail: identity?.primaryEmail || latest.customerEmail || email || null,
    customerName: latest.customerName || null,
    partners: [...partnersMap.values()],
    associations: leads.map((lead) => ({
      eoiCpLeadId: lead.id,
      publicLeadId: lead.leadId || publicLeadId,
      cpId: lead.cpId,
      cpName: lead.cp.user.name,
      projectId: lead.projectId,
      projectName: lead.project.name,
      intentType: lead.intentType,
      journeyStatus: lead.journeyStatus,
      siteVisitStatus: lead.siteVisitStatus,
      createdAt: lead.createdAt,
    })),
  });
});
