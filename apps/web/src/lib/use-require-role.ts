"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import type { UserRole } from "@goyal/types";

const LOGIN_FOR_ROLE: Record<UserRole, string> = {
  ADMIN: "/login",
  CHANNEL_PARTNER: "/partner/login",
  CUSTOMER: "/customer/login",
};

/** Keep each dashboard on its own role. Unauthenticated users go to that portal's login. */
export function useRequireRole(role: UserRole) {
  const { data: session, status } = useSession();
  const actual = session?.user?.role;
  const allowed = status === "authenticated" && actual === role;

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      window.location.replace(LOGIN_FOR_ROLE[role]);
      return;
    }
    if (!actual || actual === role) return;
    void signOut({ callbackUrl: LOGIN_FOR_ROLE[actual] || "/login" });
  }, [actual, role, status]);

  return { allowed, status };
}
