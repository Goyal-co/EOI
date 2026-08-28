import type { Session } from "next-auth";

type PartnerSession = Session & {
  user: Session["user"] & { teamMemberId?: string };
};

export function isPartnerOwner(session: PartnerSession) {
  return session.user.role === "CHANNEL_PARTNER";
}

export function getPartnerScope(session: PartnerSession) {
  return {
    cpId: session.user.cpId!,
    teamMemberId: session.user.teamMemberId ?? null,
    isOwner: session.user.role === "CHANNEL_PARTNER",
  };
}

export function leadScopeWhere(session: PartnerSession) {
  const { teamMemberId } = getPartnerScope(session);
  return teamMemberId ? { teamMemberId } : {};
}

export function eoiScopeWhere(session: PartnerSession) {
  const { teamMemberId } = getPartnerScope(session);
  return teamMemberId ? { lead: { teamMemberId } } : {};
}

export function leadBelongsToSession(
  session: PartnerSession,
  lead: { teamMemberId: string | null },
) {
  const { teamMemberId } = getPartnerScope(session);
  return !teamMemberId || lead.teamMemberId === teamMemberId;
}
