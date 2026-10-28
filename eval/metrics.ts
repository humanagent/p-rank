// Pure metric functions for the eval. No I/O, no model calls; every random step takes a seed.
import type { Analysis, Category } from "@/shared/types";
import { decide } from "@/lib/score";

// One rated player: the clip it came from, the tournament label, the 3-sample analysis and the first sample alone.
export type Unit = { clip: string; label: Category; analysis: Analysis; first: Analysis };

// mulberry32: small, fast, deterministic.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);

// Linear interpolation between closest ranks (p in 0..100).
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = xs.slice().sort((a, b) => a - b);
  const i = (p / 100) * (s.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

// Average ranks (1-based), ties share the mean rank.
export function ranks(xs: number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

// Spearman rho = Pearson correlation of the average ranks. NaN when either side is constant.
export function spearman(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN;
  const rx = ranks(x);
  const ry = ranks(y);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? NaN : num / Math.sqrt(dx * dy);
}

// Fraction of items where pred holds, over the items where applies holds. NaN if none apply.
export function rate<T>(xs: T[], pred: (x: T) => boolean, applies: (x: T) => boolean = () => true): number {
  const ys = xs.filter(applies);
  return ys.length ? ys.filter(pred).length / ys.length : NaN;
}

// "Below" = a weaker category = a higher number. null when the claim would fall past 7th.
export function claimBelow(label: Category, d: number): Category | null {
  const c = label + d;
  return c >= 1 && c <= 7 ? (c as Category) : null;
}

const exact = (a: Analysis, label: Category) => a.category === label;
const within1 = (a: Analysis, label: Category) => a.category !== null && Math.abs(a.category - label) <= 1;
const ownWithin = (a: Analysis, label: Category) => decide(a, label).verdict === "within";
const belowOutside = (a: Analysis, label: Category, d: number) => {
  const c = claimBelow(label, d);
  return c !== null && decide(a, c).verdict === "outside";
};

export type Pick = "analysis" | "first";
export const METRICS = ["exact", "within1", "ownWithin", "below2Outside"] as const;
export type Metric = (typeof METRICS)[number];

export function metric(units: Unit[], m: Metric, pick: Pick = "analysis"): number {
  const a = (u: Unit) => u[pick];
  switch (m) {
    case "exact":
      return rate(units, (u) => exact(a(u), u.label));
    case "within1":
      return rate(units, (u) => within1(a(u), u.label));
    case "ownWithin":
      return rate(units, (u) => ownWithin(a(u), u.label));
    case "below2Outside":
      return rate(units, (u) => belowOutside(a(u), u.label, 2), (u) => claimBelow(u.label, 2) !== null);
  }
}

// % outside the band when each player claims d categories below their label (only labels where that claim exists).
export function byDistance(units: Unit[], pick: Pick = "analysis"): { d: number; n: number; outside: number }[] {
  return [1, 2, 3, 4, 5, 6].map((d) => {
    const ok = units.filter((u) => claimBelow(u.label, d) !== null);
    return { d, n: ok.length, outside: rate(ok, (u) => belowOutside(u[pick], u.label, d)) };
  });
}

// A fixed answer for every player, e.g. "7th to everyone".
export function constantAnalysis(c: Category): Analysis {
  return { category: c, band: { best: c, worst: c }, shots: [], why: "", samples: 1 };
}

const groupByClip = (units: Unit[]): Unit[][] => {
  const m = new Map<string, Unit[]>();
  for (const u of units) m.set(u.clip, [...(m.get(u.clip) ?? []), u]);
  return [...m.values()];
};

// 95% percentile bootstrap, resampling clips (players of one clip move together).
export function bootstrapCI(
  units: Unit[],
  stat: (us: Unit[]) => number,
  n = 2000,
  seed = 1,
): { lo: number; hi: number } {
  const groups = groupByClip(units);
  if (groups.length === 0) return { lo: NaN, hi: NaN };
  const rand = rng(seed);
  const vals: number[] = [];
  for (let i = 0; i < n; i++) {
    const sample: Unit[] = [];
    for (let k = 0; k < groups.length; k++) sample.push(...groups[Math.floor(rand() * groups.length)]);
    const v = stat(sample);
    if (!Number.isNaN(v)) vals.push(v);
  }
  return { lo: percentile(vals, 2.5), hi: percentile(vals, 97.5) };
}

// Control: shuffle the labels across clips (players of one clip keep a shared label), recompute, n times.
export function shuffleControl(
  units: Unit[],
  stat: (us: Unit[]) => number,
  n = 1000,
  seed = 2,
): { mean: number; lo: number; hi: number } {
  const groups = groupByClip(units);
  const labels = groups.map((g) => g[0].label);
  const rand = rng(seed);
  const vals: number[] = [];
  for (let i = 0; i < n; i++) {
    const shuffled = shuffle(labels, rand);
    const v = stat(groups.flatMap((g, k) => g.map((u) => ({ ...u, label: shuffled[k] }))));
    if (!Number.isNaN(v)) vals.push(v);
  }
  return { mean: mean(vals), lo: percentile(vals, 2.5), hi: percentile(vals, 97.5) };
}
