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

/** Public project media (/api/files/.../brochure|creative|...) — no partner download gate. */
export function publicFilesUrl(
  fileUrl: string | null | undefined,
  disposition: "inline" | "attachment" = "inline",
): string | null {
  if (!fileUrl) return null;
  if (fileUrl.startsWith("/api/files/")) {
    const base = fileUrl.split("?")[0];
    return disposition === "attachment" ? `${base}?download=1` : `${base}?inline=1`;
  }
  if (/^https?:\/\//i.test(fileUrl) && !fileUrl.includes("amazonaws.com")) {
    return fileUrl;
  }
  return null;
}

export async function fetchPresignedDownload(apiPath: string): Promise<{
  downloadUrl: string;
  fileName: string;
  mimeType?: string | null;
  type?: string;
}> {
  const res = await fetch(apiPath, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to get download URL");
  }
  return res.json();
}

export async function openPresignedAsset(apiPath: string, fileUrl?: string | null): Promise<void> {
  const direct = publicFilesUrl(fileUrl, "inline");
  if (direct) {
    window.open(direct, "_blank", "noopener,noreferrer");
    return;
  }

  const preview = inlinePreviewUrl(apiPath);
  try {
    const res = await fetch(preview, { credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to open file (${res.status})`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    // Revoke after the tab has a chance to load the blob.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    // Fallback: navigate directly (cookie auth on same origin).
    window.open(preview, "_blank", "noopener,noreferrer");
  }
}

export async function downloadPresignedAsset(apiPath: string, fileUrl?: string | null): Promise<void> {
  const direct = publicFilesUrl(fileUrl, "attachment");
  if (direct) {
    window.open(direct, "_blank", "noopener,noreferrer");
    return;
  }
  const { downloadUrl } = await fetchPresignedDownload(apiPath);
  window.open(downloadUrl, "_blank", "noopener,noreferrer");
}

export async function getPresignedUrlForPreview(apiPath: string): Promise<string> {
  return inlinePreviewUrl(apiPath);
}
