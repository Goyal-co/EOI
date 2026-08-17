import { auth } from "@goyal/auth";
import { NextResponse } from "next/server";
import { prisma } from "@goyal/db";
import type { UserRole } from "@goyal/types";
import {
  logApiError,
  logServerError,
  requestPath,
  runWithRequestLog,
} from "@/lib/server-log";

export async function getSession() {
  return auth();
}

export function apiResponse<T>(data: T, status = 200) {
  if (status >= 400) {
    const message =
      data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `HTTP ${status}`;
    logApiError({ message, status });
  }
  return NextResponse.json(data, { status });
}

export function apiError(
  message: string,
  status = 400,
  code?: string,
  extra?: Record<string, unknown>,
) {
  const cause = extra?.cause;
  const clientExtra = extra ? { ...extra } : undefined;
  if (clientExtra) delete clientExtra.cause;
  logApiError({ message, status, code, extra: clientExtra, cause });
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}), ...(clientExtra || {}) },
    { status },
  );
}

export function withApiRoute<T extends (req: any, ctx?: any) => Promise<Response> | Response>(
  scope: string,
  handler: T,
): T {
  return (async (req: Request, ctx?: unknown) => {
    const path = requestPath(req);
    return runWithRequestLog({ scope, method: req.method, path }, async () => {
      try {
        return await handler(req, ctx);
      } catch (cause) {
        logServerError(scope, "Unhandled route error", { status: 500, path, method: req.method }, cause);
        return NextResponse.json(
          { error: "Internal server error", code: "INTERNAL_ERROR" },
          { status: 500 },
        );
      }
    });
  }) as T;
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
