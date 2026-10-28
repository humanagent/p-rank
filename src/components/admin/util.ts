import type { Entry } from "@/shared/types";
import { bandLabel, distance } from "@/lib/categories";

export type Action = "approve" | "reject" | "confirm" | "decline";

export const bandText = (e: Entry) => (e.analysis?.band ? bandLabel(e.analysis.band) : "not rated");

export function outsideText(e: Entry): string {
  const band = e.analysis?.band;
  if (!band || !e.claimed) return "not rated";
  const d = distance(e.claimed, band);
  if (d === 0) return "within";
  const dir = e.claimed < band.best ? "above" : "below";
  return `${d} ${d === 1 ? "category" : "categories"} ${dir}`;
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export async function postReview(id: string, action: Action, note?: string): Promise<Entry> {
  const res = await fetch(`/api/review/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...(note?.trim() ? { note: note.trim() } : {}) }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status}).`);
  return body as Entry;
}
