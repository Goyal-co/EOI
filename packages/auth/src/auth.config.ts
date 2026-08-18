import type { NextAuthConfig } from "next-auth";

const cookieDomain =
  process.env.VERCEL_ENV === "preview"
    ? undefined
    : process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;

const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || process.env.PUBLIC_URL || "";
const secureCookies =
  process.env.AUTH_COOKIE_SECURE === "true"
  || (process.env.AUTH_COOKIE_SECURE !== "false" && appUrl.startsWith("https://"));

/** Edge-safe NextAuth config (no Prisma, bcrypt, or providers). Used by middleware only. */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  trustHost: true,
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: secureCookies,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
    },
  },
  providers: [],
} satisfies NextAuthConfig;
