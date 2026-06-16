export function isImageFileName(fileName: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(fileName);
}

export function isPdfFileName(fileName: string): boolean {
  return /\.pdf(\?|$)/i.test(fileName);
}

export async function fetchPresignedDownload(apiPath: string): Promise<{
  downloadUrl: string;
  fileName: string;
  mimeType?: string | null;
}> {
  const res = await fetch(apiPath);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to get download URL");
  }
  return res.json();
}

export async function openPresignedAsset(apiPath: string): Promise<void> {
  const { downloadUrl } = await fetchPresignedDownload(apiPath);
  window.open(downloadUrl, "_blank", "noopener,noreferrer");
}

export async function getPresignedUrlForPreview(apiPath: string): Promise<string> {
  const { downloadUrl } = await fetchPresignedDownload(apiPath);
  return downloadUrl;
}
