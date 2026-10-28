// Turns eval/<set>/results.jsonl into eval/<set>/REPORT.md and summary.json. No model calls.
//   bun eval/report.ts <dev|test>
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Category } from "@/shared/types";
import { merge } from "@/lib/score";
import type { EvalSet } from "./labels";
import type { ResultLine } from "./run";
import {
  bootstrapCI,
  byDistance,
  constantAnalysis,
  metric,
  METRICS,
  percentile,
  rate,
  shuffleControl,
  spearman,
  type Metric,
  type Pick,
  type Unit,
} from "./metrics";

const NAMES: Record<Metric, string> = {
  exact: "Exact (median = label)",
  within1: "Within ±1 (median vs label)",
  ownWithin: "Own-category claim within the band",
  below2Outside: "Claim 2 below lands outside the band",
};

const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x: number) => (Number.isNaN(x) ? "n/a" : x.toFixed(2));
const secs = (ms: number) => (Number.isNaN(ms) ? "n/a" : `${(ms / 1000).toFixed(1)} s`);

function spearmanOf(units: Unit[], pick: Pick = "analysis"): number {
  const rated = units.filter((u) => u[pick].category !== null);
  return spearman(rated.map((u) => u[pick].category as number), rated.map((u) => u.label));
}

async function main() {
  const set = process.argv[2] as EvalSet;
  if (set !== "dev" && set !== "test") {
    console.error("usage: bun eval/report.ts <dev|test>");
    process.exit(1);
  }
  const dir = path.join(import.meta.dir, set);
  const raw = (await readFile(path.join(dir, "results.jsonl"), "utf8")).split("\n").filter(Boolean);
  // Last line per id wins (errored clips are re-run and appended).
  const lines = [...new Map(raw.map((l) => JSON.parse(l) as ResultLine).map((r) => [r.id, r])).values()];

  const errored = lines.filter((r) => r.error);
  const ok = lines.filter((r) => !r.error && r.find);
  const padel = ok.filter((r) => r.padel && r.label !== null);
  const negatives = ok.filter((r) => !r.padel);

  const units: Unit[] = padel.flatMap((r) =>
    r.players.map((p) => ({
      clip: r.id,
      label: r.label as Category,
      analysis: p.analysis,
      first: merge(p.samples.slice(0, 1)),
    })),
  );
  const baseline: Unit[] = units.map((u) => ({ ...u, analysis: constantAnalysis(7), first: constantAnalysis(7) }));
  const clipsWithUnits = new Set(units.map((u) => u.clip)).size;

  const row = (m: Metric) => {
    const stat = (us: Unit[]) => metric(us, m);
    const statFirst = (us: Unit[]) => metric(us, m, "first");
    return {
      metric: m,
      model: { value: stat(units), ci: bootstrapCI(units, stat, 2000, 1) },
      oneSample: { value: statFirst(units), ci: bootstrapCI(units, statFirst, 2000, 1) },
      baseline7th: metric(baseline, m),
      control: shuffleControl(units, stat, 1000, 2),
    };
  };
  const rows = METRICS.map(row);
  const rho = {
    model: { value: spearmanOf(units), ci: bootstrapCI(units, (us) => spearmanOf(us), 2000, 1) },
    oneSample: spearmanOf(units, "first"),
    control: shuffleControl(units, (us) => spearmanOf(us), 1000, 2),
  };

  const gate = {
    negatives: negatives.length,
    negativesRejected: rate(negatives, (r) => !r.find!.isPadel),
    padelClips: ok.filter((r) => r.padel).length,
    padelWronglyRejected: rate(ok.filter((r) => r.padel), (r) => !r.find!.isPadel),
    rejectedIds: ok.filter((r) => r.padel && !r.find!.isPadel).map((r) => r.id),
    acceptedNegativeIds: negatives.filter((r) => r.find!.isPadel).map((r) => r.id),
  };
  const clipMs = ok.map((r) => r.ms);
  const findMs = ok.map((r) => r.findMs);
  const rateMs = ok.flatMap((r) => r.players.map((p) => p.ms));
  const latency = {
    clip: { p50: percentile(clipMs, 50), p90: percentile(clipMs, 90) },
    find: { p50: percentile(findMs, 50), p90: percentile(findMs, 90) },
    rate3: { p50: percentile(rateMs, 50), p90: percentile(rateMs, 90) },
  };
  const distance = { model: byDistance(units), oneSample: byDistance(units, "first"), baseline7th: byDistance(baseline) };
  const unrated = units.filter((u) => u.analysis.category === null).length;

  const summary = {
    set,
    generatedAt: new Date().toISOString(),
    clips: lines.length,
    errored: errored.map((r) => ({ id: r.id, error: r.error })),
    players: units.length,
    playersUnrated: unrated,
    clipsWithRatedPlayers: clipsWithUnits,
    metrics: rows,
    spearman: rho,
    gate,
    latency,
    byDistance: distance,
  };
  await writeFile(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");

  const ci = (c: { lo: number; hi: number }) => `${pct(c.lo)}–${pct(c.hi)}`;
  const md = [
    `# P-Rank eval: ${set}`,
    "",
    `Generated ${summary.generatedAt} from \`eval/${set}/results.jsonl\` by \`bun eval/report.ts ${set}\`.`,
    set === "dev"
      ? "Dev set: the clips the prompts were tuned on. These numbers are optimistic; the test set is the honest one."
      : "Test set: clips never looked at while tuning, start second drawn at random (seeded).",
    "",
    `- Clips: ${lines.length} (${errored.length} errored${errored.length ? `: ${errored.map((r) => r.id).join(", ")}` : ""})`,
    `- Rated players: ${units.length} from ${clipsWithUnits} padel clips (${unrated} came back not rated); every player of a final carries its category.`,
    "- CIs: 95% bootstrap over clips (2000 resamples, seed 1). Control: labels shuffled across clips, 1000 shuffles (seed 2), mean and 2.5–97.5 percentiles.",
    "",
    "## Accuracy",
    "",
    "| metric | model (3 samples) | 95% CI | 1 sample | 95% CI | say 7th to everyone | shuffled-label control |",
    "|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${NAMES[r.metric]} | ${pct(r.model.value)} | ${ci(r.model.ci)} | ${pct(r.oneSample.value)} | ${ci(r.oneSample.ci)} | ${pct(r.baseline7th)} | ${pct(r.control.mean)} (${ci(r.control)}) |`,
    ),
    `| Spearman ρ (median vs label) | ${num(rho.model.value)} | ${num(rho.model.ci.lo)}–${num(rho.model.ci.hi)} | ${num(rho.oneSample)} | | n/a (constant) | ${num(rho.control.mean)} (${num(rho.control.lo)}–${num(rho.control.hi)}) |`,
    "",
    "## Claims below the label",
    "",
    "Each rated player claims d categories weaker than their label (only where that category exists). % of entries that land outside the band.",
    "",
    "| d below | players | model | 1 sample | say 7th |",
    "|---|---|---|---|---|",
    ...distance.model.map(
      (d, i) =>
        `| ${d.d} | ${d.n} | ${pct(d.outside)} | ${pct(distance.oneSample[i].outside)} | ${pct(distance.baseline7th[i].outside)} |`,
    ),
    "",
    "## Not-padel gate",
    "",
    `- Negatives rejected: ${pct(gate.negativesRejected)} of ${gate.negatives}${gate.acceptedNegativeIds.length ? ` (let through: ${gate.acceptedNegativeIds.join(", ")})` : ""}`,
    `- Padel wrongly rejected: ${pct(gate.padelWronglyRejected)} of ${gate.padelClips}${gate.rejectedIds.length ? ` (${gate.rejectedIds.join(", ")})` : ""}`,
    "",
    "## Latency",
    "",
    "| step | p50 | p90 |",
    "|---|---|---|",
    `| find | ${secs(latency.find.p50)} | ${secs(latency.find.p90)} |`,
    `| rate ×3 (one player) | ${secs(latency.rate3.p50)} | ${secs(latency.rate3.p90)} |`,
    `| whole clip (find + near players in parallel) | ${secs(latency.clip.p50)} | ${secs(latency.clip.p90)} |`,
    "",
  ].join("\n");
  await writeFile(path.join(dir, "REPORT.md"), md);
  console.log(md);
}

if (import.meta.main) main();
