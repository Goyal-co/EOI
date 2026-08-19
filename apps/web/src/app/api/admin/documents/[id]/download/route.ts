import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { streamInlineFile, wantsInlinePreview } from "@/lib/files/stream-download";

export const GET = withApiRoute("admin.documents.id.download.get", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return apiError("Document not found", 404);

  if (wantsInlinePreview(req)) {
    return streamInlineFile(document.fileUrl, document.fileName, document.mimeType);
  }

  const downloadUrl = await DocumentService.getPresignedDownloadUrl(document.fileUrl);

  return apiResponse({
    downloadUrl,
    fileName: document.fileName,
    mimeType: document.mimeType,
    type: document.type,
  });
});
