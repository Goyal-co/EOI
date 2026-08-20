import { withAuth, apiError, apiResponse, withApiRoute } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { inferMimeType } from "@/lib/uploads/client-upload";
import type { DocumentType, UserRole } from "@goyal/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const ADMIN_UPLOAD_LIMIT = 100;
const ADMIN_UPLOAD_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_UPLOAD_LIMIT = 30;
const DEFAULT_UPLOAD_WINDOW_MS = 60 * 60 * 1000;

export const POST = withApiRoute("uploads.create", async (req: Request) => {
  const { error, session } = await withAuth();
  if (error) return error;

  const role = session!.user.role as UserRole;
  const ip = getClientIp(req);
  const isAdmin = role === "ADMIN";
  const limited = await rateLimitAsync(
    isAdmin ? `upload:admin:${session!.user.id}` : `upload:${ip}`,
    isAdmin ? ADMIN_UPLOAD_LIMIT : DEFAULT_UPLOAD_LIMIT,
    isAdmin ? ADMIN_UPLOAD_WINDOW_MS : DEFAULT_UPLOAD_WINDOW_MS,
  );
  if (!limited.ok) {
    return apiError("Too many upload requests. Try again later.", 429);
  }

  const form = await req.formData();
  const file = form.get("file");
  const type = String(form.get("type") || "") as DocumentType;
  if (!(file instanceof File) || !type) {
    return apiError("file and type are required", 400);
  }

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
});
