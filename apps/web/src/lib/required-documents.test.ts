import { describe, it, expect } from "vitest";
import {
  normalizeRequiredDocumentType,
  resolveRequiredDocumentTypes,
  formatMissingDocumentLabels,
} from "./required-documents";

describe("required-documents", () => {
  it("maps human-readable labels to document types", () => {
    expect(normalizeRequiredDocumentType("Pan Card")).toBe("PAN");
    expect(normalizeRequiredDocumentType("Cheque")).toBe("CHEQUE");
    expect(normalizeRequiredDocumentType("Adhaar Card")).toBe("AADHAAR");
    expect(normalizeRequiredDocumentType("PAN")).toBe("PAN");
  });

  it("resolves mixed legacy and enum values", () => {
    expect(
      resolveRequiredDocumentTypes(["Cheque", "Pan Card", "Adhaar Card"])
    ).toEqual(["CHEQUE", "PAN", "AADHAAR"]);
  });

  it("formats missing document labels for errors", () => {
    expect(formatMissingDocumentLabels(["PAN", "CHEQUE"])).toBe("PAN Card, EOI Cheque");
  });
});
