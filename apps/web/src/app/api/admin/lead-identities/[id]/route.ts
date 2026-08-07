import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { daysRemainingUntil, phoneLockWindowMs, priorCpCooldownMs } from "@/lib/leads/phone";

/** Full identity drawer: associations + timeline + lock state. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const identity = await prisma.leadIdentity.findFirst({
    where: {
      OR: [{ id }, { leadId: id }],
    },
    include: {
      leads: {
        orderBy: { createdAt: "asc" },
        include: {
          project: { select: { id: true, name: true, eoiStatus: true, location: true } },
          cp: {
            select: {
              id: true,
              companyName: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          eoi: { select: { id: true, status: true, referenceNumber: true } },
        },
      },
      events: {
        orderBy: { occurredAt: "desc" },
        take: 100,
        include: {
          cp: {
            select: {
              id: true,
              companyName: true,
              user: { select: { name: true } },
            },
          },
          project: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!identity) return apiError("Lead identity not found", 404);

  const now = new Date();
  const firstInWindow = identity.leads
    .filter((l) => l.journeyStatus !== "REJECTED")
    .filter((l) => l.createdAt.getTime() >= now.getTime() - phoneLockWindowMs())
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  const lockStart = firstInWindow?.createdAt || null;
  const lockExpiresAt = lockStart
    ? new Date(lockStart.getTime() + phoneLockWindowMs())
    : null;
  const cooldownExpiresAt = lockExpiresAt
    ? new Date(lockExpiresAt.getTime() + priorCpCooldownMs())
    : null;

  const partners = new Map<string, {
    cpId: string;
    name: string;
    companyName: string | null;
    projects: string[];
    firstPunchedAt: string;
    lastPunchedAt: string;
  }>();

  for (const lead of identity.leads) {
    const existing = partners.get(lead.cpId);
    const projectName = lead.project.name;
    if (!existing) {
      partners.set(lead.cpId, {
        cpId: lead.cpId,
        name: lead.cp.user.name || "Partner",
        companyName: lead.cp.companyName,
        projects: [projectName],
        firstPunchedAt: lead.createdAt.toISOString(),
        lastPunchedAt: lead.createdAt.toISOString(),
      });
    } else {
      if (!existing.projects.includes(projectName)) existing.projects.push(projectName);
      if (lead.createdAt < new Date(existing.firstPunchedAt)) {
        existing.firstPunchedAt = lead.createdAt.toISOString();
      }
      if (lead.createdAt > new Date(existing.lastPunchedAt)) {
        existing.lastPunchedAt = lead.createdAt.toISOString();
      }
    }
  }

  const latestLead = [...identity.leads].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];

  return apiResponse({
    id: identity.id,
    leadId: identity.leadId,
    primaryPhone: identity.primaryPhone,
    primaryEmail: identity.primaryEmail,
    customerName: latestLead?.customerName || null,
    createdAt: identity.createdAt,
    lock: {
      active: !!(lockExpiresAt && lockExpiresAt > now),
      lockExpiresAt: lockExpiresAt?.toISOString() || null,
      lockDaysRemaining:
        lockExpiresAt && lockExpiresAt > now ? daysRemainingUntil(lockExpiresAt, now) : 0,
      cooldownExpiresAt: cooldownExpiresAt?.toISOString() || null,
      cooldownDaysRemaining:
        cooldownExpiresAt && cooldownExpiresAt > now
          ? daysRemainingUntil(cooldownExpiresAt, now)
          : 0,
    },
    partners: [...partners.values()],
    associations: identity.leads.map((lead) => ({
      id: lead.id,
      projectId: lead.projectId,
      projectName: lead.project.name,
      projectEoiStatus: lead.project.eoiStatus,
      cpId: lead.cpId,
      cpName: lead.cp.user.name,
      companyName: lead.cp.companyName,
      intentType: lead.intentType,
      journeyStatus: lead.journeyStatus,
      leadStatus: lead.leadStatus,
      siteVisitStatus: lead.siteVisitStatus,
      siteVisitDate: lead.siteVisitDate,
      confirmationStatus: lead.confirmationStatus,
      eoiStatus: lead.eoi?.status || null,
      eoiReference: lead.eoi?.referenceNumber || null,
      createdAt: lead.createdAt,
    })),
    timeline: identity.events.map((event) => {
      const meta =
        event.metadata && typeof event.metadata === "object"
          ? (event.metadata as Record<string, unknown>)
          : {};
      const salesperson =
        typeof meta.salesperson === "string" && meta.salesperson.trim()
          ? meta.salesperson.trim()
          : null;
      const cpName = event.cp?.user.name || null;
      const companyName = event.cp?.companyName || null;
      const projectName = event.project?.name || null;
      const summaryParts = [
        event.type.replace(/_/g, " "),
        cpName ? `CP: ${cpName}` : null,
        projectName ? `Project: ${projectName}` : null,
        salesperson ? `Sales: ${salesperson}` : null,
      ].filter(Boolean);

      return {
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt,
        actorType: event.actorType,
        cpId: event.cpId,
        cpName,
        companyName,
        projectId: event.projectId,
        projectName,
        leadAssociationId: event.leadId,
        salesperson,
        summary: summaryParts.join(" · "),
        metadata: event.metadata,
      };
    }),
  });
}
