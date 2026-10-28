import { describe, expect, test } from "bun:test";
import type { Category } from "@/shared/types";
import {
  bootstrapCI,
  byDistance,
  claimBelow,
  constantAnalysis,
  metric,
  percentile,
  rng,
  shuffleControl,
  spearman,
  type Unit,
} from "./metrics";

const unit = (clip: string, label: Category, pred: Category): Unit => ({
  clip,
  label,
  analysis: constantAnalysis(pred),
  first: constantAnalysis(pred),
});

describe("rng", () => {
  test("same seed, same stream", () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
});

describe("spearman", () => {
  test("perfect monotone = 1, reversed = -1", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [9, 4, 1, 0])).toBeCloseTo(-1);
  });
  test("known case with ties", () => {
    // x ranks [1,2.5,2.5,4], y ranks [1,2,3,4]: rho = 4.5 / sqrt(4.5 * 5) = 0.9487
    expect(spearman([1, 2, 2, 3], [1, 2, 3, 4])).toBeCloseTo(0.9487, 4);
  });
  test("constant side is NaN", () => {
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNaN();
  });
});

describe("percentile", () => {
  test("interpolates", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([0, 10], 25)).toBe(2.5);
  });
});

const toy: Unit[] = ([7, 6, 5, 4, 3, 2, 1] as Category[]).map((c) => unit(`c${c}`, c, c));

describe("metrics on a perfect toy set", () => {
  test("all exact, own claim within, 2 below outside", () => {
    expect(metric(toy, "exact")).toBe(1);
    expect(metric(toy, "within1")).toBe(1);
    expect(metric(toy, "ownWithin")).toBe(1);
    expect(metric(toy, "below2Outside")).toBe(1);
  });
  test("by distance: 1 below is within, 2+ is outside", () => {
    const rows = byDistance(toy);
    expect(rows[0]).toEqual({ d: 1, n: 6, outside: 0 });
    expect(rows[1]).toEqual({ d: 2, n: 5, outside: 1 });
    expect(rows[5]).toEqual({ d: 6, n: 1, outside: 1 });
  });
  test("claimBelow stops at 7th", () => {
    expect(claimBelow(5, 2)).toBe(7);
    expect(claimBelow(6, 2)).toBeNull();
  });
});

describe("bootstrap", () => {
  const mixed = [...toy, unit("x1", 4, 6), unit("x2", 5, 7), unit("x3", 6, 3)];
  const stat = (us: Unit[]) => metric(us, "exact");
  test("deterministic for a seed", () => {
    expect(bootstrapCI(mixed, stat, 500, 9)).toEqual(bootstrapCI(mixed, stat, 500, 9));
  });
  test("interval contains the point estimate", () => {
    const ci = bootstrapCI(mixed, stat, 2000, 1);
    expect(ci.lo).toBeLessThanOrEqual(stat(mixed));
    expect(ci.hi).toBeGreaterThanOrEqual(stat(mixed));
  });
});

describe("shuffle control", () => {
  test("exact under shuffled labels averages near chance (1/7 for 7 distinct clips)", () => {
    const c = shuffleControl(toy, (us) => metric(us, "exact"), 4000, 3);
    expect(c.mean).toBeGreaterThan(1 / 7 - 0.02);
    expect(c.mean).toBeLessThan(1 / 7 + 0.02);
  });
});
