import { describe, it, expect } from "vitest";
import { mapToJourneyStatus, generateEOIReference } from "./journey";

describe("mapToJourneyStatus", () => {
  it("returns explicit journeyStatus when set", () => {
    expect(mapToJourneyStatus({ journeyStatus: "SUBMITTED" })).toBe("SUBMITTED");
  });

  it("maps EOI APPROVED to APPROVED journey", () => {
    expect(mapToJourneyStatus({ eoiStatus: "APPROVED" })).toBe("APPROVED");
  });

  it("maps EOI SUBMITTED to SUBMITTED journey", () => {
    expect(mapToJourneyStatus({ eoiStatus: "SUBMITTED" })).toBe("SUBMITTED");
  });

  it("maps pending confirmation to CONFIRMATION_PENDING", () => {
    expect(mapToJourneyStatus({ confirmationStatus: "PENDING" })).toBe("CONFIRMATION_PENDING");
  });

  it("defaults to ACTIVE", () => {
    expect(mapToJourneyStatus({})).toBe("ACTIVE");
  });
});

describe("generateEOIReference", () => {
  it("generates reference with EOI prefix and current year", () => {
    const ref = generateEOIReference();
    const year = new Date().getFullYear();
    expect(ref).toMatch(new RegExp(`^EOI-${year}-[A-Z0-9]{6}$`));
  });

  it("generates unique references", () => {
    const a = generateEOIReference();
    const b = generateEOIReference();
    expect(a).not.toBe(b);
  });
});
