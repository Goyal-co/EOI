import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@goyal/db";
import type { DocumentType } from "@goyal/types";
import type { UserRole } from "@goyal/types";
import { getStorageMode, isBlobUrl } from "@/lib/storage/provider";
import {
  blobObjectExists,
  blobGetDownloadUrl,
  blobDelete,
} from "@/lib/storage/vercel-blob";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

const BUCKET = process.env.S3_BUCKET || "goyal-eoi-documents";

const ALLOWED_TYPES: Record<string, string[]> = {
  CHEQUE: ["image/jpeg", "image/png", "application/pdf"],
  PAN: ["image/jpeg", "image/png", "application/pdf"],
  AADHAAR: ["image/jpeg", "image/png", "application/pdf"],
  RERA_CERT: ["application/pdf"],
  VISITING_CARD: ["image/jpeg", "image/png", "application/pdf"],
  BROCHURE: ["application/pdf"],
  COST_SHEET: ["application/pdf"],
  FLOOR_PLAN: ["image/jpeg", "image/png", "application/pdf"],
  BANNER: ["image/jpeg", "image/png", "image/webp"],
  GALLERY: ["image/jpeg", "image/png", "image/webp"],
};

const ROLE_ALLOWED_DOC_TYPES: Record<UserRole, DocumentType[]> = {
  CUSTOMER: ["CHEQUE", "PAN", "AADHAAR"],
  CHANNEL_PARTNER: ["RERA_CERT", "VISITING_CARD"],
  ADMIN: ["BROCHURE", "COST_SHEET", "FLOOR_PLAN", "BANNER", "GALLERY"],
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAX_SIZE_BY_TYPE: Partial<Record<DocumentType, number>> = {
  BROCHURE: 20 * 1024 * 1024,
  FLOOR_PLAN: 20 * 1024 * 1024,
};

export function getMaxFileSizeForType(type: DocumentType): number {
  return MAX_SIZE_BY_TYPE[type] ?? MAX_FILE_SIZE;
}

export class DocumentService {
  static sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.+/g, ".").slice(0, 200);
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
    const key = `${params.folder}/${Date.now()}-${safeName}`;

    if (getStorageMode() === "blob") {
      return {
        mode: "blob" as const,
        pathname: key,
        handleUploadUrl: "/api/uploads/blob",
        key,
      };
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: params.mimeType,
      ContentLength: params.size,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    const fileUrl = process.env.S3_ENDPOINT
      ? `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`
      : `https://${BUCKET}.s3.amazonaws.com/${key}`;

    return { mode: "s3" as const, uploadUrl, fileUrl, key };
  }

  static extractKey(fileUrl: string): string {
    if (!fileUrl) return fileUrl;

    // Strip query string for parsing
    const urlWithoutQuery = fileUrl.split("?")[0];

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
    if (fileUrl.startsWith("/")) return false;
    if (isBlobUrl(fileUrl)) return true;
    if (fileUrl.startsWith("http://localhost") && !fileUrl.includes(BUCKET)) return false;
    return (
      fileUrl.includes(BUCKET)
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
    if (!this.isPrivateStorageUrl(fileUrl)) return fileUrl;
    if (!process.env.S3_ACCESS_KEY) return fileUrl;
    return this.getPresignedDownloadUrl(fileUrl);
  }

  static async objectExists(fileUrl: string): Promise<boolean> {
    if (isBlobUrl(fileUrl)) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("BLOB_READ_WRITE_TOKEN is required in production");
        }
        return true;
      }
      return blobObjectExists(fileUrl);
    }

    if (!process.env.S3_ACCESS_KEY) {
      if (process.env.NODE_ENV === "production" && getStorageMode() === "s3") {
        throw new Error("S3 credentials required in production");
      }
      return true;
    }
    try {
      const key = this.extractKey(fileUrl);
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  static async getPresignedDownloadUrl(fileUrl: string) {
    if (isBlobUrl(fileUrl)) {
      return blobGetDownloadUrl(fileUrl);
    }
    const key = this.extractKey(fileUrl);
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn: 900 });
  }

  static async saveDocument(params: {
    type: DocumentType;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
    eoiId?: string;
    cpId?: string;
  }) {
    const exists = await this.objectExists(params.fileUrl);
    if (!exists) throw new Error("Uploaded file not found in storage");

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
      const key = this.extractKey(doc.fileUrl);
      if (key) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      }
    }
    return prisma.document.delete({ where: { id } });
  }
}
