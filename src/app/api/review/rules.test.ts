import { describe, expect, test } from "bun:test";
import type { Entry } from "@/shared/types";
import { applyReview, isRuleError } from "./rules";

const NOW = "2026-10-28T15:00:00.000Z";
const COACH = "coach@meridian.club";

const base = (over: Partial<Entry> = {}): Entry => ({
  id: "e1",
  email: "player@example.com",
  createdAt: "2026-10-28T12:00:00.000Z",
  clipKey: "clips/e1.mp4",
  status: "done",
  claimed: 3,
  verdict: "outside",
  analysis: { category: 5, band: { best: 5, worst: 6 }, shots: [], why: "late on the volley", samples: 3 },
  log: [],
  ...over,
});

describe("applyReview", () => {
  test("approve sets the review", () => {
    const r = applyReview(base(), "approve", COACH, NOW, " fine ");
    expect(isRuleError(r)).toBe(false);
    expect((r as Entry).review).toEqual({ decision: "approved", by: COACH, at: NOW, note: "fine" });
  });

  test("reject without a note leaves no note", () => {
    const r = applyReview(base(), "reject", COACH, NOW) as Entry;
    expect(r.review).toEqual({ decision: "rejected", by: COACH, at: NOW });
  });

  test("self-review is blocked, any action, any case", () => {
    const own = base({ email: "Coach@Meridian.club", waitlist: { category: 4, status: "waiting" } });
    for (const a of ["approve", "reject", "confirm", "decline"] as const) {
      expect(applyReview(own, a, COACH, NOW)).toEqual({ error: "Nobody reviews their own entry.", status: 403 });
    }
  });

  test("double decision is blocked", () => {
    const once = applyReview(base(), "approve", COACH, NOW) as Entry;
    const twice = applyReview(once, "reject", "other@meridian.club", NOW);
    expect(isRuleError(twice) && twice.status).toBe(409);
  });

  test("approve only from the needs-a-look state", () => {
    for (const e of [base({ status: "rating" }), base({ verdict: "within" }), base({ status: "rejected", verdict: "rejected" })]) {
      const r = applyReview(e, "approve", COACH, NOW);
      expect(isRuleError(r) && r.status).toBe(409);
    }
  });

  test("confirm only when waiting", () => {
    const waiting = base({ verdict: "within", waitlist: { category: 5, status: "waiting" } });
    const ok = applyReview(waiting, "confirm", COACH, NOW) as Entry;
    expect(ok.waitlist).toEqual({ category: 5, status: "confirmed", decided: { by: COACH, at: NOW } });

    const again = applyReview(ok, "decline", COACH, NOW);
    expect(isRuleError(again) && again.status).toBe(409);

    const none = applyReview(base(), "confirm", COACH, NOW);
    expect(isRuleError(none) && none.status).toBe(409);
  });

  test("decline sets declined and leaves the review alone", () => {
    const e = base({ waitlist: { category: 4, status: "waiting" }, review: { decision: "approved", by: COACH, at: NOW } });
    const r = applyReview(e, "decline", "head@meridian.club", NOW) as Entry;
    expect(r.waitlist?.status).toBe("declined");
    expect(r.review?.decision).toBe("approved");
  });
});
