// Scores the cached answers of one set and writes its REPORT.md and summary.json: eval/dev/ or eval/test/.
// Usage: bun eval/report.ts <dev|test>   (no model calls; every number comes from the cache)
// dev is what every change was tuned on; test is run once with the final prompts and reported apart.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { withinOne } from "@/lib/categories";
import type { Band, Category, Sample, Side } from "@/shared/types";
import { merge } from "@/lib/score";

// results.jsonl is the product as it runs: the detection, then each found player rated on their own.
type Row = { id: string; category: Category | null; isPadel: boolean; reason: string; players: { side: Side; seconds: number; samples: Sample[] }[] };
type Flag = { flag: boolean; direction: string; evidence: { at: number; what: string }[] };
// results-contradiction.jsonl: the ablation that shows the model the claim and asks for contradictions.
type FlagRow = { id: string; category: Category; players: { side: Side; honest: Flag; lowClaim: Flag | null }[] };
// Every found player counts; one the model could not rate has no category and goes to a coach.
type Player = { clip: string; label: Category; category: Category | null; band: Band | null };
type Flagged = { clip: string; label: Category; honestFlagged: boolean; lowClaimFlagged: boolean | null };

const read = async <T>(file: string): Promise<T[]> =>
  existsSync(file) ? (await readFile(file, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];

const SET = process.argv[2] === "test" ? "test" : "dev";
const DIR = `eval/${SET}`;
const SECONDS = process.env.CLIP_SECONDS ?? "30";
const rows = await read<Row>(`${DIR}/results.jsonl`);
const flagRows = await read<FlagRow>(`${DIR}/results-contradiction.jsonl`);
const padel = rows.filter((r) => r.category !== null);
const negatives = rows.filter((r) => r.category === null);

// Seeded RNG so the intervals and the shuffled control are the same on every run.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

function playersOf(rs: Row[], pick = (s: Sample[]) => s, labelOf = (r: Row) => r.category!): Player[] {
  return rs
    .filter((r) => r.isPadel)
    .flatMap((r) => r.players.map((p) => ({ clip: r.id, label: labelOf(r), ...merge(pick(p.samples)) })));
}

type Metric<T> = (ps: T[]) => number;
const share =
  <T>(test: (p: T) => boolean): Metric<T> =>
  (ps) =>
    ps.length ? ps.filter(test).length / ps.length : NaN;

const exact = share<Player>((p) => p.category === p.label);
const nearOne = share<Player>((p) => p.category !== null && Math.abs(p.category - p.label) <= 1);
// The product's comparison, from the entrant's side: an honest claim is within one of the band.
const honestPasses = share<Player>((p) => !!p.band && withinOne(p.label, p.band));
// A low claim: a player claims two categories below their level (a 3rd entering the 5th draw). Caught = outside the band.
const lowClaimCaught: Metric<Player> = (ps) =>
  share<Player>((p) => !p.band || !withinOne((p.label + 2) as Category, p.band))(ps.filter((p) => p.label + 2 <= 7));
// The same two questions for the ablation: a flag on an honest claim is a miss, a flag on a low claim a catch.
const flagHonestPasses = share<Flagged>((p) => !p.honestFlagged);
const flagLowClaimCaught: Metric<Flagged> = (ps) => share<Flagged>((p) => !!p.lowClaimFlagged)(ps.filter((p) => p.lowClaimFlagged !== null));

function spearman(ps: Player[]): number {
  const rated = ps.filter((p) => p.category !== null);
  const rank = (xs: number[]) => {
    const sorted = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(xs.length);
    for (let i = 0; i < sorted.length; ) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1][0] === sorted[i][0]) j++;
      for (let k = i; k <= j; k++) r[sorted[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const a = rank(rated.map((p) => p.category!));
  const b = rank(rated.map((p) => p.label));
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(a), mb = mean(b);
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const sd = (xs: number[], m: number) => Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0));
  return cov / (sd(a, ma) * sd(b, mb));
}

