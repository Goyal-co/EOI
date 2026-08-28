import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { inferMimeType } from "@/lib/uploads/client-upload";

export const POST = withApiRoute("admin.announcements.attachments", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.eoiAnnouncement.findUnique({ where: { id } });
  if (!existing) return apiError("Not found", 404);
  if (existing.status === "PUBLISHED") return apiError("Cannot add attachments to published announcement", 400);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return apiError("file is required", 400);

  const mimeType = inferMimeType(file);
  const kind = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("video/")
      ? "video"
      : "document";

  const validationError = DocumentService.validateFile("CREATIVE", mimeType, file.size);
  if (validationError) return apiError(validationError);

  const folder = DocumentService.getScopedFolder("ADMIN", session!.user.id, "CREATIVE");
  const body = Buffer.from(await file.arrayBuffer());
  const stored = await DocumentService.uploadBuffer({
    fileName: file.name,
    mimeType,
    folder,
    body,
    size: file.size,
  });

  const attachment = await prisma.eoiAnnouncementAttachment.create({
    data: {
      announcementId: id,
      fileName: file.name,
      fileUrl: stored.fileUrl,
      mimeType,
      fileSize: file.size,
      kind,
    },
  });
  return apiResponse(attachment, 201);
});
