"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import type { UserRole } from "@goyal/types";

const LOGIN_FOR_ROLE: Record<UserRole, string> = {
  ADMIN: "/login",
  CHANNEL_PARTNER: "/partner/login",
  CP_TEAM_MEMBER: "/partner/login",
  CUSTOMER: "/customer/login",
};

const PARTNER_ROLES: UserRole[] = ["CHANNEL_PARTNER", "CP_TEAM_MEMBER"];

/** Partner portal access for CP owners and roster team members. */
export function useRequirePartnerAccess(options?: {
  ownerOnly?: boolean;
  /** Allow Team Leaders (and owners) on team pages. */
  teamPage?: boolean;
}) {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const jobRole = (session?.user as { jobRole?: string | null } | undefined)?.jobRole ?? null;
  const isOwner = role === "CHANNEL_PARTNER";
  const isTeamLeader = jobRole === "TEAM_LEADER";
  const allowed = status === "authenticated" && !!role && PARTNER_ROLES.includes(role);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      window.location.replace("/partner/login");
      return;
    }
    if (!role || PARTNER_ROLES.includes(role)) {
      if (options?.ownerOnly && role && !isOwner) {
        window.location.replace("/partner");
        return;
      }
      if (options?.teamPage && role && !isOwner && !isTeamLeader) {
        window.location.replace("/partner");
      }
      return;
    }
    void signOut({ callbackUrl: LOGIN_FOR_ROLE[role] || "/login" });
  }, [isOwner, isTeamLeader, options?.ownerOnly, options?.teamPage, role, status]);

  return {
    allowed,
    isOwner,
    isTeamLeader,
    teamMemberId: (session?.user as { teamMemberId?: string } | undefined)?.teamMemberId ?? null,
    jobRole,
    status,
    session,
  };
}
