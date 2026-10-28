import type { Analysis, Category, Sample, Shot, Verdict } from "../shared/types";
import { bandOf, drawsFor, withinOne } from "./categories";

const str = (v: unknown) => (typeof v === "string" ? v : "");

function cleanShot(raw: unknown): Shot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0;
  const stroke = str(r.stroke);
  if (!stroke) return null;
  return { at, stroke, technique: str(r.technique) };
}

// Normalize one model answer. A category counts only if it is an integer 1–7 and backed by at least one shot.
export function clean(raw: unknown): Sample {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const shots = Array.isArray(r.shots) ? r.shots.map(cleanShot).filter((s): s is Shot => s !== null) : [];
  const c = r.category;
  const validCat = typeof c === "number" && Number.isInteger(c) && c >= 1 && c <= 7;
  return { shots, category: validCat && shots.length > 0 ? (c as Category) : null, why: str(r.why) };
}

// Median of the rated samples (lower-middle index, i.e. the stronger one on a tie), band = min..max.
export function merge(samples: Sample[]): Analysis {
  const rated = samples
    .filter((s): s is Sample & { category: Category } => s.category !== null)
    .sort((a, b) => a.category - b.category);
  if (rated.length === 0) return { category: null, band: null, shots: [], why: "", samples: 0 };
  const median = rated[Math.floor((rated.length - 1) / 2)];
  return {
    category: median.category,
    band: bandOf(rated.map((s) => s.category)),
    shots: median.shots,
    why: median.why,
    samples: rated.length,
  };
}

export function decide(analysis: Analysis, claimed: Category): { verdict: Verdict; draws: Category[] } {
  if (!analysis.band) return { verdict: "outside", draws: [] };
  return { verdict: withinOne(claimed, analysis.band) ? "within" : "outside", draws: drawsFor(analysis.band) };
}
