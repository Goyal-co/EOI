function vercelPreviewOrigin(): string | null {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }
  return null;
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function hostnameOf(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalHostName(host: string | null | undefined): boolean {
  if (!host) return true;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

function isLocalOrigin(origin: string): boolean {
  return isLocalHostName(hostnameOf(origin));
}

function envOrigin(keys: string[], options?: { allowLocalhost?: boolean }): string | null {
  const allowLocalhost = options?.allowLocalhost ?? process.env.NODE_ENV !== "production";
  for (const key of keys) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    let origin: string;
    try {
      origin = new URL(raw).origin;
    } catch {
      origin = stripSlash(raw);
    }
    if (!allowLocalhost && isLocalOrigin(origin)) continue;
    return origin;
  }
  return null;
}

function configuredRootDomain(): string | null {
  const root = (process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "")
    .replace(/^\./, "")
    .toLowerCase()
    .trim();
  if (!root || root === "localhost" || root.endsWith(".localhost")) return null;
  return root;
}

function publicScheme(): string {
  const from = envOrigin([
    "APP_URL",
    "PUBLIC_URL",
    "NEXTAUTH_URL",
    "PARTNER_URL",
    "CUSTOMER_URL",
    "ADMIN_URL",
    "NEXT_PUBLIC_APP_URL",
  ]);
  if (from) {
    try {
      return new URL(from).protocol.replace(":", "") || "https";
    } catch {
      return "https";
    }
  }
  return process.env.NODE_ENV === "production" ? "https" : "http";
}

function inferredRootDomain(): string | null {
  const configured = configuredRootDomain();
  if (configured) return configured;

  const origins = [
    envOrigin(["CUSTOMER_URL", "NEXT_PUBLIC_CUSTOMER_URL"]),
    envOrigin(["ADMIN_URL", "NEXT_PUBLIC_ADMIN_URL"]),
    envOrigin(["PARTNER_URL", "NEXT_PUBLIC_PARTNER_URL", "APP_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]),
  ];
  for (const origin of origins) {
    if (!origin) continue;
    const host = hostnameOf(origin);
    if (!host || isLocalHostName(host)) continue;
    const parts = host.split(".").filter(Boolean);
    if (parts.length >= 3) return parts.slice(1).join(".");
    if (parts.length === 2) return host;
  }
  return null;
}

function siblingOrigin(label: "leads" | "customer" | "admin"): string | null {
  const root = inferredRootDomain();
  if (root) return `${publicScheme()}://${label}.${root}`;
  if (process.env.NODE_ENV === "production") {
    return `https://${label}.partnergoyalco.com`;
  }
  return null;
}

function isDedicatedOrigin(origin: string, labels: string[]): boolean {
  const host = hostnameOf(origin);
  if (!host) return false;
  return labels.some((label) => host === label || host.startsWith(`${label}.`));
}

function publicPathOnHost(base: string, appPath: string, prefix: string, labels: string[]): string {
  const path = appPath.startsWith("/") ? appPath : `/${appPath}`;
  if (isDedicatedOrigin(base, labels) && (path === prefix || path.startsWith(`${prefix}/`))) {
    const stripped = path.slice(prefix.length) || "/";
    return `${stripSlash(base)}${stripped}`;
  }
  return `${stripSlash(base)}${path}`;
}

/** Runtime env first so a VM can change URLs without rebuilding the image. */
export function getAppBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return getPartnerBaseUrl();
}

export function getPartnerBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return stripSlash(
    envOrigin(["PARTNER_URL", "NEXT_PUBLIC_PARTNER_URL", "APP_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"])
    || siblingOrigin("leads")
    || "http://localhost:3000",
  );
}

export function getCustomerBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return stripSlash(
    envOrigin(["CUSTOMER_URL", "NEXT_PUBLIC_CUSTOMER_URL"])
    || siblingOrigin("customer")
    || "http://localhost:3000",
  );
}

