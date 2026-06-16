import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/** Lightweight auth for Edge middleware — does not bundle Prisma or credential providers. */
export const { auth } = NextAuth(authConfig);
