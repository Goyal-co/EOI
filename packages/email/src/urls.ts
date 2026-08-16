function vercelPreviewOrigin(): string | null {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }
  return null;
}

/** Runtime env first so a VM can change URLs without rebuilding the image. */
export function getAppBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  const configured =
    process.env.APP_URL
    || process.env.PUBLIC_URL
    || process.env.PARTNER_URL
    || process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_PARTNER_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    || "http://localhost:3000";

  return configured.replace(/\/+$/, "");
}

export function getCustomerBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return (process.env.CUSTOMER_URL || process.env.NEXT_PUBLIC_CUSTOMER_URL || getAppBaseUrl()).replace(/\/+$/, "");
}

export function getAdminBaseUrl(): string {
  const preview = vercelPreviewOrigin();
  if (preview) return preview;
  return (process.env.ADMIN_URL || process.env.NEXT_PUBLIC_ADMIN_URL || getAppBaseUrl()).replace(/\/+$/, "");
}

export function getPartnerBaseUrl(): string {
  return getAppBaseUrl();
}
