import { describe, expect, test } from "bun:test";
import type { Category, Entry } from "../shared/types";
import { reviewQueue } from "./queue";

let n = 0;
const e = (over: Partial<Entry>): Entry => ({
  id: `e${++n}`, email: "a@x.com", createdAt: `2026-10-28T10:${String(n).padStart(2, "0")}:00Z`, clipKey: "k", status: "done", log: [], ...over,
});
const rated = (best: Category, worst: Category, claimed: Category, over: Partial<Entry> = {}) =>
  e({ claimed, verdict: "outside", analysis: { category: best, band: { best, worst }, shots: [], why: "", samples: 3 }, ...over });

describe("reviewQueue", () => {
  test("needsLook: not rated first, then by distance desc, FIFO within a priority", () => {
    const far1 = rated(5, 5, 2, { createdAt: "2026-10-28T09:00:00Z", id: "far-old" }); // distance 3
    const near = rated(4, 4, 2, { createdAt: "2026-10-28T08:00:00Z", id: "near" }); // distance 2
    const far2 = rated(5, 5, 2, { createdAt: "2026-10-28T09:30:00Z", id: "far-new" });
    const unrated = e({ id: "unrated", claimed: 4, verdict: "outside", analysis: { category: null, band: null, shots: [], why: "", samples: 0 }, createdAt: "2026-10-28T11:00:00Z" });
    const { needsLook } = reviewQueue([near, far2, unrated, far1], "club@x.com");
    expect(needsLook.map((x) => x.id)).toEqual(["unrated", "far-old", "far-new", "near"]);
  });
  test("needsLook excludes within, reviewed, not done", () => {
    const within = rated(4, 4, 4, { verdict: "within" });
    const reviewed = rated(5, 5, 2, { review: { by: "c", at: "t", decision: "approved" } });
    const rating = rated(5, 5, 2, { status: "rating" });
    const own = rated(5, 5, 2, { email: "club@x.com", id: "own" });
    const q = reviewQueue([within, reviewed, rating, own], "club@x.com");
    expect(q.needsLook.map((x) => x.id)).toEqual(["own"]);
    expect(q.decided.map((x) => x.id)).toEqual([reviewed.id]);
  });
  test("waitlist grouped in draw order 7 -> 2, oldest first; decided newest first", () => {
    const w5b = e({ id: "w5b", createdAt: "2026-10-28T12:00:00Z", waitlist: { category: 5, status: "waiting" } });
    const w3 = e({ id: "w3", createdAt: "2026-10-28T10:00:00Z", waitlist: { category: 3, status: "waiting" } });
    const w5a = e({ id: "w5a", createdAt: "2026-10-28T11:00:00Z", waitlist: { category: 5, status: "waiting" } });
    const conf = e({ id: "conf", createdAt: "2026-10-28T09:00:00Z", waitlist: { category: 5, status: "confirmed", decided: { by: "c", at: "t" } } });
    const rev = rated(5, 5, 2, { id: "rev", createdAt: "2026-10-28T13:00:00Z", review: { by: "c", at: "t", decision: "rejected" } });
    const q = reviewQueue([w3, w5b, conf, w5a, rev], "club@x.com");
    expect(q.waitlist.map((g) => [g.category, g.entries.map((x) => x.id)])).toEqual([[5, ["w5a", "w5b"]], [3, ["w3"]]]);
    expect(q.decided.map((x) => x.id)).toEqual(["rev", "conf"]);
  });
});
