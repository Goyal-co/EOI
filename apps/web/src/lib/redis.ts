/**
 * Local (`next dev`, localhost) keeps REDIS_URL_LOCAL / the existing REDIS_URL.
 * Production (VM, ECS, Vercel Production) uses REDIS_URL from the server env.
 */
export function useLocalRedis(): boolean {
  if (process.env.REDIS_ENV === "production") return false;
  if (process.env.REDIS_ENV === "local") return true;
  const app = process.env.NEXTAUTH_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (/localhost|127\.0\.0\.1/.test(app)) return true;
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development") return true;
  return process.env.NODE_ENV !== "production";
}

export function getRedisUrl(): string | undefined {
  if (useLocalRedis()) {
    return process.env.REDIS_URL_LOCAL?.trim() || process.env.REDIS_URL?.trim() || undefined;
  }
  return process.env.REDIS_URL?.trim() || undefined;
}
