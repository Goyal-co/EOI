import { auth } from "@goyal/auth/edge";
import { NextResponse } from "next/server";
import { canAccessRoute, isPublicRoute, getPortalForRole } from "@goyal/auth/rbac";
import type { UserRole } from "@goyal/types";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role as UserRole | undefined;

  if (pathname === "/") {
    if (isLoggedIn && role) {
      return NextResponse.redirect(new URL(getPortalForRole(role), req.url));
    }
    return NextResponse.redirect(new URL("/customer/login", req.url));
  }

  if (isPublicRoute(pathname)) {
    if (isLoggedIn && (pathname === "/login" || pathname === "/partner/login" || pathname === "/customer/login")) {
      return NextResponse.redirect(new URL(getPortalForRole(role!), req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = pathname.startsWith("/partner") ? "/partner/login"
      : pathname.startsWith("/customer") ? "/customer/login"
      : "/login";
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  if (role && !canAccessRoute(role, pathname)) {
    return NextResponse.redirect(new URL(getPortalForRole(role), req.url));
  }

  const cpStatus = req.auth?.user?.cpStatus;
  if (
    role === "CHANNEL_PARTNER"
    && cpStatus
    && cpStatus !== "APPROVED"
    && pathname.startsWith("/partner")
    && !pathname.startsWith("/partner/login")
    && !pathname.startsWith("/partner/register")
    && !pathname.startsWith("/partner/pending-approval")
    && !pathname.startsWith("/partner/forgot-password")
  ) {
    const url = new URL("/partner/pending-approval", req.url);
    if (cpStatus === "BLOCKED") url.searchParams.set("status", "blocked");
    if (req.auth?.user?.email) url.searchParams.set("email", req.auth.user.email);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Exclude all Next.js internals so static assets are never intercepted by auth middleware
  matcher: ["/((?!_next/|favicon.ico|logo.svg|og-image.svg|images/|api/auth/).*)"],
};
