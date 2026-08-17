export type PortalKind = "partner" | "customer" | "admin";

const PORTAL_DNS_LABEL: Record<PortalKind, string> = {
  partner: "leads",
  customer: "customer",
  admin: "admin",
};

function trimOrigin(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return null;
  }
}

function hostnameOf(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeHost(hostHeader: string | null | undefined): string | null {
  if (!hostHeader) return null;
  const first = hostHeader.split(",")[0].trim().toLowerCase();
  if (first.startsWith("[") && first.includes("]")) {
    return first.slice(1, first.indexOf("]"));
  }
  return first.split(":")[0] || null;
}

function isIpHost(host: string): boolean {
  if (host === "::1") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return false;
}

function configuredRootDomain(): string | null {
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.ROOT_DOMAIN)
    ?.replace(/^\./, "")
    .toLowerCase()
    .trim();
  return root || null;
}

function splitSubdomain(host: string): { sub: string; root: string } | null {
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 3) return null;
  return { sub: parts[0], root: parts.slice(1).join(".") };
}

function portalFromSubLabel(sub: string, allowAliases: boolean): PortalKind | null {
  if (sub === "leads" || sub === "partner") return "partner";
  if (sub === "customer") return "customer";
  if (sub === "admin") return "admin";
  if (!allowAliases) return null;
  if (sub === "cp") return "partner";
  if (sub === "eoi" || sub === "clients") return "customer";
  if (sub === "ops") return "admin";
  return null;
}

export function isPathRoutingHost(hostHeader: string | null | undefined): boolean {
  const host = normalizeHost(hostHeader);
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (isIpHost(host)) return true;
  if (host.endsWith(".vercel.app") || host === "vercel.app") return true;
  return false;
}

function publicScheme(): string {
  const from =
    trimOrigin(process.env.APP_URL)
    || trimOrigin(process.env.PUBLIC_URL)
    || trimOrigin(process.env.NEXTAUTH_URL)
    || trimOrigin(process.env.NEXT_PUBLIC_APP_URL)
    || trimOrigin(process.env.PARTNER_URL)
    || trimOrigin(process.env.NEXT_PUBLIC_PARTNER_URL);
  if (from) return new URL(from).protocol.replace(":", "");
  return "https";
}

/** Partner is the primary EOI app; APP_URL remains the partner origin. */
export function getPortalOrigins() {
  const app =
    trimOrigin(process.env.APP_URL)
    || trimOrigin(process.env.PUBLIC_URL)
    || trimOrigin(process.env.NEXTAUTH_URL)
    || trimOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const root = configuredRootDomain();
  const scheme = publicScheme();
  const derived = (kind: PortalKind) => (root ? `${scheme}://${PORTAL_DNS_LABEL[kind]}.${root}` : null);
  return {
    partner: trimOrigin(process.env.PARTNER_URL) || trimOrigin(process.env.NEXT_PUBLIC_PARTNER_URL) || app,
    customer:
      trimOrigin(process.env.CUSTOMER_URL)
      || trimOrigin(process.env.NEXT_PUBLIC_CUSTOMER_URL)
      || derived("customer"),
    admin:
      trimOrigin(process.env.ADMIN_URL)
      || trimOrigin(process.env.NEXT_PUBLIC_ADMIN_URL)
      || derived("admin"),
  };
}

export function getPortalOrigin(kind: PortalKind): string | null {
  return getPortalOrigins()[kind];
}

export function getPortalHomePath(kind: PortalKind): string {
  return kind === "admin" ? "/admin" : `/${kind}`;
}

export function getPortalLoginPath(kind: PortalKind): string {
  if (kind === "admin") return "/login";
  if (kind === "customer") return "/customer/login";
  return "/partner/login";
}

/**
 * Map request Host to a portal. Unmatched hosts (localhost, IPs, *.vercel.app,
 * a single VM hostname) stay on path-based routing so URLs can change per env.
 */
export function resolvePortalFromHost(hostHeader: string | null | undefined): PortalKind | null {
  if (isPathRoutingHost(hostHeader)) return null;
  const host = normalizeHost(hostHeader);
  if (!host) return null;

  const origins = getPortalOrigins();
  if (origins.partner && host === hostnameOf(origins.partner)) return "partner";
  if (origins.customer && host === hostnameOf(origins.customer)) return "customer";
  if (origins.admin && host === hostnameOf(origins.admin)) return "admin";

  const root = configuredRootDomain();
  if (root && (host === root || host.endsWith(`.${root}`))) {
    const sub = host === root ? "" : host.slice(0, -(root.length + 1));
    if (!sub) return "partner";
    return portalFromSubLabel(sub, true);
  }

  const split = splitSubdomain(host);
  if (split) return portalFromSubLabel(split.sub, false);

  return null;
}

