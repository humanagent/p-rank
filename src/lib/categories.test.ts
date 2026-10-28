import { describe, expect, test } from "bun:test";
import { bandLabel, bandOf, distance, drawsFor, withinOne } from "./categories";

describe("categories", () => {
  test("bandOf takes min as best, max as worst", () => {
    expect(bandOf([5, 4, 5])).toEqual({ best: 4, worst: 5 });
    expect(bandOf([6])).toEqual({ best: 6, worst: 6 });
  });
  test("withinOne: exactly best-1 and worst+1 are within, best-2 and worst+2 are not", () => {
    const band = { best: 4, worst: 5 } as const;
    expect(withinOne(3, band)).toBe(true);
    expect(withinOne(6, band)).toBe(true);
    expect(withinOne(2, band)).toBe(false);
    expect(withinOne(7, band)).toBe(false);
  });
  test("drawsFor stays inside 7..2, ordered 7 -> 2", () => {
    expect(drawsFor({ best: 4, worst: 5 })).toEqual([6, 5, 4, 3]);
    expect(drawsFor({ best: 7, worst: 7 })).toEqual([7, 6]); // 7th lower edge: no 8th
    expect(drawsFor({ best: 1, worst: 2 })).toEqual([3, 2]); // no 1st draw
  });
  test("distance", () => {
    const band = { best: 4, worst: 5 } as const;
    expect(distance(4, band)).toBe(0);
    expect(distance(5, band)).toBe(0);
    expect(distance(2, band)).toBe(2);
    expect(distance(7, band)).toBe(2);
  });
  test("bandLabel", () => {
    expect(bandLabel({ best: 4, worst: 4 })).toBe("4th");
    expect(bandLabel({ best: 4, worst: 5 })).toBe("4th / 5th");
  });
});
