import { prisma } from "@goyal/db";
import { withAuth, apiResponse } from "@/lib/api";

export async function GET(req: Request) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count(),
  ]);

  return apiResponse({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      actorName: l.actor?.name || l.actor?.email || "System",
      ipAddress: l.ipAddress,
      metadata: l.metadata,
      createdAt: l.createdAt,
    })),
    total,
  });
}
