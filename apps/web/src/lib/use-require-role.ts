"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import type { UserRole } from "@goyal/types";

const LOGIN_FOR_ROLE: Record<UserRole, string> = {
  ADMIN: "/login",
  CHANNEL_PARTNER: "/partner/login",
  CUSTOMER: "/customer/login",
};

/** Kick a signed-in user out of a portal that does not match their role. */
export function useRequireRole(role: UserRole) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    const actual = session?.user?.role;
    if (!actual || actual === role) return;
    void signOut({ callbackUrl: LOGIN_FOR_ROLE[actual] || "/login" });
  }, [role, session?.user?.role, status]);
}
