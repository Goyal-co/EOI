import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@goyal/auth";
import { apiError } from "@/lib/api";
import { getMaxFileSizeForType } from "@/lib/services/document";
import { getStorageMode } from "@/lib/storage/provider";
import type { DocumentType } from "@goyal/types";

const DOC_TYPES: DocumentType[] = [
  "BROCHURE",
  "COST_SHEET",
  "FLOOR_PLAN",
  "GALLERY",
  "BANNER",
  "CREATIVE",
  "WALKTHROUGH",
  "LOCATION",
  "CHEQUE",
  "PAN",
  "AADHAAR",
  "RERA_CERT",
  "GST_CERT",
  "VISITING_CARD",
];

const MIME_BY_TYPE: Record<string, string[]> = {
  CHEQUE: ["image/jpeg", "image/png", "application/pdf"],
  PAN: ["image/jpeg", "image/png", "application/pdf"],
  AADHAAR: ["image/jpeg", "image/png", "application/pdf"],
  RERA_CERT: ["application/pdf"],
  GST_CERT: ["application/pdf"],
  VISITING_CARD: ["image/jpeg", "image/png", "application/pdf"],
  BROCHURE: ["application/pdf"],
  COST_SHEET: ["application/pdf"],
  FLOOR_PLAN: ["image/jpeg", "image/png", "application/pdf"],
  BANNER: ["image/jpeg", "image/png", "image/webp"],
  GALLERY: ["image/jpeg", "image/png", "image/webp"],
  CREATIVE: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  WALKTHROUGH: ["video/mp4", "video/webm", "video/quicktime"],
  LOCATION: ["image/jpeg", "image/png", "image/webp"],
};

function documentTypeFromPathname(pathname: string): DocumentType | null {
  const segment = pathname.split("/")[2]?.toUpperCase();
  return DOC_TYPES.includes(segment as DocumentType) ? (segment as DocumentType) : null;
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
        const allowedContentTypes = docType
          ? (MIME_BY_TYPE[docType] ?? ["image/jpeg", "image/png", "image/webp", "application/pdf"])
          : ["image/jpeg", "image/png", "image/webp", "application/pdf"];

        // Large videos need a longer upload window
        const validUntilMs = docType === "WALKTHROUGH" ? 15 * 60_000 : 5 * 60_000;

        return {
          allowedContentTypes,
          maximumSizeInBytes,
          validUntil: Date.now() + validUntilMs,
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
