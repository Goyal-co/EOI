import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { customerOwnsProjectAsset } from "@/lib/customer/eoi-resolver";

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const { assetId } = await params;

  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) return apiError("Asset not found", 404);

  const owns = await customerOwnsProjectAsset(session!.user.id, asset.projectId);
  if (!owns) return apiError("Forbidden", 403);

  const downloadUrl = await DocumentService.getPresignedDownloadUrl(asset.fileUrl);

  return apiResponse({
    downloadUrl,
    fileName: asset.fileName,
    mimeType: asset.type === "GALLERY" ? "image/jpeg" : "application/pdf",
  });
}
