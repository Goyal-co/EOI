import { describe, it, expect } from "vitest";
import { computeGrowth } from "./growth";

describe("computeGrowth", () => {
  it("returns 0 when previous is 0", () => {
    expect(computeGrowth(10, 0)).toBe(0);
  });

  it("returns positive growth percentage", () => {
    expect(computeGrowth(15, 10)).toBe(50);
  });

  it("returns negative growth percentage", () => {
    expect(computeGrowth(8, 10)).toBe(-20);
  });

  it("rounds to one decimal place", () => {
    expect(computeGrowth(11, 9)).toBe(22.2);
  });

  it("returns 0 when current equals previous", () => {
    expect(computeGrowth(5, 5)).toBe(0);
  });
});
