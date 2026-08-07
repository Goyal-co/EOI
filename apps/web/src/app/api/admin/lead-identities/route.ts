import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { daysRemainingUntil, phoneLockWindowMs, priorCpCooldownMs } from "@/lib/leads/phone";

/** List canonical lead identities (one row per public Lead ID). */
export async function GET(req: Request) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const projectId = searchParams.get("projectId");
  const cpId = searchParams.get("cpId");

  const identities = await prisma.leadIdentity.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { leadId: { contains: q, mode: "insensitive" } },
              { primaryPhone: { contains: q } },
              { primaryEmail: { contains: q, mode: "insensitive" } },
              {
                leads: {
                  some: {
                    OR: [
                      { customerName: { contains: q, mode: "insensitive" } },
                      { customerMobile: { contains: q } },
                      { customerEmail: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(projectId || cpId
        ? {
            leads: {
              some: {
                ...(projectId ? { projectId } : {}),
                ...(cpId ? { cpId } : {}),
              },
            },
          }
        : {}),
    },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          customerName: true,
          customerMobile: true,
          customerEmail: true,
          journeyStatus: true,
          leadStatus: true,
          siteVisitStatus: true,
          intentType: true,
          project: { select: { name: true } },
          cp: { select: { user: { select: { name: true } }, companyName: true } },
        },
      },
      _count: { select: { leads: true, events: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return apiResponse(
    identities.map((identity) => {
      const latest = identity.leads[0];
      return {
        id: identity.id,
        leadId: identity.leadId,
        primaryPhone: identity.primaryPhone,
        primaryEmail: identity.primaryEmail,
        customerName: latest?.customerName || "—",
        associationCount: identity._count.leads,
        eventCount: identity._count.events,
        latestProject: latest?.project.name || null,
        latestCp: latest?.cp.user.name || latest?.cp.companyName || null,
        latestJourneyStatus: latest?.journeyStatus || null,
        latestSiteVisitStatus: latest?.siteVisitStatus || null,
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
      };
    }),
  );
}
