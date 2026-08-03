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

const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  qt: "video/quicktime",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "video/quicktime": "video/quicktime",
  "application/x-pdf": "application/pdf",
};

function extensionOf(fileName: string): string | null {
  const base = fileName.toLowerCase().split("?")[0];
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  return base.slice(dot + 1);
}

export function inferMimeType(file: File): string {
  const fromExt = EXT_MIME[extensionOf(file.name) || ""];
  const raw = (file.type || "").toLowerCase().trim();
  const fromType = raw ? (MIME_ALIASES[raw] || raw) : "";

  // Prefer a known extension map when browser type is missing or generic.
  if (!fromType || fromType === "application/octet-stream") {
    return fromExt || "application/octet-stream";
  }
  // If extension and type disagree on family, trust extension for known media.
  if (fromExt) {
    const extFamily = fromExt.split("/")[0];
    const typeFamily = fromType.split("/")[0];
    if (extFamily !== typeFamily && (extFamily === "image" || extFamily === "video" || fromExt === "application/pdf")) {
      return fromExt;
    }
  }
  return fromType;
}

export async function uploadViaPresign(file: File, type: DocumentType): Promise<UploadedFileResult> {
  const mimeType = inferMimeType(file);

  if (mimeType === "application/octet-stream") {
    throw new Error("Unsupported or unknown file type. Use JPG, PNG, WebP, PDF, MP4, WebM, or MOV.");
  }

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