// 95% interval by resampling whole clips (the four players of a clip share a label, so they are not independent).
function interval<T extends { clip: string }>(ps: T[], metric: Metric<T>): [number, number] {
  const byClip = Object.values(Object.groupBy(ps, (p) => p.clip)) as T[][];
  const stats = Array.from({ length: 2000 }, () =>
    metric(Array.from({ length: byClip.length }, () => byClip[Math.floor(rand() * byClip.length)]).flat()),
  )
    .filter((x) => !isNaN(x))
    .sort((a, b) => a - b);
  return [stats[Math.floor(stats.length * 0.025)], stats[Math.floor(stats.length * 0.975)]];
}

const pct = (x: number) => (isNaN(x) ? "–" : `${Math.round(x * 100)}%`);
const cell = <T extends { clip: string }>(ps: T[], m: Metric<T>) => {
  if (!ps.length) return "–";
  const [lo, hi] = interval(ps, m);
  return `${pct(m(ps))} (${pct(lo)}–${pct(hi)})`;
};

// Configurations, all from cached answers.
const production = playersOf(padel);
const oneSample = playersOf(padel, (s) => s.slice(0, 1));
// The control: P-Rank's real answers scored against labels shuffled across clips, 1000 times. One shuffle of a few
// clips can land high or low by luck, so the row is the mean over shuffles and the interval their 2.5–97.5 percentiles.
const shuffles = Array.from({ length: 1000 }, () => {
  const labels = padel.map((r) => r.category!).sort(() => rand() - 0.5);
  const byId = new Map(padel.map((r, i) => [r.id, labels[i]]));
  return playersOf(padel, undefined, (r) => byId.get(r.id)!);
});
const overShuffles = (m: Metric<Player>) => {
  const xs = shuffles.map(m).filter((x) => !isNaN(x)).sort((a, b) => a - b);
  if (!xs.length) return "–";
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return `${pct(mean)} (${pct(xs[Math.floor(xs.length * 0.025)])}–${pct(xs[Math.floor(xs.length * 0.975)])})`;
};
const flagged: Flagged[] = flagRows.flatMap((r) =>
  r.players.map((p) => ({ clip: r.id, label: r.category, honestFlagged: p.honest.flag, lowClaimFlagged: p.lowClaim ? p.lowClaim.flag : null })),
);

// Baseline: say the most common label to everyone, without looking.
const counts = new Map<Category, number>();
for (const p of production) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);
const mode = [...counts].sort((a, b) => b[1] - a[1])[0][0];
const baseline: Player[] = production.map((p) => ({ ...p, category: mode, band: { best: mode, worst: mode } }));

// What the entrant waits for after "Verify me": one player's rating (detection already ran during "who are you").
const seconds = rows.flatMap((r) => r.players.map((p) => p.seconds)).sort((a, b) => a - b);
const quantile = (q: number) => seconds[Math.floor(q * (seconds.length - 1))].toFixed(1);
const amateurs = production.filter((p) => p.label >= 2);

const row = (name: string, ps: Player[]) => ({
  name,
  exact: cell(ps, exact),
  withinOne: cell(ps, nearOne),
  honestPasses: cell(ps, honestPasses),
  lowClaimCaught: cell(ps, lowClaimCaught),
});
// Each cell once: the intervals are resampled, so the report and the summary must share them.
const table = [
  row("**Production: clothes, shot by shot, 3 samples**", production),
  row("1 sample instead of 3", oneSample),
  ...(flagged.length
    ? [{ name: "Ablation: claim shown, flag contradictions", exact: "–", withinOne: "–", honestPasses: cell(flagged, flagHonestPasses), lowClaimCaught: cell(flagged, flagLowClaimCaught) }]
    : []),
  row(`Baseline: say ${mode} to everyone`, baseline),
  {
    name: "Control: shuffled labels (mean of 1000 shuffles)",
    exact: overShuffles(exact),
    withinOne: overShuffles(nearOne),
    honestPasses: overShuffles(honestPasses),
    lowClaimCaught: overShuffles(lowClaimCaught),
  },
];

