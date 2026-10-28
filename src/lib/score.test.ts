import { describe, expect, test } from "bun:test";
import type { Analysis, Sample } from "../shared/types";
import { clean, decide, merge } from "./score";

const shot = { at: 1, stroke: "bandeja", technique: "closed face" };
const s = (category: Sample["category"], why = `w${category}`): Sample => ({ shots: [{ ...shot, technique: why }], category, why });

describe("clean", () => {
  test("valid sample passes through", () => {
    expect(clean({ shots: [shot], category: 4, why: "ok" })).toEqual({ shots: [shot], category: 4, why: "ok" });
  });
  test("category out of range, non-integer or string -> null", () => {
    for (const c of [0, 8, 4.5, "4", null, undefined]) expect(clean({ shots: [shot], category: c, why: "" }).category).toBeNull();
  });
  test("no shots -> category null even with a valid number", () => {
    expect(clean({ shots: [], category: 4 }).category).toBeNull();
    expect(clean({ category: 4 }).category).toBeNull();
  });
  test("garbage input does not throw", () => {
    expect(clean(null)).toEqual({ shots: [], category: null, why: "" });
    expect(clean("x")).toEqual({ shots: [], category: null, why: "" });
  });
});

describe("merge", () => {
  test("all three unrated -> no category, no band, 0 samples", () => {
    const a = merge([s(null), s(null), s(null)]);
    expect(a).toMatchObject({ category: null, band: null, samples: 0 });
  });
  test("2 of 3 rated: median of two picks the stronger (lower index), band spans both", () => {
    const a = merge([s(6), s(null), s(5)]);
    expect(a.category).toBe(5);
    expect(a.band).toEqual({ best: 5, worst: 6 });
    expect(a.samples).toBe(2);
    expect(a.why).toBe("w5");
  });
  test("3 rated, unsorted input: middle value and its shots/why", () => {
    const a = merge([s(6), s(3), s(4)]);
    expect(a.category).toBe(4);
    expect(a.band).toEqual({ best: 3, worst: 6 });
    expect(a.shots[0].technique).toBe("w4");
  });
});

describe("decide", () => {
  const an = (best: number, worst: number): Analysis => ({ category: best as 4, band: { best: best as 4, worst: worst as 5 }, shots: [], why: "", samples: 3 });
  test("not rated -> outside, no draws", () => {
    expect(decide({ category: null, band: null, shots: [], why: "", samples: 0 }, 4)).toEqual({ verdict: "outside", draws: [] });
  });
  test("band edges: best-1 and worst+1 within, best-2 outside", () => {
    expect(decide(an(4, 5), 3).verdict).toBe("within");
    expect(decide(an(4, 5), 6).verdict).toBe("within");
    expect(decide(an(4, 5), 2).verdict).toBe("outside");
    expect(decide(an(4, 5), 7).verdict).toBe("outside");
  });
  test("outside still gets the draws P-Rank accepts", () => {
    expect(decide(an(4, 5), 2).draws).toEqual([6, 5, 4, 3]);
  });
  test("7th lower edge: claim 7 with band 6 is within, draws 7 -> 5", () => {
    expect(decide(an(6, 6), 7)).toEqual({ verdict: "within", draws: [7, 6, 5] });
  });
});
