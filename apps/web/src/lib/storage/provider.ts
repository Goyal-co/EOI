export type StorageMode = "blob" | "s3" | "dev";

/** All new documents use S3 when credentials exist. Blob is only for reading old files. */
export function getStorageMode(): StorageMode {
  if (process.env.S3_ACCESS_KEY?.trim()) return "s3";
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  return "dev";
}

export function isBlobUrl(fileUrl: string): boolean {
  return fileUrl.includes("blob.vercel-storage.com");
}

export function storageConfigured(): boolean {
  return getStorageMode() !== "dev";
}
