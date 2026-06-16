import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return apiError("Document not found", 404);

  const downloadUrl = await DocumentService.getPresignedDownloadUrl(document.fileUrl);

  return apiResponse({
    downloadUrl,
    fileName: document.fileName,
    mimeType: document.mimeType,
    type: document.type,
  });
}
