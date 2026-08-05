export function getAppBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    || "http://localhost:3000";

  return configured.replace(/\/+$/, "");
}
