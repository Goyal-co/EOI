import { describe, it, expect } from "vitest";
import { canTransitionEOI, EOI_TRANSITIONS } from "./enums";

describe("canTransitionEOI", () => {
  it("allows DRAFT to SUBMITTED", () => {
    expect(canTransitionEOI("DRAFT", "SUBMITTED")).toBe(true);
  });

  it("allows SUBMITTED to APPROVED", () => {
    expect(canTransitionEOI("SUBMITTED", "APPROVED")).toBe(true);
  });

  it("allows SUBMITTED to REJECTED", () => {
    expect(canTransitionEOI("SUBMITTED", "REJECTED")).toBe(true);
  });

  it("blocks APPROVED to DRAFT", () => {
    expect(canTransitionEOI("APPROVED", "DRAFT")).toBe(false);
  });

  it("blocks REJECTED to any status", () => {
    expect(EOI_TRANSITIONS.REJECTED).toEqual([]);
    expect(canTransitionEOI("REJECTED", "DRAFT")).toBe(false);
  });

  it("allows CORRECTION_REQUESTED back to SUBMITTED", () => {
    expect(canTransitionEOI("CORRECTION_REQUESTED", "SUBMITTED")).toBe(true);
  });
});
