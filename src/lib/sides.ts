import type { Box, FoundPlayer, Side } from "../shared/types";

function validBox(b: unknown): b is Box {
  if (!Array.isArray(b) || b.length !== 4) return false;
  if (!b.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000)) return false;
  return b[0] < b[2] && b[1] < b[3];
}

const xCenter = (b: Box) => (b[1] + b[3]) / 2;
const ORDER: Side[] = ["near_left", "near_right", "far_left", "far_right"];

// The two players whose feet are lowest in the frame (largest ymax) are near; the rest far.
// Within a pair, the smaller x-center is left. A lone player on a side is placed by x-center vs 500
// (except a single player overall, who is near_left).
export function assignSides(players: { box: Box; looks: string }[]): FoundPlayer[] {
  const ok = (players ?? []).filter((p) => p && validBox(p.box)).slice(0, 4);
  if (ok.length === 0) return [];
  if (ok.length === 1) return [{ side: "near_left", box: ok[0].box, looks: ok[0].looks ?? "" }];

  const byFeet = [...ok].sort((a, b) => b.box[2] - a.box[2]);
  const near = byFeet.slice(0, 2);
  const far = byFeet.slice(2);
  const out: FoundPlayer[] = [];
  const place = (group: typeof ok, row: "near" | "far") => {
    if (group.length === 1) {
      const p = group[0];
      out.push({ side: `${row}_${xCenter(p.box) < 500 ? "left" : "right"}` as Side, box: p.box, looks: p.looks ?? "" });
      return;
    }
    const [l, r] = [...group].sort((a, b) => xCenter(a.box) - xCenter(b.box));
    out.push({ side: `${row}_left` as Side, box: l.box, looks: l.looks ?? "" });
    out.push({ side: `${row}_right` as Side, box: r.box, looks: r.looks ?? "" });
  };
  place(near, "near");
  if (far.length) place(far, "far");
  return out.sort((a, b) => ORDER.indexOf(a.side) - ORDER.indexOf(b.side));
}
