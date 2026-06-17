import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@goyal/auth";
import { apiError } from "@/lib/api";
import { getMaxFileSizeForType } from "@/lib/services/document";
import { getStorageMode } from "@/lib/storage/provider";
import type { DocumentType } from "@goyal/types";

const ALL_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

function documentTypeFromPathname(pathname: string): DocumentType | null {
  const segment = pathname.split("/")[2]?.toUpperCase();
  const allowed = ["BROCHURE", "COST_SHEET", "FLOOR_PLAN", "GALLERY", "BANNER", "CHEQUE", "PAN", "AADHAAR", "RERA_CERT", "VISITING_CARD"];
  return allowed.includes(segment) ? (segment as DocumentType) : null;
}

export async function POST(request: Request) {
  if (getStorageMode() !== "blob") {
    return apiError("Blob uploads are not enabled", 400);
  }

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        const rolePrefix = `${session.user.role.toLowerCase()}/`;
        if (!pathname.startsWith(rolePrefix)) {
          throw new Error("Invalid upload path");
        }

        const docType = documentTypeFromPathname(pathname);
        const maximumSizeInBytes = docType ? getMaxFileSizeForType(docType) : 10 * 1024 * 1024;

        return {
          allowedContentTypes: ALL_UPLOAD_MIME_TYPES,
          maximumSizeInBytes,
          validUntil: Date.now() + 60_000,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ userId: session.user.id, role: session.user.role }),
        };
      },
      onUploadCompleted: async () => {
        // Metadata is saved by the client after upload completes.
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Upload failed", 400);
  }
}
