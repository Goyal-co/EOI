import { prisma } from "@goyal/db";
import {
  daysRemainingUntil,
  phoneLockWindowMs,
  priorCpCooldownMs,
} from "@/lib/leads/phone";
import { findLeadIdentityByContact } from "@/lib/leads/identity";
import { getLeadLockPolicy, type LeadLockPolicy } from "@/lib/services/system-settings";

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
  /** Admin-configured policy (for UI copy). */
  leadLockEnabled: boolean;
  lockDays: number;
  cooldownDays: number;
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
 * Cross-CP identity lock + prior-CP cooldown (durations from Admin Settings).
 * Single DB round-trip — evaluates ownership in memory.
 */
export async function evaluateIdentityLock(params: {
  cpId: string;
  mobile: string;
  email: string;
  now?: Date;
  policy?: LeadLockPolicy;
}): Promise<IdentityLockEvaluation> {
  const now = params.now ?? new Date();
  const policy = params.policy ?? (await getLeadLockPolicy());
  if (!policy.enabled) {
    return { ok: true, lockStart: null, lockExpiresAt: null, owningCpIds: [] };
  }

  const emailLower = params.email.trim().toLowerCase();
  const lookbackStart = new Date(
    now.getTime() - phoneLockWindowMs(policy.lockDays) - priorCpCooldownMs(policy.cooldownDays),
  );

  const rows = await prisma.lead.findMany({
    where: {
      journeyStatus: { not: "REJECTED" },
      createdAt: { gte: lookbackStart },
      OR: [
        { customerMobile: params.mobile },
        { customerEmail: { equals: emailLower, mode: "insensitive" } },
      ],
    },
    select: {
      createdAt: true,
      cpId: true,
      customerMobile: true,
      customerEmail: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return evaluateIdentityLockFromRows(
    params.cpId,
    params.mobile,
    emailLower,
    rows,
    now,
    policy,
  );
}

export type PartnerLockStatus = "ACTIVE" | "EXPIRED" | "COOLDOWN" | "NONE";

export type PartnerLockState = {
  lockStatus: PartnerLockStatus;
  isActiveLockHolder: boolean;
  lockExpiresAt: string | null;
  lockDaysRemaining: number;
  cooldownExpiresAt: string | null;
  cooldownDaysRemaining: number;
  canActivate: boolean;
};

function partnerLockStateFromEval(
  cpId: string,
  lockEval: IdentityLockEvaluation,
  now: Date,
  historicalCreatedAt: Date | null,
  policy: LeadLockPolicy,
): PartnerLockState {
  if (!policy.enabled) {
    return {
      lockStatus: "NONE",
      isActiveLockHolder: false,
      lockExpiresAt: null,
      lockDaysRemaining: 0,
      cooldownExpiresAt: null,
      cooldownDaysRemaining: 0,
      canActivate: true,
    };
  }

  if (!lockEval.ok) {
    if (lockEval.code === "IDENTITY_LOCKED") {
      // Another CP holds the active lock — this CP's historical rows show expired (no timer)
      return {
        lockStatus: "EXPIRED",
        isActiveLockHolder: false,
        lockExpiresAt: null,
        lockDaysRemaining: 0,
        cooldownExpiresAt: null,
        cooldownDaysRemaining: 0,
        canActivate: false,
      };
    }
    // PRIOR_CP_COOLDOWN
    return {
      lockStatus: "COOLDOWN",
      isActiveLockHolder: false,
      lockExpiresAt: null,
      lockDaysRemaining: 0,
      cooldownExpiresAt: lockEval.cooldownExpiresAt?.toISOString() || null,
      cooldownDaysRemaining: lockEval.cooldownExpiresAt
        ? daysRemainingUntil(lockEval.cooldownExpiresAt, now)
        : 0,
      canActivate: false,
    };
  }

  const { lockExpiresAt, owningCpIds } = lockEval;
  const isHolder = owningCpIds.includes(cpId);

  if (lockExpiresAt && now < lockExpiresAt && isHolder) {
    return {
      lockStatus: "ACTIVE",
      isActiveLockHolder: true,
      lockExpiresAt: lockExpiresAt.toISOString(),
      lockDaysRemaining: daysRemainingUntil(lockExpiresAt, now),
      cooldownExpiresAt: null,
      cooldownDaysRemaining: 0,
      canActivate: false,
    };
  }

  if (lockExpiresAt && now < lockExpiresAt && !isHolder) {
    return {
      lockStatus: "EXPIRED",
      isActiveLockHolder: false,
      lockExpiresAt: null,
      lockDaysRemaining: 0,
      cooldownExpiresAt: null,
      cooldownDaysRemaining: 0,
      canActivate: false,
    };
  }

  // Lock window ended while still in evaluation payload — free to activate
  if (lockExpiresAt && now >= lockExpiresAt) {
    return {
      lockStatus: "EXPIRED",
      isActiveLockHolder: false,
      lockExpiresAt: null,
      lockDaysRemaining: 0,
      cooldownExpiresAt: null,
      cooldownDaysRemaining: 0,
      canActivate: true,
    };
  }

  // No active window — check whether this CP has historical associations.
  if (historicalCreatedAt) {
    const historicalLockEnd = new Date(
      historicalCreatedAt.getTime() + phoneLockWindowMs(policy.lockDays),
    );
    if (now >= historicalLockEnd) {
      return {
        lockStatus: "EXPIRED",
        isActiveLockHolder: false,
        lockExpiresAt: null,
        lockDaysRemaining: 0,
        cooldownExpiresAt: null,
        cooldownDaysRemaining: 0,
        canActivate: true,
      };
    }
  }

  return {
    lockStatus: "NONE",
    isActiveLockHolder: false,
    lockExpiresAt: null,
    lockDaysRemaining: 0,
    cooldownExpiresAt: null,
    cooldownDaysRemaining: 0,
    canActivate: false,
  };
}

type LockLeadRow = {
  createdAt: Date;
  cpId: string;
  customerMobile: string;
  customerEmail: string;
};

function matchesIdentity(
  row: LockLeadRow,
  mobile: string,
  emailLower: string,
): boolean {
  return (
    row.customerMobile === mobile
    || row.customerEmail.trim().toLowerCase() === emailLower
  );
}

/** In-memory equivalent of evaluateIdentityLock using a preloaded lead window. */
function evaluateIdentityLockFromRows(
  cpId: string,
  mobile: string,
  emailLower: string,
  rows: LockLeadRow[],
  now: Date,
  policy: LeadLockPolicy,
): IdentityLockEvaluation {
  if (!policy.enabled) {
    return { ok: true, lockStart: null, lockExpiresAt: null, owningCpIds: [] };
  }

  const lockMs = phoneLockWindowMs(policy.lockDays);
  const cooldownMs = priorCpCooldownMs(policy.cooldownDays);
  const activeWindowStart = new Date(now.getTime() - lockMs);
  const lockLabel = `${policy.lockDays}-day`;

  const inActiveWindow = rows
    .filter((r) => matchesIdentity(r, mobile, emailLower) && r.createdAt >= activeWindowStart)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const firstInWindow = inActiveWindow[0];
  if (firstInWindow) {
    const lockExpiresAt = new Date(firstInWindow.createdAt.getTime() + lockMs);
    const owningCpIds = [
      ...new Set(
        rows
          .filter(
            (r) =>
              matchesIdentity(r, mobile, emailLower)
              && r.createdAt >= firstInWindow.createdAt
              && r.createdAt <= lockExpiresAt,
          )
          .map((r) => r.cpId),
      ),
    ];

    if (now < lockExpiresAt && !owningCpIds.includes(cpId)) {
      const daysLeft = daysRemainingUntil(lockExpiresAt, now);
      return {
        ok: false,
        code: "IDENTITY_LOCKED",
        message: `Another CP already registered this phone number or email. Both stay locked for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}.`,
        lockExpiresAt,
      };
    }

    if (now >= lockExpiresAt && owningCpIds.includes(cpId)) {
      const cooldownExpiresAt = new Date(lockExpiresAt.getTime() + cooldownMs);
      if (now < cooldownExpiresAt) {
        const daysLeft = daysRemainingUntil(cooldownExpiresAt, now);
        return {
          ok: false,
          code: "PRIOR_CP_COOLDOWN",
          message: `Your ${lockLabel} protection on this lead has ended. You cannot re-punch it for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}.`,
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

  const cooldownLookbackStart = new Date(now.getTime() - lockMs - cooldownMs);
  const priorCycle = rows
    .filter(
      (r) =>
        matchesIdentity(r, mobile, emailLower)
        && r.createdAt >= cooldownLookbackStart
        && r.createdAt < activeWindowStart,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const lastLockLead = priorCycle[0];
  if (lastLockLead) {
    const lockExpiresAt = new Date(lastLockLead.createdAt.getTime() + lockMs);
    const cooldownExpiresAt = new Date(lockExpiresAt.getTime() + cooldownMs);
    if (now < cooldownExpiresAt) {
      const owners = [
        ...new Set(
          rows
            .filter(
              (r) =>
                matchesIdentity(r, mobile, emailLower)
                && r.createdAt >= lastLockLead.createdAt
                && r.createdAt <= lockExpiresAt,
            )
            .map((r) => r.cpId),
        ),
      ];
      if (owners.includes(cpId)) {
        const daysLeft = daysRemainingUntil(cooldownExpiresAt, now);
        return {
          ok: false,
          code: "PRIOR_CP_COOLDOWN",
          message: `Your ${lockLabel} protection on this lead has ended. You cannot re-punch it for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}.`,
          lockExpiresAt,
          cooldownExpiresAt,
        };
      }
    }
  }

  return { ok: true, lockStart: null, lockExpiresAt: null, owningCpIds: [] };
}

/**
 * Lock presentation for a CP viewing their own lead rows.
 * Timer only when this CP holds an active identity lock.
 */
export async function resolvePartnerLockState(params: {
  cpId: string;
  mobile: string;
  email: string;
  now?: Date;
}): Promise<PartnerLockState> {
  const now = params.now ?? new Date();
  const mobile = params.mobile;
  const emailLower = params.email.trim().toLowerCase();
  const policy = await getLeadLockPolicy();
  const [lockEval, historical] = await Promise.all([
    evaluateIdentityLock({
      cpId: params.cpId,
      mobile,
      email: emailLower,
      now,
      policy,
    }),
    prisma.lead.findFirst({
      where: {
        cpId: params.cpId,
        journeyStatus: { not: "REJECTED" },
        OR: [
          { customerMobile: mobile },
          { customerEmail: { equals: emailLower, mode: "insensitive" } },
        ],
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return partnerLockStateFromEval(
    params.cpId,
    lockEval,
    now,
    historical?.createdAt ?? null,
    policy,
  );
}

/**
 * One DB round-trip for lock state across many identities on a leads page.
 * Key format: `${normalizeMobile(mobile)}|${emailLower}`.
 */
export async function batchResolvePartnerLockStates(params: {
  cpId: string;
  identities: Array<{ mobile: string; email: string }>;
  now?: Date;
}): Promise<Map<string, PartnerLockState>> {
  const now = params.now ?? new Date();
  const result = new Map<string, PartnerLockState>();
  if (!params.identities.length) return result;

  const unique = new Map<string, { mobile: string; email: string }>();
  for (const id of params.identities) {
    const mobile = id.mobile;
    const email = id.email.trim().toLowerCase();
    unique.set(`${mobile}|${email}`, { mobile, email });
  }

  const mobiles = [...new Set([...unique.values()].map((i) => i.mobile).filter(Boolean))];
  const emails = [...new Set([...unique.values()].map((i) => i.email).filter(Boolean))];
  const policy = await getLeadLockPolicy();
  const lookbackStart = new Date(
    now.getTime() - phoneLockWindowMs(policy.lockDays) - priorCpCooldownMs(policy.cooldownDays),
  );

  const [windowRows, cpHistorical] = await Promise.all([
    mobiles.length || emails.length
      ? prisma.lead.findMany({
          where: {
            journeyStatus: { not: "REJECTED" },
            createdAt: { gte: lookbackStart },
            OR: [
              ...(mobiles.length ? [{ customerMobile: { in: mobiles } }] : []),
              ...(emails.length
                ? emails.map((e) => ({
                    customerEmail: { equals: e, mode: "insensitive" as const },
                  }))
                : []),
            ],
          },
          select: {
            createdAt: true,
            cpId: true,
            customerMobile: true,
            customerEmail: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([] as LockLeadRow[]),
    prisma.lead.findMany({
      where: {
        cpId: params.cpId,
        journeyStatus: { not: "REJECTED" },
        OR: [
          ...(mobiles.length ? [{ customerMobile: { in: mobiles } }] : []),
          ...(emails.length
            ? emails.map((e) => ({
                customerEmail: { equals: e, mode: "insensitive" as const },
              }))
            : []),
        ],
      },
      select: {
        createdAt: true,
        customerMobile: true,
        customerEmail: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  for (const [key, identity] of unique) {
    const lockEval = evaluateIdentityLockFromRows(
      params.cpId,
      identity.mobile,
      identity.email,
      windowRows,
      now,
      policy,
    );
    const historical = cpHistorical.find(
      (r) =>
        r.customerMobile === identity.mobile
        || r.customerEmail.trim().toLowerCase() === identity.email,
    );
    result.set(
      key,
      partnerLockStateFromEval(
        params.cpId,
        lockEval,
        now,
        historical?.createdAt ?? null,
        policy,
      ),
    );
  }

  return result;
}

/**
 * Projects this CP can still punch for the same customer identity,
 * plus the admin-configured phone+email protection window and prior-CP cooldown.
 */
export async function getIdentityPunchContext(
  cpId: string,
  mobile: string,
  email: string,
): Promise<IdentityPunchContext> {
  const now = new Date();
  const emailLower = email.trim().toLowerCase();
  const policy = await getLeadLockPolicy();

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
    evaluateIdentityLock({ cpId, mobile, email: emailLower, now, policy }),
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

  if (!policy.enabled) {
    return {
      identityId: identity?.id || cpIdentityLeads[0]?.identityId || null,
      existingLeadId: cpIdentityLeads[0]?.id || null,
      publicLeadId: identity?.leadId || cpIdentityLeads[0]?.leadId || null,
      availableProjects,
      mappedProjects: [...mappedById.values()],
      lockExpiresAt: now.toISOString(),
      lockDaysRemaining: 0,
      cooldownExpiresAt: null,
      cooldownDaysRemaining: 0,
      isRemap: cpIdentityLeads.length > 0,
      leadLockEnabled: false,
      lockDays: policy.lockDays,
      cooldownDays: policy.cooldownDays,
    };
  }

  const lockExpiresAt =
    lockEval.ok
      ? (lockEval.lockExpiresAt || new Date(now.getTime() + phoneLockWindowMs(policy.lockDays)))
      : lockEval.lockExpiresAt;

  const cooldownExpiresAt =
    !lockEval.ok && lockEval.code === "PRIOR_CP_COOLDOWN"
      ? (lockEval.cooldownExpiresAt || null)
      : lockEval.ok && lockEval.lockExpiresAt
        ? new Date(lockEval.lockExpiresAt.getTime() + priorCpCooldownMs(policy.cooldownDays))
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
    leadLockEnabled: true,
    lockDays: policy.lockDays,
    cooldownDays: policy.cooldownDays,
  };
}
