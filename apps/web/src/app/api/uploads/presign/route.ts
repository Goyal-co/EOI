import { withAuth, apiResponse, apiError } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import type { DocumentType, UserRole } from "@goyal/types";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = await rateLimitAsync(`presign:${ip}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many upload requests. Try again later.", 429);

  const { error, session } = await withAuth();
  if (error) return error;

  const body = await req.json();
  const { fileName, mimeType, type, size } = body as {
    fileName: string;
    mimeType: string;
    type: DocumentType;
    size: number;
  };

  const role = session!.user.role as UserRole;
  if (!DocumentService.canRoleUploadType(role, type)) {
    return apiError("You are not allowed to upload this document type", 403);
  }

  const validationError = DocumentService.validateFile(type, mimeType, size || 0);
  if (validationError) return apiError(validationError);

  const folder = DocumentService.getScopedFolder(role, session!.user.id, type);
  const result = await DocumentService.getPresignedUploadUrl({ fileName, mimeType, folder, size });

  return apiResponse(result);
}
