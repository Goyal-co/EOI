import type { Session } from "next-auth";
import { prisma } from "@goyal/db";

type PartnerSession = Session & {
  user: Session["user"] & {
    teamMemberId?: string;
    jobRole?: "SALES_EXECUTIVE" | "TEAM_LEADER" | null;
  };
};

export function isPartnerOwner(session: PartnerSession) {
  return session.user.role === "CHANNEL_PARTNER";
}

export function getPartnerScope(session: PartnerSession) {
  return {
    cpId: session.user.cpId!,
    teamMemberId: session.user.teamMemberId ?? null,
    jobRole: session.user.jobRole ?? null,
    isOwner: session.user.role === "CHANNEL_PARTNER",
    isTeamLeader: session.user.jobRole === "TEAM_LEADER",
  };
}

/** Resolve lead visibility: owner = all; TL = self + reports; SE = self. */
export async function resolveTeamMemberScopeIds(session: PartnerSession): Promise<string[] | null> {
  const scope = getPartnerScope(session);
  if (scope.isOwner || !scope.teamMemberId) return null;
  if (scope.jobRole === "TEAM_LEADER") {
    const reports = await prisma.cPTeamMember.findMany({
      where: { cpId: scope.cpId, teamLeaderId: scope.teamMemberId, status: "ACTIVE" },
      select: { id: true },
    });
    return [scope.teamMemberId, ...reports.map((r) => r.id)];
  }
  return [scope.teamMemberId];
}

export function leadScopeWhere(session: PartnerSession) {
  const { teamMemberId, jobRole } = getPartnerScope(session);
  if (!teamMemberId) return {};
  // Synchronous fallback for SE; TL callers should use leadScopeWhereAsync when possible.
  if (jobRole === "TEAM_LEADER") {
    return { OR: [{ teamMemberId }, { teamMember: { teamLeaderId: teamMemberId } }] };
  }
  return { teamMemberId };
}

export async function leadScopeWhereAsync(session: PartnerSession) {
  const ids = await resolveTeamMemberScopeIds(session);
  if (!ids) return {};
  return { teamMemberId: { in: ids } };
}

export function eoiScopeWhere(session: PartnerSession) {
  const { teamMemberId, jobRole } = getPartnerScope(session);
  if (!teamMemberId) return {};
  if (jobRole === "TEAM_LEADER") {
    return {
      lead: {
        OR: [{ teamMemberId }, { teamMember: { teamLeaderId: teamMemberId } }],
      },
    };
  }
  return { lead: { teamMemberId } };
}

export function leadBelongsToSession(
  session: PartnerSession,
  lead: { teamMemberId: string | null },
) {
  const { teamMemberId, jobRole } = getPartnerScope(session);
  if (!teamMemberId) return true;
  if (lead.teamMemberId === teamMemberId) return true;
  // TL membership of reports is verified asynchronously in routes when needed;
  // optimistic allow when jobRole is TL (route still scopes queries).
  return jobRole === "TEAM_LEADER";
}