const rejected = (r: Row) => !r.isPadel;
// The same low claim at every distance: a band does not depend on the claim, so this needs no model calls.
const distances = [1, 2, 3, 4, 5, 6]
  .map((below) => {
    const eligible = production.filter((p) => p.label + below <= 7);
    const outside = eligible.filter((p) => !p.band || !withinOne((p.label + below) as Category, p.band)).length;
    return { below, outside, of: eligible.length };
  })
  .filter((d) => d.of > 0);
const byDistance = distances.map((d) => `| ${d.below} below | ${d.outside} of ${d.of} (${pct(d.outside / d.of)}) |`);
const rated = production.filter((p) => p.category !== null).length;

const report = `# Accuracy · ${SET} set

Generated by \`bun eval/report.ts ${SET}\` from \`${DIR}/results.jsonl\` (${rows.length} clips, model answers cached).

**Data.** ${padel.length} public padel clips (${SECONDS} s each) and ${negatives.length} negatives. Every player in a clip gets the
tournament category in the video title. ${production.length} players found, ${rated} rated; a player the model could not rate
counts as outside the band. Intervals: 95%, bootstrap over clips; for the control, the spread over shuffles.

| config | exact | within ±1 | claims their own category: within the band | claims 2 below their category: outside the band |
|---|---|---|---|---|
${table.map((t) => `| ${t.name} | ${t.exact} | ${t.withinOne} | ${t.honestPasses} | ${t.lowClaimCaught} |`).join("\n")}

The ablation's columns: own category not flagged, 2 below flagged.

**Claims below their category, by distance** (production): how often the claim lands outside the band.

| claims | outside the band |
|---|---|
${byDistance.join("\n")}

**Ranking.** Spearman between P-Rank's category and the label: ${spearman(production).toFixed(2)} (all players),
${spearman(amateurs).toFixed(2)} (amateurs, 7th to 2nd).

**Not-padel gate.** ${negatives.filter(rejected).length} of ${negatives.length} negatives rejected; ${padel.filter(rejected).length} of ${padel.length} padel clips wrongly rejected${
  padel.some(rejected) ? `: ${padel.filter(rejected).map((r) => `${r.id} (${r.reason ?? "no reason"})`).join("; ")}` : ""
}.

**Latency after "Verify me"** (one player, 3 rating calls in parallel): p50 ${seconds.length ? quantile(0.5) : "–"} s, p90 ${seconds.length ? quantile(0.9) : "–"} s.

## Per clip

| clip | label | P-Rank band per player |
|---|---|---|
${padel
  .map((r) => {
    const bands = r.players.map((p) => merge(p.samples).band).map((b) => (b ? `${b.best}–${b.worst}` : "–")).join(", ");
    return `| ${r.id} | ${r.category} | ${r.isPadel ? bands : "rejected as not padel"} |`;
  })
  .join("\n")}
`;

// The figures the app and the canvas quote, so they are never typed by hand.
const summary = {
  clips: rows.length,
  players: production.length,
  rated,
  exact: pct(exact(production)),
  withinOne: pct(nearOne(production)),
  honestPasses: pct(honestPasses(production)),
  lowClaimCaught: pct(lowClaimCaught(production)),
  baseline: { label: mode, exact: pct(exact(baseline)), withinOne: pct(nearOne(baseline)), lowClaimCaught: pct(lowClaimCaught(baseline)) },
  negativesRejected: `${negatives.filter(rejected).length} of ${negatives.length}`,
  padelWronglyRejected: `${padel.filter(rejected).length} of ${padel.length}`,
  spearmanAll: Number(spearman(production).toFixed(2)),
  spearmanAmateurs: Number(spearman(amateurs).toFixed(2)),
  secondsP50: seconds.length ? Number(quantile(0.5)) : null,
  secondsP90: seconds.length ? Number(quantile(0.9)) : null,
  byDistance: distances,
  table: table.map((t) => ({ ...t, name: t.name.replace(/\*/g, "") })),
};

await writeFile(`${DIR}/REPORT.md`, report);
await writeFile(`${DIR}/summary.json`, JSON.stringify(summary, null, 2) + "\n");
console.log(report);
