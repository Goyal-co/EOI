import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, requireApprovedCP } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;

  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { assetId } = await params;

  const asset = await prisma.projectAsset.findUnique({
    where: { id: assetId },
    include: { project: { select: { status: true } } },
  });
  if (!asset) return apiError("Asset not found", 404);
  if (asset.project.status !== "ACTIVE") return apiError("Project not available", 403);

  const downloadUrl = await DocumentService.getPresignedDownloadUrl(asset.fileUrl);

  return apiResponse({
    downloadUrl,
    fileName: asset.fileName,
    mimeType: asset.type === "GALLERY" ? "image/jpeg" : "application/pdf",
  });
}
