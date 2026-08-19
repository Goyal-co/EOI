import { describe, expect, it } from "vitest";
import { documentUploadSchema, projectAssetSchema } from "./schemas";

const apiFilesUrl = "/api/files/eoi/admin/user1/brochure.pdf";

describe("stored file URL validation", () => {
  it("accepts same-origin /api/files paths for project assets", () => {
    const parsed = projectAssetSchema.safeParse({
      type: "BROCHURE",
      fileName: "brochure.pdf",
      fileUrl: apiFilesUrl,
      fileSize: 1024,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects bare relative paths for project assets", () => {
    const parsed = projectAssetSchema.safeParse({
      type: "GALLERY",
      fileName: "photo.jpg",
      fileUrl: "images/photo.jpg",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts same-origin /api/files paths for document uploads", () => {
    const parsed = documentUploadSchema.safeParse({
      type: "PAN",
      fileName: "pan.pdf",
      fileUrl: apiFilesUrl,
    });
    expect(parsed.success).toBe(true);
  });
});
