import { prisma } from "@goyal/db";
import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { streamInlineFile, wantsInlinePreview } from "@/lib/files/stream-download";

export const GET = withApiRoute("partner.assets.assetId.download.get", async (req: Request, { params }: { params: Promise<{ assetId: string }> }) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;

  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { assetId: rawAssetId } = await params;
  const assetId = decodeURIComponent(String(rawAssetId || "")).trim();
  if (!assetId) return apiError("Asset id is required", 400);

  const cpId = session!.user.cpId!;

  const asset = await prisma.projectAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      projectId: true,
      fileUrl: true,
      fileName: true,
      type: true,
      project: { select: { id: true } },
    },
  });
  if (!asset?.project) return apiError("Asset not found", 404);

  // Same rule as project list/detail: CP assignment is enough (OPEN/CLOSED/UPCOMING).
  // Previously required project.status === "ACTIVE", which 403'd creatives on many existing projects.
  const access = await prisma.cPProjectAccess.findFirst({
    where: { cpId, projectId: asset.projectId },
    select: { id: true },
  });
  if (!access) {
    return apiError("Forbidden", 403, "NOT_ASSIGNED", { projectId: asset.projectId });
  }

  if (wantsInlinePreview(req)) {
    return streamInlineFile(
      asset.fileUrl,
      asset.fileName,
      DocumentService.mimeTypeFromFileName(asset.fileName),
    );
  }

  try {
    const downloadUrl = await DocumentService.getPresignedDownloadUrl(asset.fileUrl);
    return apiResponse({
      downloadUrl,
      fileName: asset.fileName,
      mimeType: DocumentService.mimeTypeFromFileName(asset.fileName) || "application/octet-stream",
      type: asset.type,
    });
  } catch (cause) {
    return apiError("File not found", 404, "FILE_MISSING", { cause });
  }
});
