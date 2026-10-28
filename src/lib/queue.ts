import { type Category, DRAWS, type Entry } from "../shared/types";
import { distance } from "./categories";

const time = (e: Entry) => Date.parse(e.createdAt) || 0;

// How far the claim sits from the band; not rated (or no claim) sorts first.
function priority(e: Entry): number {
  const band = e.analysis?.band;
  if (!band || e.claimed === undefined) return Number.POSITIVE_INFINITY;
  return distance(e.claimed, band);
}

// `viewer` is accepted for the API's sake; self-review is blocked there, not here.
export function reviewQueue(
  entries: Entry[],
  _viewer: string,
): { needsLook: Entry[]; waitlist: { category: Category; entries: Entry[] }[]; decided: Entry[] } {
  const needsLook = entries
    .filter((e) => e.status === "done" && !e.review && e.verdict === "outside")
    .sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pb > pa ? 1 : -1;
      return time(a) - time(b);
    });

  const waiting = entries.filter((e) => e.waitlist?.status === "waiting");
  const waitlist = DRAWS.map((category) => ({
    category,
    entries: waiting.filter((e) => e.waitlist!.category === category).sort((a, b) => time(a) - time(b)),
  })).filter((g) => g.entries.length > 0);

  const decided = entries
    .filter((e) => e.review || e.waitlist?.decided || (e.waitlist && e.waitlist.status !== "waiting"))
    .sort((a, b) => time(b) - time(a));

  return { needsLook, waitlist, decided };
}
