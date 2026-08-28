import { prisma } from "@goyal/db";
import { apiResponse, apiError, withApiRoute } from "@/lib/api";
import { normalizeMobile } from "@/lib/leads/phone";
import { findLeadIdentityByContact } from "@/lib/leads/identity";

/**
 * Booking Inventory / Reception → resolve EOI_CP lead identity by phone or public lead id.
 *
 * Auth: Bearer or X-Integration-Secret = INTEGRATION_WEBHOOK_SECRET
 */
export const GET = withApiRoute("integration.leads.by-identity", async (req: Request) => {
  const secret = process.env.INTEGRATION_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return apiError("INTEGRATION_WEBHOOK_SECRET is not configured", 500);
  }

  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-integration-secret") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer !== secret && headerSecret !== secret) {
    return apiError("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const phoneRaw = url.searchParams.get("phone") || "";
  const leadId = url.searchParams.get("leadId")?.trim() || "";
  const email = url.searchParams.get("email")?.trim() || "";
  const mobile = phoneRaw ? normalizeMobile(phoneRaw) : "";

  if (!mobile && !leadId && !email) {
    return apiError("phone, leadId, or email is required");
  }

  let identity = leadId
    ? await prisma.leadIdentity.findFirst({
        where: { leadId },
        include: {
          leads: {
            where: { journeyStatus: { not: "REJECTED" } },
            include: {
              project: { select: { id: true, name: true } },
              cp: { select: { id: true, companyName: true, user: { select: { name: true } } } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : null;

  if (!identity && (mobile || email)) {
    const found = await findLeadIdentityByContact(mobile || "0000000000", email || "");
    if (found) {
      identity = await prisma.leadIdentity.findUnique({
        where: { id: found.id },
        include: {
          leads: {
            where: { journeyStatus: { not: "REJECTED" } },
            include: {
              project: { select: { id: true, name: true } },
              cp: { select: { id: true, companyName: true, user: { select: { name: true } } } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }
  }

  if (!identity) {
    const orphanLeads = await prisma.lead.findMany({
      where: {
        journeyStatus: { not: "REJECTED" },
        ...(leadId ? { OR: [{ id: leadId }, { leadId }] } : {}),
        ...(mobile
          ? {
              OR: [{ customerMobile: mobile }, { customerMobile: { endsWith: mobile } }],
            }
          : {}),
        ...(email ? { customerEmail: { equals: email, mode: "insensitive" } } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        cp: { select: { id: true, companyName: true, user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (orphanLeads.length === 0) {
      return apiError("Lead identity not found", 404);
    }

    const first = orphanLeads[0];
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

    for (const lead of orphanLeads) {
      const cpId = lead.cpId;
      if (!cpId) continue;
      const existing = partnersMap.get(cpId) || {
        cpId,
        name: lead.cp.user?.name || lead.cp.companyName || cpId,
        companyName: lead.cp.companyName,
        email: null,
        eoiCpLeadIds: [],
        projects: [],
      };
      if (!existing.eoiCpLeadIds.includes(lead.id)) {
        existing.eoiCpLeadIds.push(lead.id);
      }
      if (!existing.projects.some((p) => p.id === lead.projectId)) {
        existing.projects.push({
          id: lead.projectId,
          name: lead.project.name,
          eoiStatus: lead.journeyStatus,
        });
      }
      partnersMap.set(cpId, existing);
    }

    return apiResponse({
      identityId: first.identityId || first.id,
      leadId: first.leadId || "",
      primaryPhone: mobile || normalizeMobile(first.customerMobile),
      primaryEmail: first.customerEmail || email || null,
      customerName: first.customerName,
      partners: [...partnersMap.values()],
      associations: orphanLeads.map((lead) => ({
        eoiCpLeadId: lead.id,
        publicLeadId: lead.leadId || "",
        cpId: lead.cpId,
        cpName: lead.cp.user?.name || lead.cp.companyName || null,
        projectId: lead.projectId,
        projectName: lead.project.name,
        intentType: lead.intentType,
        journeyStatus: lead.journeyStatus,
        siteVisitStatus: lead.siteVisitStatus,
        createdAt: lead.createdAt.toISOString(),
      })),
    });
  }

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

  for (const lead of identity.leads) {
    const cpId = lead.cpId;
    if (!cpId) continue;
    const existing = partnersMap.get(cpId) || {
      cpId,
      name: lead.cp.user?.name || lead.cp.companyName || cpId,
      companyName: lead.cp.companyName,
      email: null,
      eoiCpLeadIds: [],
      projects: [],
    };
    if (!existing.eoiCpLeadIds.includes(lead.id)) {
      existing.eoiCpLeadIds.push(lead.id);
    }
    if (!existing.projects.some((p) => p.id === lead.projectId)) {
      existing.projects.push({
        id: lead.projectId,
        name: lead.project.name,
        eoiStatus: lead.journeyStatus,
      });
    }
    partnersMap.set(cpId, existing);
  }

  const sampleLead = identity.leads[0];

  return apiResponse({
    identityId: identity.id,
    leadId: identity.leadId,
    primaryPhone: identity.primaryPhone || mobile || null,
    primaryEmail: identity.primaryEmail || email || null,
    customerName: sampleLead?.customerName || null,
    partners: [...partnersMap.values()],
    associations: identity.leads.map((lead) => ({
      eoiCpLeadId: lead.id,
      publicLeadId: lead.leadId || identity.leadId,
      cpId: lead.cpId,
      cpName: lead.cp.user?.name || lead.cp.companyName || null,
      projectId: lead.projectId,
      projectName: lead.project.name,
      intentType: lead.intentType,
      journeyStatus: lead.journeyStatus,
      siteVisitStatus: lead.siteVisitStatus,
      createdAt: lead.createdAt.toISOString(),
    })),
  });
});
