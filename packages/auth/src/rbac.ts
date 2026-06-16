import type { UserRole } from "@goyal/types";

export const PORTAL_ROUTES: Record<UserRole, string> = {
  ADMIN: "/admin",
  CHANNEL_PARTNER: "/partner",
  CUSTOMER: "/customer",
};

export const ROLE_ROUTE_PREFIXES: Record<string, UserRole> = {
  "/admin": "ADMIN",
  "/partner": "CHANNEL_PARTNER",
  "/customer": "CUSTOMER",
};

export function getPortalForRole(role: UserRole): string {
  return PORTAL_ROUTES[role];
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const requiredRole = Object.entries(ROLE_ROUTE_PREFIXES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  if (!requiredRole) return true;
  return role === requiredRole;
}

export function isPublicRoute(pathname: string): boolean {
  const publicPaths = [
    "/",
    "/login",
    "/partner/login",
    "/partner/register",
    "/partner/forgot-password",
    "/customer/login",
    "/invite",
    "/confirm",
    "/api/auth",
    "/api/confirm",
    "/api/invites",
    "/api/health",
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
