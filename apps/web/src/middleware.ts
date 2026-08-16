import { auth } from "@goyal/auth/edge";
import { NextResponse } from "next/server";
import { canAccessRoute, isPublicRoute, getPortalForRole } from "@goyal/auth/rbac";
import {
  getPortalLoginHrefForHost,
  portalHrefForHost,
  resolvePortalFromHost,
  rewritePathForPortal,
  type PortalKind,
} from "@goyal/auth/portals";
import type { UserRole } from "@goyal/types";

function loginForPath(pathname: string, portal: PortalKind | null, host: string): string {
  if (pathname.startsWith("/customer") || portal === "customer") {
    return getPortalLoginHrefForHost("customer", host);
  }
  if (pathname.startsWith("/admin") || pathname === "/login" || portal === "admin") {
    return getPortalLoginHrefForHost("admin", host);
  }
  return getPortalLoginHrefForHost("partner", host);
}

function toUrl(target: string, reqUrl: string) {
  return new URL(target, reqUrl);
}

export default auth((req) => {
  const { pathname: rawPath, search } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role as UserRole | undefined;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.hostname;
  const portal = resolvePortalFromHost(host);
  const pathname = portal ? rewritePathForPortal(rawPath, portal) : rawPath;

  const finish = (res: NextResponse) => {
    const redirected = Boolean(res.headers.get("location"));
    if (portal && pathname !== rawPath && !redirected && res.status < 400) {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = pathname;
      return NextResponse.rewrite(rewriteUrl);
    }
    return res;
  };

  if (rawPath === "/" || pathname === "/") {
    if (isLoggedIn && role) {
      return NextResponse.redirect(toUrl(getPortalForRole(role, host), req.url));
    }
    return NextResponse.redirect(toUrl(loginForPath("/partner", portal, host), req.url));
  }

  if (isPublicRoute(pathname)) {
    if (isLoggedIn && (
      pathname === "/login"
      || pathname === "/partner/login"
      || pathname === "/customer/login"
    )) {
      return NextResponse.redirect(toUrl(getPortalForRole(role!, host), req.url));
    }
    return finish(NextResponse.next());
  }

  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const dest = toUrl(loginForPath(pathname, portal, host), req.url);
    if (search) dest.search = search;
    return NextResponse.redirect(dest);
  }

  if (role && !canAccessRoute(role, pathname)) {
    return NextResponse.redirect(toUrl(getPortalForRole(role, host), req.url));
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
    const url = toUrl(
      portalHrefForHost("partner", "/partner/pending-approval", host),
      req.url,
    );
    if (cpStatus === "BLOCKED") url.searchParams.set("status", "blocked");
    if (req.auth?.user?.email) url.searchParams.set("email", req.auth.user.email);
    return NextResponse.redirect(url);
  }

  return finish(NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|images/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|webmanifest)$).*)",
  ],
};
