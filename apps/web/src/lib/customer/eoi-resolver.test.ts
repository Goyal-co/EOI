import { describe, expect, it } from "vitest";
import { resolveCustomerEoi } from "./eoi-resolver";

// Unit tests for resolver logic use mocked prisma in integration/e2e.
// Smoke test: exported functions exist.

describe("eoi-resolver", () => {
  it("exports resolveCustomerEoi", () => {
    expect(typeof resolveCustomerEoi).toBe("function");
  });
});
