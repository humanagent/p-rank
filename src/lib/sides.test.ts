import { describe, expect, test } from "bun:test";
import type { Box } from "../shared/types";
import { assignSides } from "./sides";

const P = {
  nl: { box: [600, 100, 950, 300] as Box, looks: "nl" },
  nr: { box: [620, 600, 900, 800] as Box, looks: "nr" },
  fl: { box: [100, 200, 400, 300] as Box, looks: "fl" },
  fr: { box: [120, 700, 380, 800] as Box, looks: "fr" },
};
const map = (out: ReturnType<typeof assignSides>) => Object.fromEntries(out.map((p) => [p.looks, p.side]));

describe("assignSides", () => {
  test("4 players in every rotation of input order get the same sides", () => {
    const all = [P.fr, P.nl, P.fl, P.nr];
    for (let i = 0; i < 4; i++) {
      const order = [...all.slice(i), ...all.slice(0, i)];
      expect(map(assignSides(order))).toEqual({ nl: "near_left", nr: "near_right", fl: "far_left", fr: "far_right" });
      expect(map(assignSides([...order].reverse()))).toEqual({ nl: "near_left", nr: "near_right", fl: "far_left", fr: "far_right" });
    }
  });
  test("near is decided by ymax (feet), not ymin: a tall far player with low ymin stays far", () => {
    const tallFar = { box: [50, 350, 500, 450] as Box, looks: "tall" }; // ymin smallest, ymax 500 < near ymax
    expect(map(assignSides([tallFar, P.nl, P.nr]))).toEqual({ nl: "near_left", nr: "near_right", tall: "far_left" });
  });
  test("1 player -> near_left", () => {
    expect(assignSides([P.fr])).toEqual([{ side: "near_left", box: P.fr.box, looks: "fr" }]);
  });
  test("3 players: lone far placed by x-center vs 500", () => {
    expect(map(assignSides([P.fr, P.nl, P.nr]))).toEqual({ nl: "near_left", nr: "near_right", fr: "far_right" });
    expect(map(assignSides([P.nr, P.fl, P.nl]))).toEqual({ nl: "near_left", nr: "near_right", fl: "far_left" });
  });
  test("drops malformed boxes", () => {
    const bad = [
      { box: [1, 2, 3] as unknown as Box, looks: "short" },
      { box: [0, 0, 1001, 10] as Box, looks: "big" },
      { box: [500, 0, 500, 10] as Box, looks: "flat" },
      { box: [-1, 0, 10, 10] as Box, looks: "neg" },
      { box: ["a", 0, 10, 10] as unknown as Box, looks: "str" },
    ];
    expect(map(assignSides([...bad, P.nl, P.fr]))).toEqual({ nl: "near_left", fr: "near_right" });
    expect(assignSides(bad)).toEqual([]);
  });
});
