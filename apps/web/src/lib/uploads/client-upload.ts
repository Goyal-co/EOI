import type { DocumentType } from "@goyal/types";

export interface PresignResponse {
  mode: "blob" | "s3";
  pathname?: string;
  handleUploadUrl?: string;
  uploadUrl?: string;
  fileUrl?: string;
  key?: string;
}

export interface UploadedFileResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov") || name.endsWith(".qt")) return "video/quicktime";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

export async function uploadViaPresign(file: File, type: DocumentType): Promise<UploadedFileResult> {
  const mimeType = inferMimeType(file);

  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      type,
      size: file.size,
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error || "Failed to prepare upload");
  }

  const config = (await presignRes.json()) as PresignResponse;

  if (config.mode === "blob") {
    if (!config.pathname) throw new Error("Invalid blob upload configuration");
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(config.pathname, file, {
      access: "private",
      handleUploadUrl: config.handleUploadUrl || "/api/uploads/blob",
      contentType: mimeType,
    });
    return {
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    };
  }

  if (!config.uploadUrl || !config.fileUrl) {
    throw new Error("Invalid S3 upload configuration");
  }

  const putRes = await fetch(config.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": mimeType },
  });
  if (!putRes.ok) throw new Error("Failed to upload file to storage");

  return {
    fileUrl: config.fileUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType,
  };
}
