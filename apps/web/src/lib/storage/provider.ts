export type StorageMode = "blob" | "s3" | "dev";

export function getStorageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  if (process.env.S3_ACCESS_KEY?.trim()) return "s3";
  return "dev";
}

export function isBlobUrl(fileUrl: string): boolean {
  return fileUrl.includes("blob.vercel-storage.com");
}

export function storageConfigured(): boolean {
  return getStorageMode() !== "dev";
}
