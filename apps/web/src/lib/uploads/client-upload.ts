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

  const form = new FormData();
  form.append("file", file);
  form.append("type", type);

  const res = await fetch("/api/uploads", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload file");
  }

  const stored = (await res.json()) as UploadedFileResult;
  return {
    fileUrl: stored.fileUrl,
    fileName: stored.fileName || file.name,
    fileSize: stored.fileSize || file.size,
    mimeType: stored.mimeType || mimeType,
  };
}
