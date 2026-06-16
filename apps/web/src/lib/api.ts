import { auth } from "@goyal/auth";
import { NextResponse } from "next/server";
import { prisma } from "@goyal/db";
import type { UserRole } from "@goyal/types";

export async function getSession() {
  return auth();
}

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export async function withAuth(roles?: UserRole[]) {
  const session = await getSession();
  if (!session?.user) return { error: apiError("Unauthorized", 401), session: null };
  if (roles && !roles.includes(session.user.role)) {
    return { error: apiError("Forbidden", 403), session: null };
  }
  return { error: null, session };
}

export async function requireApprovedCP(session: { user: { role: string; cpId?: string } }) {
  if (session.user.role !== "CHANNEL_PARTNER" || !session.user.cpId) {
    return apiError("Forbidden", 403);
  }
  const cp = await prisma.channelPartner.findUnique({
    where: { id: session.user.cpId },
    select: { status: true },
  });
  if (!cp || cp.status !== "APPROVED") {
    return apiError("Channel Partner account not approved", 403);
  }
  return null;
}
