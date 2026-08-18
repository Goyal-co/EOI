import { prisma } from "@goyal/db";
import type { DocumentType } from "@goyal/types";
import type { UserRole } from "@goyal/types";
import { getStorageMode, isBlobUrl } from "@/lib/storage/provider";
import {
  blobObjectExists,
  blobGetDownloadUrl,
  blobDelete,
} from "@/lib/storage/vercel-blob";
import { appFileUrl, getS3Bucket, s3DeleteObject, s3GetObject, s3HeadObject, s3PutObject, withS3Prefix } from "@/lib/storage/s3";

function bucketName() {
  return getS3Bucket();
}

const ALLOWED_TYPES: Record<string, string[]> = {
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

const ROLE_ALLOWED_DOC_TYPES: Record<UserRole, DocumentType[]> = {
  CUSTOMER: ["CHEQUE", "PAN", "AADHAAR"],
  CHANNEL_PARTNER: ["RERA_CERT", "GST_CERT", "CHEQUE", "PAN", "VISITING_CARD"],
  ADMIN: ["BROCHURE", "COST_SHEET", "FLOOR_PLAN", "BANNER", "GALLERY", "CREATIVE", "WALKTHROUGH", "LOCATION"],
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAX_SIZE_BY_TYPE: Partial<Record<DocumentType, number>> = {
  BROCHURE: 20 * 1024 * 1024,
  FLOOR_PLAN: 20 * 1024 * 1024,
  WALKTHROUGH: 100 * 1024 * 1024,
};

export function getMaxFileSizeForType(type: DocumentType): number {
  return MAX_SIZE_BY_TYPE[type] ?? MAX_FILE_SIZE;
}

export class DocumentService {
  static sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.+/g, ".").slice(0, 200);
  }

  static mimeTypeFromFileName(fileName: string | null | undefined): string | null {
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

  static async deleteStoredFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;
    if (isBlobUrl(fileUrl)) {
      await blobDelete(fileUrl);
      return;
    }
    await this.deleteS3Keys(fileUrl);
  }

  /**
   * Keys to try in S3. Newer rows are stored under S3_PREFIX (default `eoi/`);
   * older DB URLs may omit that folder. Try the prefixed key first.
   */
  static storageKeys(fileUrl: string): string[] {
    const extracted = this.extractKey(fileUrl).replace(/^\/+/, "");
    if (!extracted) return [];
    const prefixed = withS3Prefix(extracted);
    return prefixed === extracted ? [extracted] : [prefixed, extracted];
  }

  private static async deleteS3Keys(fileUrl: string): Promise<void> {
    const keys = this.storageKeys(fileUrl);
    await Promise.all(keys.map((key) => s3DeleteObject(key)));
  }

  private static async getS3Object(fileUrl: string) {
    const keys = this.storageKeys(fileUrl);
    let lastError: unknown;
    for (const key of keys) {
      try {
        return await s3GetObject(key);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("File not found");
  }

  static getScopedFolder(role: UserRole, userId: string, type: DocumentType): string {
    return `${role.toLowerCase()}/${userId}/${type.toLowerCase()}`;
  }

  static canRoleUploadType(role: UserRole, type: DocumentType): boolean {
    return ROLE_ALLOWED_DOC_TYPES[role]?.includes(type) ?? false;
  }

  static validateFile(type: DocumentType, mimeType: string, size: number): string | null {
    const allowed = ALLOWED_TYPES[type];
    if (!allowed?.includes(mimeType)) return `Invalid file type for ${type}`;
    const maxSize = getMaxFileSizeForType(type);
    if (size <= 0 || size > maxSize) {
      const limitMb = Math.round(maxSize / (1024 * 1024));
      return `File exceeds ${limitMb}MB limit`;
    }
    return null;
  }

  static async getPresignedUploadUrl(params: {
    fileName: string;
    mimeType: string;
    folder: string;
    size: number;
  }) {
    const safeName = this.sanitizeFileName(params.fileName);
    const relativeKey = `${params.folder}/${Date.now()}-${safeName}`;
    const key = withS3Prefix(relativeKey);
    return {
      mode: "s3" as const,
      uploadVia: "server" as const,
      fileUrl: appFileUrl(key),
      key,
    };
  }

  static async uploadBuffer(params: {
    fileName: string;
    mimeType: string;
    folder: string;
    body: Buffer | Uint8Array;
    size: number;
  }): Promise<{ fileUrl: string; key: string }> {
    const safeName = this.sanitizeFileName(params.fileName);
    const relativeKey = `${params.folder}/${Date.now()}-${safeName}`;
    const body = Buffer.isBuffer(params.body) ? params.body : Buffer.from(params.body);

    if (!process.env.S3_ACCESS_KEY?.trim()) {
      throw new Error("S3 credentials are required to store documents");
    }

    const key = await s3PutObject({
      key: relativeKey,
      body,
      mimeType: params.mimeType,
      size: params.size,
    });
    return { fileUrl: appFileUrl(key), key };
  }

  static extractKey(fileUrl: string): string {
    if (!fileUrl) return fileUrl;

    // Strip query string for parsing
    const urlWithoutQuery = fileUrl.split("?")[0];
    const BUCKET = bucketName();

    const apiFiles = "/api/files/";
    const apiIdx = urlWithoutQuery.indexOf(apiFiles);
    if (apiIdx !== -1) {
      return decodeURIComponent(urlWithoutQuery.slice(apiIdx + apiFiles.length));
    }

    // Path-style: endpoint/bucket/key or /bucket/key
    const bucketMarker = `/${BUCKET}/`;
    const bucketIdx = urlWithoutQuery.indexOf(bucketMarker);
    if (bucketIdx !== -1) {
      return decodeURIComponent(urlWithoutQuery.slice(bucketIdx + bucketMarker.length));
    }

    // Legacy split fallback
    const legacy = fileUrl.split(`${BUCKET}/`)[1];
    if (legacy) return decodeURIComponent(legacy.split("?")[0]);

    // Virtual-hosted: bucket.s3.region.amazonaws.com/key
    try {
      const parsed = new URL(urlWithoutQuery);
      const host = parsed.hostname;
      if (host.startsWith(`${BUCKET}.`) || host === `${BUCKET}.s3.amazonaws.com`) {
        return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
      }
      // Generic S3 path after hostname
      if (host.includes("s3") && parsed.pathname.length > 1) {
        const path = parsed.pathname.replace(/^\//, "");
        if (path.startsWith(`${BUCKET}/`)) {
          return decodeURIComponent(path.slice(BUCKET.length + 1));
        }
        return decodeURIComponent(path);
      }
    } catch {
      // not a valid URL — fall through
    }

    // Relative or bare key
    if (!urlWithoutQuery.includes("://")) {
      return decodeURIComponent(urlWithoutQuery.replace(/^\//, ""));
    }

    return decodeURIComponent(urlWithoutQuery);
  }

  static isPrivateStorageUrl(fileUrl: string): boolean {
    if (!fileUrl) return false;
    if (fileUrl.includes("/api/files/")) return true;
    if (fileUrl.startsWith("/")) return false;
    if (isBlobUrl(fileUrl)) return true;
    if (fileUrl.startsWith("http://localhost") && !fileUrl.includes(bucketName())) return false;
    return (
      fileUrl.includes(bucketName())
      || !!process.env.S3_ENDPOINT && fileUrl.startsWith(process.env.S3_ENDPOINT)
      || /\.s3[.-]/.test(fileUrl)
    );
  }

  static async resolveAccessibleUrl(fileUrl: string | null | undefined): Promise<string | null> {
    if (!fileUrl) return null;
    if (isBlobUrl(fileUrl)) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return fileUrl;
      return blobGetDownloadUrl(fileUrl);
    }
    if (fileUrl.includes("/api/files/")) return fileUrl;
    if (!this.isPrivateStorageUrl(fileUrl)) return fileUrl;
    if (!process.env.S3_ACCESS_KEY) return fileUrl;
    const key = this.storageKeys(fileUrl)[0] || this.extractKey(fileUrl);
    return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  static async objectExists(fileUrl: string): Promise<boolean> {
    if (isBlobUrl(fileUrl)) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
      return blobObjectExists(fileUrl);
    }

    if (!process.env.S3_ACCESS_KEY) {
      if (process.env.NODE_ENV === "production" && getStorageMode() === "s3") {
        throw new Error("S3 credentials required in production");
      }
      return true;
    }
    try {
      for (const key of this.storageKeys(fileUrl)) {
        if (await s3HeadObject(key)) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  static async getPresignedDownloadUrl(fileUrl: string) {
    if (isBlobUrl(fileUrl)) {
      return blobGetDownloadUrl(fileUrl);
    }
    if (fileUrl.includes("/api/files/")) return fileUrl.split("?")[0];
    const key = this.storageKeys(fileUrl)[0] || this.extractKey(fileUrl);
    return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  static async streamStoredFile(fileUrl: string) {
    if (isBlobUrl(fileUrl)) {
      const url = await blobGetDownloadUrl(fileUrl);
      return fetch(url);
    }
    const object = await this.getS3Object(fileUrl);
    const body = object.Body;
    if (!body) throw new Error("Empty file");
    const headers = new Headers();
    if (object.ContentType) headers.set("Content-Type", object.ContentType);
    if (object.ContentLength != null) headers.set("Content-Length", String(object.ContentLength));
    headers.set("Cache-Control", "private, max-age=60");
    const stream = typeof body.transformToWebStream === "function"
      ? body.transformToWebStream()
      : (body as ReadableStream);
    return new Response(stream, { headers });
  }

  static async readStoredBytes(fileUrl: string): Promise<Uint8Array> {
    if (isBlobUrl(fileUrl)) {
      const url = await blobGetDownloadUrl(fileUrl);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Uploaded image could not be read");
      return new Uint8Array(await res.arrayBuffer());
    }
    const object = await this.getS3Object(fileUrl);
    if (!object.Body) throw new Error("Empty file");
    return new Uint8Array(await object.Body.transformToByteArray());
  }

  static async saveDocument(params: {
    type: DocumentType;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
    eoiId?: string;
    cpId?: string;
    skipStorageCheck?: boolean;
  }) {
    if (!params.skipStorageCheck) {
      const exists = await this.objectExists(params.fileUrl);
      if (!exists) throw new Error("Uploaded file not found in storage");
    }

    return prisma.document.create({
      data: {
        type: params.type,
        fileName: params.fileName,
        fileUrl: params.fileUrl,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        eoiId: params.eoiId,
        cpId: params.cpId,
      },
    });
  }

  static async getDocumentsByEOI(eoiId: string) {
    return prisma.document.findMany({ where: { eoiId }, orderBy: { uploadedAt: "desc" } });
  }

  static async deleteDocument(id: string) {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return null;
    if (isBlobUrl(doc.fileUrl)) {
      await blobDelete(doc.fileUrl);
    } else {
      await this.deleteS3Keys(doc.fileUrl);
    }
    return prisma.document.delete({ where: { id } });
  }
}
