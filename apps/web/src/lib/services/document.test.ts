import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { DocumentService } from "./document";

describe("DocumentService.extractKey", () => {
  const originalBucket = process.env.S3_BUCKET;

  beforeEach(() => {
    process.env.S3_BUCKET = "goyal-eoi-documents";
  });

  afterEach(() => {
    process.env.S3_BUCKET = originalBucket;
  });

  it("extracts key from path-style MinIO URL", () => {
    const url = "http://localhost:9000/goyal-eoi-documents/admin/user1/brochure.pdf";
    expect(DocumentService.extractKey(url)).toBe("admin/user1/brochure.pdf");
  });

  it("extracts key from virtual-hosted S3 URL", () => {
    const url = "https://goyal-eoi-documents.s3.amazonaws.com/admin/user1/brochure.pdf";
    expect(DocumentService.extractKey(url)).toBe("admin/user1/brochure.pdf");
  });

  it("strips query string from presigned URLs", () => {
    const url = "http://localhost:9000/goyal-eoi-documents/admin/file.pdf?X-Amz-Signature=abc";
    expect(DocumentService.extractKey(url)).toBe("admin/file.pdf");
  });

  it("returns relative paths as keys", () => {
    expect(DocumentService.extractKey("/images/projects/banner.jpg")).toBe("images/projects/banner.jpg");
  });

  it("extracts key from same-origin /api/files proxy URLs", () => {
    expect(DocumentService.extractKey("/api/files/eoi/admin/user1/banner.jpg")).toBe("eoi/admin/user1/banner.jpg");
  });

  it("tries the eoi/ prefix first for older DB URLs that omitted it", () => {
    const previous = process.env.S3_PREFIX;
    delete process.env.S3_PREFIX;
    try {
      expect(DocumentService.storageKeys("/api/files/customer/user1/pan/file.pdf")).toEqual([
        "eoi/customer/user1/pan/file.pdf",
        "customer/user1/pan/file.pdf",
      ]);
      expect(DocumentService.storageKeys("/api/files/eoi/customer/user1/pan/file.pdf")).toEqual([
        "eoi/customer/user1/pan/file.pdf",
      ]);
    } finally {
      if (previous === undefined) delete process.env.S3_PREFIX;
      else process.env.S3_PREFIX = previous;
    }
  });

  it("does not rewrite public static image paths into the bucket", () => {
    expect(DocumentService.isPrivateStorageUrl("/images/projects/banner.jpg")).toBe(false);
  });
});

describe("DocumentService.isPrivateStorageUrl", () => {
  it("treats /api/files proxy URLs as private", () => {
    expect(DocumentService.isPrivateStorageUrl("/api/files/eoi/admin/file.pdf")).toBe(true);
  });

  it("treats bucket URLs as private", () => {
    expect(DocumentService.isPrivateStorageUrl("http://localhost:9000/goyal-eoi-documents/file.pdf")).toBe(true);
  });

  it("treats Vercel Blob URLs as private", () => {
    expect(DocumentService.isPrivateStorageUrl("https://abc.public.blob.vercel-storage.com/file.pdf")).toBe(true);
  });
});
