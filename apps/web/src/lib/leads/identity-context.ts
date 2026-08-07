import { prisma } from "@goyal/db";
import {
  daysRemainingUntil,
  phoneLockWindowMs,
  priorCpCooldownMs,
} from "@/lib/leads/phone";
import { findLeadIdentityByContact } from "@/lib/leads/identity";

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
  identityId: string | null;
  existingLeadId: string | null;
  publicLeadId: string | null;
  availableProjects: AvailablePunchProject[];
  mappedProjects: MappedPunchProject[];
  lockExpiresAt: string;
  lockDaysRemaining: number;
  cooldownExpiresAt: string | null;
  cooldownDaysRemaining: number;
  isRemap: boolean;
};

export type IdentityLockEvaluation =
  | { ok: true; lockStart: Date | null; lockExpiresAt: Date | null; owningCpIds: string[] }
  | {
      ok: false;
      code: "IDENTITY_LOCKED" | "PRIOR_CP_COOLDOWN";
      message: string;
      lockExpiresAt: Date;
      cooldownExpiresAt?: Date;
    };

/**
 * 15-day other-CP lock + 7-day prior-CP cooldown after lock ends.
 */
export async function evaluateIdentityLock(params: {
  cpId: string;
  mobile: string;
  email: string;
  now?: Date;
}): Promise<IdentityLockEvaluation> {
  const now = params.now ?? new Date();
  const emailLower = params.email.trim().toLowerCase();

  const firstInWindow = await prisma.lead.findFirst({
    where: {
      journeyStatus: { not: "REJECTED" },
      createdAt: { gte: new Date(now.getTime() - phoneLockWindowMs()) },
      OR: [
        { customerMobile: params.mobile },
        { customerEmail: { equals: emailLower, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, cpId: true },
  });

  if (firstInWindow) {
    const lockExpiresAt = new Date(firstInWindow.createdAt.getTime() + phoneLockWindowMs());
    const owning = await prisma.lead.findMany({
      where: {
        journeyStatus: { not: "REJECTED" },
        createdAt: {
          gte: firstInWindow.createdAt,
          lte: lockExpiresAt,
        },
        OR: [
          { customerMobile: params.mobile },
          { customerEmail: { equals: emailLower, mode: "insensitive" } },
        ],
      },
      select: { cpId: true },
      distinct: ["cpId"],
    });
    const owningCpIds = owning.map((o) => o.cpId);

    if (now < lockExpiresAt && !owningCpIds.includes(params.cpId)) {
      const daysLeft = daysRemainingUntil(lockExpiresAt, now);
      return {
        ok: false,
        code: "IDENTITY_LOCKED",
        message: `Another CP already registered this phone number or email. Both stay locked for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}.`,
        lockExpiresAt,
      };
    }

    if (now >= lockExpiresAt && owningCpIds.includes(params.cpId)) {
      const cooldownExpiresAt = new Date(lockExpiresAt.getTime() + priorCpCooldownMs());
      if (now < cooldownExpiresAt) {
        const daysLeft = daysRemainingUntil(cooldownExpiresAt, now);
        return {
          ok: false,
          code: "PRIOR_CP_COOLDOWN",
          message: `Your 15-day protection on this lead has ended. You cannot re-punch it for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}.`,
          lockExpiresAt,
          cooldownExpiresAt,
        };
      }
    }

    return {
      ok: true,
      lockStart: firstInWindow.createdAt,
      lockExpiresAt,
      owningCpIds,
    };
  }

  // No active 15-day window — still block prior owners in cooldown from the most recent lock cycle.
  const lastLockLead = await prisma.lead.findFirst({
    where: {
      journeyStatus: { not: "REJECTED" },
      createdAt: {
        gte: new Date(now.getTime() - phoneLockWindowMs() - priorCpCooldownMs()),
        lt: new Date(now.getTime() - phoneLockWindowMs()),
      },
      OR: [
        { customerMobile: params.mobile },
        { customerEmail: { equals: emailLower, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, cpId: true },
  });

  if (lastLockLead) {
    const lockExpiresAt = new Date(lastLockLead.createdAt.getTime() + phoneLockWindowMs());
    const cooldownExpiresAt = new Date(lockExpiresAt.getTime() + priorCpCooldownMs());
    if (now < cooldownExpiresAt) {
      const owners = await prisma.lead.findMany({
        where: {
          journeyStatus: { not: "REJECTED" },
          createdAt: { gte: lastLockLead.createdAt, lte: lockExpiresAt },
          OR: [
            { customerMobile: params.mobile },
            { customerEmail: { equals: emailLower, mode: "insensitive" } },
          ],
        },
        select: { cpId: true },
        distinct: ["cpId"],
      });
      if (owners.some((o) => o.cpId === params.cpId)) {
        const daysLeft = daysRemainingUntil(cooldownExpiresAt, now);
        return {
          ok: false,
          code: "PRIOR_CP_COOLDOWN",
          message: `Your 15-day protection on this lead has ended. You cannot re-punch it for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}.`,
          lockExpiresAt,
          cooldownExpiresAt,
        };
      }
    }
  }

  return { ok: true, lockStart: null, lockExpiresAt: null, owningCpIds: [] };
}

/**
 * Projects this CP can still punch for the same customer identity,
 * plus the 15-day phone+email protection window and prior-CP cooldown.
 */
export async function getIdentityPunchContext(
  cpId: string,
  mobile: string,
  email: string,
): Promise<IdentityPunchContext> {
  const now = new Date();
  const emailLower = email.trim().toLowerCase();

  const [projectAccess, cpIdentityLeads, identity, lockEval] = await Promise.all([
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
        identityId: true,
        createdAt: true,
        project: { select: { id: true, name: true, eoiStatus: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    findLeadIdentityByContact(mobile, emailLower),
    evaluateIdentityLock({ cpId, mobile, email: emailLower, now }),
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

  const lockExpiresAt =
    lockEval.ok
      ? (lockEval.lockExpiresAt || new Date(now.getTime() + phoneLockWindowMs()))
      : lockEval.lockExpiresAt;

  const cooldownExpiresAt =
    !lockEval.ok && lockEval.code === "PRIOR_CP_COOLDOWN"
      ? (lockEval.cooldownExpiresAt || null)
      : lockEval.ok && lockEval.lockExpiresAt
        ? new Date(lockEval.lockExpiresAt.getTime() + priorCpCooldownMs())
        : null;

  return {
    identityId: identity?.id || cpIdentityLeads[0]?.identityId || null,
    existingLeadId: cpIdentityLeads[0]?.id || null,
    publicLeadId: identity?.leadId || cpIdentityLeads[0]?.leadId || null,
    availableProjects,
    mappedProjects: [...mappedById.values()],
    lockExpiresAt: lockExpiresAt.toISOString(),
    lockDaysRemaining: lockExpiresAt > now ? daysRemainingUntil(lockExpiresAt, now) : 0,
    cooldownExpiresAt: cooldownExpiresAt && cooldownExpiresAt > now
      ? cooldownExpiresAt.toISOString()
      : null,
    cooldownDaysRemaining:
      cooldownExpiresAt && cooldownExpiresAt > now
        ? daysRemainingUntil(cooldownExpiresAt, now)
        : 0,
    isRemap: cpIdentityLeads.length > 0,
  };
}