function siblingOrigin(kind: PortalKind, hostHeader?: string | null): string | null {
  const host = normalizeHost(hostHeader);
  if (!host || isPathRoutingHost(hostHeader)) return null;
  const root = configuredRootDomain();
  const split = splitSubdomain(host);
  const derivedRoot = root && (host === root || host.endsWith(`.${root}`)) ? root : split?.root;
  if (!derivedRoot) return null;
  return `${publicScheme()}://${PORTAL_DNS_LABEL[kind]}.${derivedRoot}`;
}

export function originForPortal(kind: PortalKind, hostHeader?: string | null): string | null {
  return getPortalOrigin(kind) || siblingOrigin(kind, hostHeader);
}

const SHARED_PREFIXES = ["/api", "/confirm", "/invite", "/auth", "/health"];

function hasPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isSharedPortalPath(pathname: string): boolean {
  return SHARED_PREFIXES.some((p) => hasPrefix(pathname, p));
}

function portalKindFromPath(pathname: string): PortalKind | null {
  if (hasPrefix(pathname, "/customer")) return "customer";
  if (hasPrefix(pathname, "/partner")) return "partner";
  if (hasPrefix(pathname, "/admin")) return "admin";
  return null;
}

/**
 * Absolute URL when this host is the wrong portal (e.g. customer UI on leads.*).
 * Shared paths like /confirm stay on the current host.
 */
export function crossPortalRedirectUrl(args: {
  pathname: string;
  hostHeader: string | null | undefined;
  role?: "ADMIN" | "CHANNEL_PARTNER" | "CUSTOMER" | null;
}): string | null {
  const { pathname, hostHeader, role } = args;
  if (isPathRoutingHost(hostHeader) || isSharedPortalPath(pathname)) return null;
  const portal = resolvePortalFromHost(hostHeader);
  if (!portal) return null;

  const pathKind = portalKindFromPath(pathname);
  if (pathKind && pathKind !== portal) {
    const origin = originForPortal(pathKind, hostHeader);
    return origin ? `${origin}${pathname}` : null;
  }

  if (role) {
    const expected = portalKindForRole(role);
    if (expected !== portal) {
      const origin = originForPortal(expected, hostHeader);
      return origin ? `${origin}${getPortalHomePath(expected)}` : null;
    }
  }
  return null;
}

/** Internal App Router path for a host-scoped request. */
export function rewritePathForPortal(pathname: string, portal: PortalKind): string {
  if (SHARED_PREFIXES.some((p) => hasPrefix(pathname, p))) return pathname;
  if (hasPrefix(pathname, "/partner") || hasPrefix(pathname, "/customer") || hasPrefix(pathname, "/admin")) {
    return pathname;
  }
  if (pathname === "/login") return getPortalLoginPath(portal);
  if (pathname === "/") return getPortalHomePath(portal);
  return `${getPortalHomePath(portal)}${pathname}`;
}

export function portalHref(kind: PortalKind, path: string): string {
  const origin = getPortalOrigin(kind);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}

/** Absolute only when the request is already on a different portal host. */
export function portalHrefForHost(kind: PortalKind, path: string, hostHeader?: string | null): string {
  const current = resolvePortalFromHost(hostHeader);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (current && current !== kind) {
    const origin = originForPortal(kind, hostHeader);
    return origin ? `${origin}${normalized}` : normalized;
  }
  return normalized;
}

export function getPortalHomeHref(kind: PortalKind): string {
  return portalHref(kind, getPortalHomePath(kind));
}

export function getPortalLoginHref(kind: PortalKind): string {
  return portalHref(kind, getPortalLoginPath(kind));
}

/**
 * Relative path on the same portal / localhost / Vercel preview / single VM host.
 * Absolute URL only when sending the user to a different subdomain.
 */
export function getPortalHomeHrefForHost(kind: PortalKind, hostHeader?: string | null): string {
  return portalHrefForHost(kind, getPortalHomePath(kind), hostHeader);
}

export function getPortalLoginHrefForHost(kind: PortalKind, hostHeader?: string | null): string {
  return portalHrefForHost(kind, getPortalLoginPath(kind), hostHeader);
}

export function portalKindForRole(role: "ADMIN" | "CHANNEL_PARTNER" | "CUSTOMER"): PortalKind {
  if (role === "ADMIN") return "admin";
  if (role === "CUSTOMER") return "customer";
  return "partner";
}
