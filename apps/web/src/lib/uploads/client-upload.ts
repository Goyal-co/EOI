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

export async function uploadViaPresign(file: File, type: DocumentType): Promise<UploadedFileResult> {
  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
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
      contentType: file.type,
    });
    return {
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  }

  if (!config.uploadUrl || !config.fileUrl) {
    throw new Error("Invalid S3 upload configuration");
  }

  const putRes = await fetch(config.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) throw new Error("Failed to upload file to storage");

  return {
    fileUrl: config.fileUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}
