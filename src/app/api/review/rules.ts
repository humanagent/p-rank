// The admin desk's state rules, pure so they can be tested without a store or a session.
import type { Entry } from "@/shared/types";

export type ReviewAction = "approve" | "reject" | "confirm" | "decline";
export const ACTIONS: ReviewAction[] = ["approve", "reject", "confirm", "decline"];
export type RuleError = { error: string; status: number };

export const isAction = (a: unknown): a is ReviewAction => typeof a === "string" && (ACTIONS as string[]).includes(a);

// Same predicate as the "Needs a look" list in src/lib/queue.ts.
export const needsLook = (e: Entry) => e.status === "done" && !e.review && e.verdict === "outside";

export function applyReview(entry: Entry, action: ReviewAction, by: string, now: string, note?: string): Entry | RuleError {
  if (entry.email.trim().toLowerCase() === by.trim().toLowerCase()) {
    return { error: "Nobody reviews their own entry.", status: 403 };
  }
  if (action === "approve" || action === "reject") {
    if (entry.review) return { error: "This entry already has a decision.", status: 409 };
    if (!needsLook(entry)) return { error: "This entry is not waiting for a look.", status: 409 };
    const clean = note?.trim().slice(0, 500);
    return {
      ...entry,
      review: { decision: action === "approve" ? "approved" : "rejected", by, at: now, ...(clean ? { note: clean } : {}) },
    };
  }
  if (!entry.waitlist) return { error: "This entry is not on a waitlist.", status: 409 };
  if (entry.waitlist.status !== "waiting") return { error: "This waitlist spot is already decided.", status: 409 };
  return {
    ...entry,
    waitlist: { ...entry.waitlist, status: action === "confirm" ? "confirmed" : "declined", decided: { by, at: now } },
  };
}

export const isRuleError = (r: Entry | RuleError): r is RuleError => "error" in r && "status" in r && !("id" in r);

export const PAST: Record<ReviewAction, string> = {
  approve: "approved",
  reject: "rejected",
  confirm: "confirmed",
  decline: "declined",
};
