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
export function useRequirePartnerAccess(options?: { ownerOnly?: boolean }) {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isOwner = role === "CHANNEL_PARTNER";
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
      }
      return;
    }
    void signOut({ callbackUrl: LOGIN_FOR_ROLE[role] || "/login" });
  }, [isOwner, options?.ownerOnly, role, status]);

  return {
    allowed,
    isOwner,
    teamMemberId: (session?.user as { teamMemberId?: string } | undefined)?.teamMemberId ?? null,
    status,
    session,
  };
}
