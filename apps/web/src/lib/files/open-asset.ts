export function isImageFileName(fileName: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(fileName);
}

export function isPdfFileName(fileName: string): boolean {
  return /\.pdf(\?|$)/i.test(fileName);
}

export function isVideoFileName(fileName: string): boolean {
  return /\.(mp4|webm|mov|qt)(\?|$)/i.test(fileName);
}

export type AssetPreviewKind = "image" | "pdf" | "video" | "other";

/** Map common extensions to MIME. Returns null when unknown. */
export function mimeTypeFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const name = fileName.toLowerCase().split("?")[0];
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov") || name.endsWith(".qt")) return "video/quicktime";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".pdf")) return "application/pdf";
  return null;
}

/** Prefer MIME when present; otherwise fall back to file name / URL extension. */
export function resolvePreviewKind(opts: {
  mimeType?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  assetType?: string | null;
}): AssetPreviewKind {
  if (opts.assetType === "WALKTHROUGH") return "video";

  const mime = (opts.mimeType || "").toLowerCase().trim();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || mime === "application/x-pdf") return "pdf";

  const haystack = `${opts.fileName || ""} ${opts.fileUrl || ""}`;
  if (isPdfFileName(haystack)) return "pdf";
  if (isVideoFileName(haystack)) return "video";
  if (isImageFileName(haystack)) return "image";
  return "other";
}

/** Same-origin stream URL that can be embedded in an iframe/img (avoids storage X-Frame-Options). */
export function inlinePreviewUrl(apiPath: string): string {
  const qIndex = apiPath.indexOf("?");
  const path = qIndex === -1 ? apiPath : apiPath.slice(0, qIndex);
  const params = new URLSearchParams(qIndex === -1 ? "" : apiPath.slice(qIndex + 1));
  params.set("inline", "1");
  return `${path}?${params.toString()}`;
}

export async function fetchPresignedDownload(apiPath: string): Promise<{
  downloadUrl: string;
  fileName: string;
  mimeType?: string | null;
  type?: string;
}> {
  const res = await fetch(apiPath);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to get download URL");
  }
  return res.json();
}

export async function openPresignedAsset(apiPath: string): Promise<void> {
  window.open(inlinePreviewUrl(apiPath), "_blank", "noopener,noreferrer");
}

export async function downloadPresignedAsset(apiPath: string): Promise<void> {
  const { downloadUrl } = await fetchPresignedDownload(apiPath);
  window.open(downloadUrl, "_blank", "noopener,noreferrer");
}

export async function getPresignedUrlForPreview(apiPath: string): Promise<string> {
  return inlinePreviewUrl(apiPath);
}
