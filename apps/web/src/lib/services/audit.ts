import { prisma } from "@goyal/db";
import type { Prisma } from "@goyal/db";

export async function writeAudit(
  params: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  try {
    await client.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata as never,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write:", err);
  }
}

export function getIpFromRequest(req: Request): string | undefined {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || undefined;
}
