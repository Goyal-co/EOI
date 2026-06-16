import { prisma } from "@goyal/db";
import { adminProjectPatchSchema, projectEoiRuleSchema } from "@goyal/types";
import { NotificationService, isAdminNotificationEnabled } from "@goyal/email";
import { withAuth, apiResponse, apiError } from "@/lib/api";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
  include: { assets: true, eoiRules: true },
  });
  if (!project) return apiError("Project not found", 404);
  return apiResponse(project);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const body = await req.json();
  const { eoiRule, ...rest } = body;
  const parsed = adminProjectPatchSchema.safeParse(rest);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return apiError("Project not found", 404);

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...parsed.data,
      possessionDate: parsed.data.possessionDate ? new Date(parsed.data.possessionDate) : undefined,
    },
  });

  if (eoiRule) {
    const ruleParsed = projectEoiRuleSchema.safeParse(eoiRule);
    if (ruleParsed.success) {
      await prisma.eOIRule.upsert({
        where: { projectId: id },
        create: {
          projectId: id,
          minBudget: ruleParsed.data.minBudget,
          requiredDocuments: ruleParsed.data.requiredDocuments || [],
        },
        update: {
          minBudget: ruleParsed.data.minBudget,
          requiredDocuments: ruleParsed.data.requiredDocuments || [],
        },
      });
    }
  }

  const eoiStatusChanged = parsed.data.eoiStatus && parsed.data.eoiStatus !== existing.eoiStatus;
  const statusChanged = parsed.data.status && parsed.data.status !== existing.status;
  if ((eoiStatusChanged || statusChanged) && await isAdminNotificationEnabled("projectUpdates")) {
    const accesses = await prisma.cPProjectAccess.findMany({
      where: { projectId: id },
      include: { cp: { include: { user: true } } },
    });
    const changeSummary = eoiStatusChanged
      ? `EOI status changed to ${parsed.data.eoiStatus}`
      : `Project status changed to ${parsed.data.status}`;
    for (const access of accesses) {
      if (access.cp.user) {
        await NotificationService.notifyProjectStatusUpdated({
          cpUserId: access.cp.user.id,
          projectName: project.name,
          changeSummary,
          projectId: project.id,
        });
      }
    }
  }

  return apiResponse(project);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  await prisma.project.delete({ where: { id } });
  return apiResponse({ success: true });
}
