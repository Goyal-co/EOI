import { withAuth, apiError, apiResponse } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { inferMimeType } from "@/lib/uploads/client-upload";
import type { DocumentType, UserRole } from "@goyal/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = await rateLimitAsync(`upload:${ip}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many upload requests. Try again later.", 429);

  const { error, session } = await withAuth();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file");
  const type = String(form.get("type") || "") as DocumentType;
  if (!(file instanceof File) || !type) {
    return apiError("file and type are required", 400);
  }

  const role = session!.user.role as UserRole;
  if (!DocumentService.canRoleUploadType(role, type)) {
    return apiError("You are not allowed to upload this document type", 403);
  }

  const mimeType = inferMimeType(file);
  const validationError = DocumentService.validateFile(type, mimeType, file.size);
  if (validationError) return apiError(validationError);

  const folder = DocumentService.getScopedFolder(role, session!.user.id, type);
  const body = Buffer.from(await file.arrayBuffer());
  const stored = await DocumentService.uploadBuffer({
    fileName: file.name,
    mimeType,
    folder,
    body,
    size: file.size,
  });

  return apiResponse({
    fileUrl: stored.fileUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType,
    key: stored.key,
  });
}
