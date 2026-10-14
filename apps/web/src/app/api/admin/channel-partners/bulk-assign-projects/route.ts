import { z } from "zod";
import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

const bulkAssignSchema = z.object({
  cpIds: z.array(z.string().min(1)).min(1, "Select at least one channel partner"),
  projectIds: z.array(z.string().min(1)).min(1, "Select at least one project"),
});

export const POST = withApiRoute("admin.channel-partners.bulk-assign-projects", async (req: Request) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = bulkAssignSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const { cpIds, projectIds } = parsed.data;

  const [cps, projects] = await Promise.all([
    prisma.channelPartner.findMany({
      where: { id: { in: cpIds } },
      select: { id: true, status: true },
    }),
    prisma.project.findMany({
      where: { id: { in: projectIds }, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  if (cps.length !== cpIds.length) {
    return apiError("One or more channel partners were not found", 404);
  }
  if (projects.length !== projectIds.length) {
    return apiError("One or more projects were not found or are not active", 404);
  }

  const notApproved = cps.filter((cp) => cp.status !== "APPROVED");
  if (notApproved.length > 0) {
    return apiError(
      `Projects can only be assigned to approved partners (${notApproved.length} not approved)`,
      400,
    );
  }

  const pairs = cpIds.flatMap((cpId) => projectIds.map((projectId) => ({ cpId, projectId })));
  const existing = await prisma.cPProjectAccess.findMany({
    where: {
      OR: pairs.map((p) => ({ cpId: p.cpId, projectId: p.projectId })),
    },
    select: { cpId: true, projectId: true },
  });
  const existingKey = new Set(existing.map((e) => `${e.cpId}:${e.projectId}`));
  const toCreate = pairs.filter((p) => !existingKey.has(`${p.cpId}:${p.projectId}`));

  if (toCreate.length > 0) {
    await prisma.cPProjectAccess.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  const grantCount = pairs.length;

  await writeAudit({
    actorId: session!.user.id,
    action: "CP_PROJECTS_BULK_ASSIGNED",
    entityType: "ChannelPartner",
    entityId: cpIds[0],
    metadata: {
      cpIds,
      projectIds,
      cpCount: cpIds.length,
      projectCount: projectIds.length,
      grantsAttempted: grantCount,
      created: toCreate.length,
      alreadyHadAccess: existing.length,
    },
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse({
    success: true,
    cpCount: cpIds.length,
    projectCount: projectIds.length,
    grantsAttempted: grantCount,
    created: toCreate.length,
    alreadyHadAccess: existing.length,
  });
});
