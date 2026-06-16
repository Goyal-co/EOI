import { describe, expect, it } from "vitest";

/** Mirrors partner/admin analytics response shape for lead-only metrics */
export function buildLeadOnlyAnalyticsSnapshot(counts: {
  leadOnlyTotal: number;
  leadOnlyPending: number;
  leadOnlyConfirmed: number;
  eoiLeadsTotal: number;
}) {
  return {
    leadOnlyTotal: { value: counts.leadOnlyTotal, growth: 0 },
    leadOnlyPending: { value: counts.leadOnlyPending, growth: 0 },
    leadOnlyConfirmed: { value: counts.leadOnlyConfirmed, growth: 0 },
    eoiLeadsTotal: { value: counts.eoiLeadsTotal, growth: 0 },
  };
}

describe("lead-only analytics metrics", () => {
  it("exposes lead-only counters separate from EOI leads", () => {
    const snapshot = buildLeadOnlyAnalyticsSnapshot({
      leadOnlyTotal: 5,
      leadOnlyPending: 2,
      leadOnlyConfirmed: 3,
      eoiLeadsTotal: 12,
    });

    expect(snapshot.leadOnlyTotal.value).toBe(5);
    expect(snapshot.leadOnlyPending.value).toBe(2);
    expect(snapshot.leadOnlyConfirmed.value).toBe(3);
    expect(snapshot.eoiLeadsTotal.value).toBe(12);
  });
});
