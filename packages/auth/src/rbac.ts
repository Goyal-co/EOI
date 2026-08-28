import type { UserRole } from "@goyal/types";
import { getPortalHomeHrefForHost, portalKindForRole } from "./portals";

export const PORTAL_ROUTES: Record<UserRole, string> = {
  ADMIN: "/admin",
  CHANNEL_PARTNER: "/partner",
  CP_TEAM_MEMBER: "/partner",
  CUSTOMER: "/customer",
};

export const ROLE_ROUTE_PREFIXES: Record<string, UserRole[]> = {
  "/admin": ["ADMIN"],
  "/partner": ["CHANNEL_PARTNER", "CP_TEAM_MEMBER"],
  "/customer": ["CUSTOMER"],
};

/** Home for a role. Absolute only when the request host is a different portal subdomain. */
export function getPortalForRole(role: UserRole, hostHeader?: string | null): string {
  return getPortalHomeHrefForHost(portalKindForRole(role), hostHeader);
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const allowedRoles = Object.entries(ROLE_ROUTE_PREFIXES).find(([prefix]) =>
    pathname.startsWith(prefix),
  )?.[1];

  if (!allowedRoles) return true;
  return allowedRoles.includes(role);
}

/** Owner-only partner pages (team roster, company settings). */
export function isPartnerOwnerRoute(pathname: string): boolean {
  return pathname.startsWith("/partner/team") || pathname.startsWith("/partner/settings");
}

export function isPublicRoute(pathname: string): boolean {
  const publicPaths = [
    "/",
    "/login",
    "/partner/login",
    "/partner/register",
    "/partner/forgot-password",
    "/customer/login",
    "/customer/forgot-password",
    "/customer/reset-password",
    "/invite",
    "/confirm",
    "/api/auth",
    "/api/confirm",
    "/api/invites",
    "/health",
    "/api/health",
    "/api/webhooks",
    "/api/partner/register",
    "/api/partner/check-status",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/public/support-email",
    "/partner/reset-password",
    "/partner/pending-approval",
    "/auth/error",
  ];
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
