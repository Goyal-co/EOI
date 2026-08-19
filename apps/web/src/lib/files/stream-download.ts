import { apiError } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";

export function wantsInlinePreview(req: Request): boolean {
  return new URL(req.url).searchParams.get("inline") === "1";
}

export async function streamInlineFile(
  fileUrl: string,
  fileName?: string | null,
  mimeType?: string | null,
): Promise<Response> {
  try {
    return await DocumentService.streamStoredFile(fileUrl, { fileName, mimeType });
  } catch (cause) {
    return apiError("File not found", 404, undefined, { cause });
  }
}
