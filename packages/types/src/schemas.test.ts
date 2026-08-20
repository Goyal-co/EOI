import { describe, expect, it } from "vitest";
import { documentUploadSchema, projectAssetSchema, projectSchema } from "./schemas";

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

describe("projectSchema (Add Project)", () => {
  it("accepts a normal create payload with numeric price and tags", () => {
    const parsed = projectSchema.safeParse({
      name: "Hariyana Heights",
      location: "Gurgaon",
      locationLink: "https://maps.google.com/?q=gurgaon",
      startingPrice: 12500,
      eoiStatus: "OPEN",
      status: "ACTIVE",
      tags: ["New Launch", "Under Construction"],
      amenities: ["Club House"],
      faqs: [{ question: "Possession?", answer: "2028" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("coerces string price instead of throwing Expected number", () => {
    const parsed = projectSchema.safeParse({
      name: "Hariyana Heights",
      location: "Gurgaon",
      startingPrice: "12500",
      tags: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.startingPrice).toBe(12500);
  });

  it("allows empty location link", () => {
    const parsed = projectSchema.safeParse({
      name: "Hariyana Heights",
      location: "Gurgaon",
      locationLink: "",
      startingPrice: 1000,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid location link with a clear message", () => {
    const parsed = projectSchema.safeParse({
      name: "Hariyana Heights",
      location: "Gurgaon",
      locationLink: "not-a-url",
      startingPrice: 1000,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.errors[0].message).toContain("valid URL");
    }
  });
});
