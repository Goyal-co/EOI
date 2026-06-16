import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@goyal/types";

describe("normalizeEmail for CP vs lead", () => {
  it("normalizes case and whitespace so lead and CP checks match", () => {
    expect(normalizeEmail("  Partner@Example.COM  ")).toBe("partner@example.com");
  });
});

// Integration: lead-only emails do not block CP registration (no User row).
// Covered by checkCpRegistrationEmail in API route + e2e.
