import { prisma } from "@goyal/db";
import { apiResponse, apiError } from "@/lib/api";

/**
 * Integration: resolve canonical lead identity + associated CPs for Reception/Booking.
 * Auth: Bearer INTEGRATION_WEBHOOK_SECRET or X-Integration-Secret.
 */
export async function GET(req: Request) {
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

  const identity = await prisma.leadIdentity.findFirst({
    where: {
      OR: [
        ...(leadId ? [{ leadId: { equals: leadId, mode: "insensitive" as const } }] : []),
        ...(phone ? [{ primaryPhone: phone }] : []),
        ...(email ? [{ primaryEmail: { equals: email, mode: "insensitive" as const } }] : []),
        {
          leads: {
            some: {
              OR: [
                ...(leadId ? [{ leadId: { equals: leadId, mode: "insensitive" as const } }] : []),
                ...(phone ? [{ customerMobile: phone }] : []),
                ...(email
                  ? [{ customerEmail: { equals: email, mode: "insensitive" as const } }]
                  : []),
              ],
            },
          },
        },
      ],
    },
    include: {
      leads: {
        where: { journeyStatus: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true, eoiStatus: true } },
          cp: {
            select: {
              id: true,
              companyName: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!identity) return apiError("Lead identity not found", 404);

  const latest = identity.leads[0];
  const partnersMap = new Map<string, {
    cpId: string;
    name: string;
    companyName: string | null;
    email: string | null;
    eoiCpLeadIds: string[];
    projects: { id: string; name: string; eoiStatus: string }[];
  }>();

  for (const lead of identity.leads) {
    const entry = partnersMap.get(lead.cpId) || {
      cpId: lead.cpId,
      name: lead.cp.user.name || "Partner",
      companyName: lead.cp.companyName,
      email: lead.cp.user.email,
      eoiCpLeadIds: [] as string[],
      projects: [] as { id: string; name: string; eoiStatus: string }[],
    };
    entry.eoiCpLeadIds.push(lead.id);
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
    identityId: identity.id,
    leadId: identity.leadId,
    primaryPhone: identity.primaryPhone,
    primaryEmail: identity.primaryEmail,
    customerName: latest?.customerName || null,
    partners: [...partnersMap.values()],
    associations: identity.leads.map((lead) => ({
      eoiCpLeadId: lead.id,
      publicLeadId: lead.leadId,
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
}
