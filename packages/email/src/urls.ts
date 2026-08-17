function vercelPreviewOrigin(): string | null {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }
  return null;
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function envOrigin(...keys: string[]): string | null {
  for (const key of keys) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      return new URL(raw).origin;
    } catch {
      return stripSlash(raw);
    }
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
  const from = envOrigin(
    "APP_URL",
    "PUBLIC_URL",
    "NEXTAUTH_URL",
    "PARTNER_URL",
    "CUSTOMER_URL",
    "ADMIN_URL",
  );
  if (from) return new URL(from).protocol.replace(":", "");
  return "https";
}

function siblingOrigin(label: "leads" | "customer" | "admin"): string | null {
  const root = configuredRootDomain();
  if (!root) return null;
  return `${publicScheme()}://${label}.${root}`;
}

function hostnameOf(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isDedicatedCustomerOrigin(origin: string): boolean {
  const host = hostnameOf(origin);
  return !!host && (host === "customer" || host.startsWith("customer."));
}

/** Runtime env first so a VM can change URLs without rebuilding the image. */
export function getAppBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  const configured =
    envOrigin("APP_URL", "PUBLIC_URL", "PARTNER_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_PARTNER_URL")
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    || "http://localhost:3000";

  return stripSlash(configured);
}

export function getCustomerBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return stripSlash(
    envOrigin("CUSTOMER_URL", "NEXT_PUBLIC_CUSTOMER_URL")
    || siblingOrigin("customer")
    || getAppBaseUrl(),
  );
}

export function getAdminBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return stripSlash(
    envOrigin("ADMIN_URL", "NEXT_PUBLIC_ADMIN_URL")
    || siblingOrigin("admin")
    || getAppBaseUrl(),
  );
}

export function getPartnerBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return stripSlash(
    envOrigin("PARTNER_URL", "NEXT_PUBLIC_PARTNER_URL", "APP_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL")
    || siblingOrigin("leads")
    || getAppBaseUrl(),
  );
}

/**
 * Public URL for a customer App Router path (`/customer/...`).
 * On customer.partnergoyalco.com the `/customer` prefix is stripped so emails
 * use `/login`, `/eoi`, etc. (middleware rewrites those onto the app paths).
 */
export function getCustomerPublicUrl(appPath: string): string {
  const base = getCustomerBaseUrl();
  const path = appPath.startsWith("/") ? appPath : `/${appPath}`;
  if (isDedicatedCustomerOrigin(base) && (path === "/customer" || path.startsWith("/customer/"))) {
    const stripped = path.slice("/customer".length) || "/";
    return `${base}${stripped}`;
  }
  return `${base}${path}`;
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
