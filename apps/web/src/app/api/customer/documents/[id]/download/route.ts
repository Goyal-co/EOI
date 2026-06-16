import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: { eoi: { include: { customer: true } } },
  });
  if (!document) return apiError("Document not found", 404);
  if (document.eoi?.customer?.userId !== session!.user.id) {
    return apiError("Forbidden", 403);
  }

  const downloadUrl = await DocumentService.getPresignedDownloadUrl(document.fileUrl);

  return apiResponse({
    downloadUrl,
    fileName: document.fileName,
    mimeType: document.mimeType,
    type: document.type,
  });
}