export function getAdminBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return stripSlash(
    envOrigin(["ADMIN_URL", "NEXT_PUBLIC_ADMIN_URL"])
    || siblingOrigin("admin")
    || "http://localhost:3000",
  );
}

export function getCustomerPublicUrl(appPath: string): string {
  return publicPathOnHost(getCustomerBaseUrl(), appPath, "/customer", ["customer"]);
}

export function getPartnerPublicUrl(appPath: string): string {
  return publicPathOnHost(getPartnerBaseUrl(), appPath, "/partner", ["leads", "partner"]);
}

export function getAdminPublicUrl(appPath: string): string {
  return publicPathOnHost(getAdminBaseUrl(), appPath, "/admin", ["admin"]);
}

export function getCustomerLoginUrl(): string {
  return getCustomerPublicUrl("/customer/login");
}

export function getCustomerPortalUrl(): string {
  return getCustomerPublicUrl("/customer");
}

export function getCustomerEoiUrl(): string {
  return getCustomerPublicUrl("/customer/eoi");
}

export function getCustomerResetPasswordUrl(token: string): string {
  return getCustomerPublicUrl(`/customer/reset-password/${encodeURIComponent(token)}`);
}

export function getCustomerConfirmUrl(token: string, action: "accept" | "reject"): string {
  return `${getCustomerBaseUrl()}/confirm/${encodeURIComponent(token)}/${action}`;
}

export function getPartnerLoginUrl(): string {
  return getPartnerPublicUrl("/partner/login");
}

export function getPartnerDashboardUrl(): string {
  return getPartnerPublicUrl("/partner");
}

export function getPartnerLeadsUrl(search?: string): string {
  const base = getPartnerPublicUrl("/partner/leads");
  if (!search) return base;
  return `${base}?search=${encodeURIComponent(search)}`;
}

export function getPartnerResetPasswordUrl(token: string): string {
  return getPartnerPublicUrl(`/partner/reset-password/${encodeURIComponent(token)}`);
}

export function getAdminLoginUrl(): string {
  return `${getAdminBaseUrl()}/login`;
}

export function getAdminLeadsUrl(query?: string): string {
  const base = getAdminPublicUrl("/admin/leads");
  if (!query) return base;
  return `${base}?q=${encodeURIComponent(query)}`;
}

function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Put email links on the correct portal host and never leave localhost in production. */
export function canonicalizeEmailUrl(raw: string): string {
  const value = raw.trim();
  if (!looksLikeHttpUrl(value)) return raw;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return raw;
  }

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  const pathname = parsed.pathname;

  if (pathname === "/confirm" || pathname.startsWith("/confirm/") || pathname === "/invite" || pathname.startsWith("/invite/")) {
    return `${getCustomerBaseUrl()}${path}`;
  }
  if (pathname === "/customer" || pathname.startsWith("/customer/")) {
    return `${getCustomerPublicUrl(pathname)}${parsed.search}${parsed.hash}`;
  }
  if (pathname === "/partner" || pathname.startsWith("/partner/")) {
    return `${getPartnerPublicUrl(pathname)}${parsed.search}${parsed.hash}`;
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return `${getAdminPublicUrl(pathname)}${parsed.search}${parsed.hash}`;
  }
  if (pathname === "/eoi" || pathname.startsWith("/eoi/") || pathname === "/welcome" || pathname.startsWith("/welcome/")) {
    const host = parsed.hostname.toLowerCase();
    if (host.startsWith("leads.") || host.startsWith("partner.") || host.startsWith("admin.") || isLocalHostName(host)) {
      return `${getCustomerBaseUrl()}${path}`;
    }
  }
  if (isLocalHostName(parsed.hostname)) {
    return `${getPartnerBaseUrl()}${path}`;
  }
  return value;
}

export function rewriteEmailHtmlUrls(html: string): string {
  return html.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => canonicalizeEmailUrl(url));
}
