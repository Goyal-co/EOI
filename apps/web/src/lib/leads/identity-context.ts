import { prisma } from "@goyal/db";
import { daysRemainingUntil, phoneLockWindowMs } from "@/lib/leads/phone";

export type AvailablePunchProject = {
  id: string;
  name: string;
  location: string;
  eoiStatus: string;
  action: "EOI" | "LEAD_ONLY";
};

export type MappedPunchProject = {
  id: string;
  name: string;
  eoiStatus: string;
  action: "EOI" | "LEAD_ONLY";
};

export type IdentityPunchContext = {
  existingLeadId: string | null;
  publicLeadId: string | null;
  availableProjects: AvailablePunchProject[];
  mappedProjects: MappedPunchProject[];
  lockExpiresAt: string;
  lockDaysRemaining: number;
};

/**
 * Projects this CP can still punch for the same customer identity,
 * plus the 15-day phone+email protection window.
 */
export async function getIdentityPunchContext(
  cpId: string,
  mobile: string,
  email: string,
): Promise<IdentityPunchContext> {
  const now = new Date();
  const emailLower = email.trim().toLowerCase();

  const [projectAccess, cpIdentityLeads, firstRegistration, existingOnAnyProject] =
    await Promise.all([
      prisma.cPProjectAccess.findMany({
        where: { cpId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              location: true,
              eoiStatus: true,
              status: true,
            },
          },
        },
      }),
      prisma.lead.findMany({
        where: {
          cpId,
          journeyStatus: { not: "REJECTED" },
          OR: [
            { customerMobile: mobile },
            { customerEmail: { equals: emailLower, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          projectId: true,
          leadId: true,
          createdAt: true,
          project: { select: { id: true, name: true, eoiStatus: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.lead.findFirst({
        where: {
          journeyStatus: { not: "REJECTED" },
          createdAt: { gte: new Date(now.getTime() - phoneLockWindowMs()) },
          OR: [
            { customerMobile: mobile },
            { customerEmail: { equals: emailLower, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.lead.findFirst({
        where: {
          cpId,
          journeyStatus: { not: "REJECTED" },
          OR: [
            { customerMobile: mobile },
            { customerEmail: { equals: emailLower, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, leadId: true },
      }),
    ]);

  const existingProjectIds = new Set(cpIdentityLeads.map((l) => l.projectId));
  const punchableProjects = projectAccess
    .map((access) => access.project)
    .filter((project) => project.status === "ACTIVE" || project.status === "UPCOMING");

  const availableProjects = punchableProjects
    .filter((project) => !existingProjectIds.has(project.id))
    .map((project) => ({
      id: project.id,
      name: project.name,
      location: project.location,
      eoiStatus: project.eoiStatus,
      action: (project.eoiStatus === "OPEN" ? "EOI" : "LEAD_ONLY") as "EOI" | "LEAD_ONLY",
    }));

  const mappedById = new Map<string, MappedPunchProject>();
  for (const lead of cpIdentityLeads) {
    if (!lead.project || mappedById.has(lead.project.id)) continue;
    mappedById.set(lead.project.id, {
      id: lead.project.id,
      name: lead.project.name,
      eoiStatus: lead.project.eoiStatus,
      action: lead.project.eoiStatus === "OPEN" ? "EOI" : "LEAD_ONLY",
    });
  }

  const lockStart =
    firstRegistration?.createdAt
    || cpIdentityLeads[0]?.createdAt
    || now;
  const lockExpiresAt = new Date(lockStart.getTime() + phoneLockWindowMs());

  return {
    existingLeadId: existingOnAnyProject?.id || null,
    publicLeadId: existingOnAnyProject?.leadId || null,
    availableProjects,
    mappedProjects: [...mappedById.values()],
    lockExpiresAt: lockExpiresAt.toISOString(),
    lockDaysRemaining:
      lockExpiresAt > now ? daysRemainingUntil(lockExpiresAt, now) : 0,
  };
}
