import { auth } from "@goyal/auth";
import { NextResponse } from "next/server";
import { prisma } from "@goyal/db";
import type { UserRole } from "@goyal/types";
import {
  logApiError,
  logServerDebug,
  logServerError,
  logServerInfo,
  requestPath,
  runWithRequestLog,
} from "@/lib/server-log";

export const PARTNER_PORTAL_ROLES: UserRole[] = ["CHANNEL_PARTNER", "CP_TEAM_MEMBER"];

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
    const method = req.method;
    return runWithRequestLog({ scope, method, path }, async () => {
      const started = Date.now();
      logServerDebug(scope, "request start", { method, path });
      try {
        const res = await handler(req, ctx);
        logServerInfo(scope, "request complete", {
          method,
          path,
          status: res.status,
          durationMs: Date.now() - started,
        });
        return res;
      } catch (cause) {
        logServerError(
          scope,
          "Unhandled route error",
          { status: 500, path, method, durationMs: Date.now() - started },
          cause,
        );
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

export async function withPartnerAuth() {
  return withAuth(PARTNER_PORTAL_ROLES);
}

export async function requireApprovedCP(session: {
  user: { role: string; cpId?: string; teamMemberId?: string };
}) {
  if (!PARTNER_PORTAL_ROLES.includes(session.user.role as UserRole) || !session.user.cpId) {
    return apiError("Forbidden", 403);
  }
  const cp = await prisma.channelPartner.findUnique({
    where: { id: session.user.cpId },
    select: { status: true },
  });
  if (!cp || cp.status !== "APPROVED") {
    return apiError("Channel Partner account not approved", 403);
  }
  if (session.user.role === "CP_TEAM_MEMBER") {
    const member = await prisma.cPTeamMember.findFirst({
      where: {
        id: session.user.teamMemberId,
        cpId: session.user.cpId,
        status: "ACTIVE",
        userId: { not: null },
      },
      select: { id: true },
    });
    if (!member) {
      return apiError("Team member access is not active", 403);
    }
  }
  return null;
}

export async function requirePartnerOwner(session: { user: { role: string } }) {
  if (session.user.role !== "CHANNEL_PARTNER") {
    return apiError("Only the channel partner owner can perform this action", 403);
  }
  return null;
}
