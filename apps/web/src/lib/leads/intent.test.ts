import { describe, expect, it } from "vitest";
import { journeyStatusOnLeadOnlyAccept, resolveLeadIntent } from "./intent";

describe("resolveLeadIntent", () => {
  it("forces LEAD_ONLY on CLOSED projects", () => {
    expect(resolveLeadIntent("CLOSED")).toEqual({ intentType: "LEAD_ONLY" });
    expect(resolveLeadIntent("CLOSED", "LEAD_ONLY")).toEqual({ intentType: "LEAD_ONLY" });
  });

  it("rejects EOI on CLOSED projects", () => {
    expect(resolveLeadIntent("CLOSED", "EOI")).toEqual({
      error: "EOI submission is closed for this project. Use Punch Lead instead.",
      status: 400,
    });
  });

  it("defaults to EOI on OPEN projects", () => {
    expect(resolveLeadIntent("OPEN")).toEqual({ intentType: "EOI" });
  });

  it("rejects LEAD_ONLY on OPEN projects", () => {
    expect(resolveLeadIntent("OPEN", "LEAD_ONLY")).toEqual({
      error: "Lead-only punching is only available for EOI closed projects",
      status: 400,
    });
  });
});

describe("journeyStatusOnLeadOnlyAccept", () => {
  it("returns LEAD_CONFIRMED terminal status", () => {
    expect(journeyStatusOnLeadOnlyAccept()).toBe("LEAD_CONFIRMED");
  });
});
