import type { NextAuthConfig } from "next-auth";

/** Edge-safe NextAuth config (no Prisma, bcrypt, or providers). Used by middleware only. */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  trustHost: true,
  providers: [],
} satisfies NextAuthConfig;
