import { prisma } from "@goyal/db";
import { adminProjectPatchSchema, projectEoiRuleSchema } from "@goyal/types";
import { NotificationService, isAdminNotificationEnabled } from "@goyal/email";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { resolveProjectBannerUrl } from "@/lib/project-banner";
import { DocumentService } from "@/lib/services/document";

function normalizeLocationLink(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (!value.trim()) return null;
  return value.trim();
}
export const GET = withApiRoute("admin.projects.id.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
  include: { assets: true, eoiRules: true },
  });
  if (!project) return apiError("Project not found", 404);
  return apiResponse({
    ...project,
    startingPrice: Number(project.startingPrice),
    bannerUrl: await resolveProjectBannerUrl(project.bannerUrl),
  });
});

export const PATCH = withApiRoute("admin.projects.id.patch", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
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
      locationLink: normalizeLocationLink(parsed.data.locationLink),
      tags:
        parsed.data.tags === undefined
          ? undefined
          : parsed.data.tags,
      possessionDate:
        parsed.data.possessionDate === undefined
          ? undefined
          : parsed.data.possessionDate
            ? new Date(parsed.data.possessionDate)
            : null,
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
});

export const DELETE = withApiRoute("admin.projects.id.delete", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assets: { select: { fileUrl: true } },
      eois: { include: { documents: { select: { fileUrl: true } } } },
    },
  });
  if (!project) return apiError("Project not found", 404);

  const fileUrls = [
    ...project.assets.map((asset) => asset.fileUrl),
    ...project.eois.flatMap((eoi) => eoi.documents.map((doc) => doc.fileUrl)),
  ].filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.approvalAction.deleteMany({ where: { eoi: { projectId: id } } });
    await tx.document.deleteMany({ where: { eoi: { projectId: id } } });
    await tx.eOI.deleteMany({ where: { projectId: id } });
    await tx.lead.deleteMany({ where: { projectId: id } });
    await tx.cPProjectAccess.deleteMany({ where: { projectId: id } });
    await tx.projectAsset.deleteMany({ where: { projectId: id } });
    await tx.eOIRule.deleteMany({ where: { projectId: id } });
    await tx.project.delete({ where: { id } });
  });

  await Promise.allSettled(fileUrls.map((fileUrl) => DocumentService.deleteStoredFile(fileUrl)));
  return apiResponse({ success: true });
});
