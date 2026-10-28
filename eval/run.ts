// Runs the verifier on every labelled clip of a set and appends one JSON line per clip. Paid model calls.
//   infisical run -- bun eval/run.ts <dev|test> <clips folder>
// EVAL_PLAYERS=near (default) rates the two near players; EVAL_PLAYERS=all rates every player found.
// Resumable: ids with an error-free line in eval/<set>/results.jsonl are skipped; errored clips re-run and the
// report keeps the last line per id.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Analysis, Category, Find, Sample, Side } from "@/shared/types";
import { find, mimeOf, rate } from "@/server/verifier";
import { labelsFor, type EvalSet, type Label } from "./labels";

export type PlayerResult = { side: Side; samples: Sample[]; analysis: Analysis; ms: number };
export type ResultLine = {
  id: string;
  set: EvalSet;
  label: Category | null;
  padel: boolean;
  find: Find | null;
  findMs: number;
  players: PlayerResult[];
  ms: number;
  error?: string;
  at: string;
};

const CONCURRENCY = 3;

async function done(file: string): Promise<Set<string>> {
  if (!existsSync(file)) return new Set();
  const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
  return new Set(lines.map((l) => JSON.parse(l) as ResultLine).filter((r) => !r.error).map((r) => r.id));
}

async function runClip(label: Label, set: EvalSet, folder: string, all: boolean): Promise<ResultLine> {
  const file = path.join(folder, `${label.id}.mp4`);
  const t0 = Date.now();
  const base = { id: label.id, set, label: label.category, padel: label.padel, at: new Date().toISOString() };
  let f: Find | null = null;
  let findMs = 0;
  const players: PlayerResult[] = [];
  try {
    const video = await readFile(file);
    const mime = mimeOf(file);
    f = await find(video, mime);
    findMs = Date.now() - t0;
    if (f.isPadel) {
      const targets = f.players.filter((p) => all || p.side.startsWith("near"));
      const rated = await Promise.all(
        targets.map(async (p) => {
          const t1 = Date.now();
          const r = await rate(video, mime, p, 3);
          return { side: p.side, ...r, ms: Date.now() - t1 };
        }),
      );
      players.push(...rated);
    }
    return { ...base, find: f, findMs, players, ms: Date.now() - t0 };
  } catch (e) {
    return { ...base, find: f, findMs, players, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const [set, folder] = process.argv.slice(2) as [EvalSet, string];
  if ((set !== "dev" && set !== "test") || !folder) {
    console.error("usage: bun eval/run.ts <dev|test> <clips folder>");
    process.exit(1);
  }
  const all = process.env.EVAL_PLAYERS === "all";
  const dir = path.join(import.meta.dir, set);
  const out = path.join(dir, "results.jsonl");
  await mkdir(dir, { recursive: true });

  const skip = await done(out);
  const missing = labelsFor(set).filter((l) => !existsSync(path.join(folder, `${l.id}.mp4`)));
  if (missing.length) console.error(`missing clips (skipped): ${missing.map((l) => l.id).join(", ")}`);
  const todo = labelsFor(set).filter((l) => !skip.has(l.id) && !missing.includes(l));
  console.log(`${set}: ${todo.length} to run, ${skip.size} already done, players=${all ? "all" : "near"}`);

  const queue = [...todo];
  let n = 0;
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      const r = await runClip(l, set, folder, all);
      await appendFile(out, JSON.stringify(r) + "\n");
      n++;
      const cats = r.players.map((p) => `${p.side}=${p.analysis.category ?? "-"}`).join(" ");
      console.log(
        `[${n}/${todo.length}] ${r.id} label=${r.label ?? "none"} padel=${r.find?.isPadel ?? "?"} ${cats} ` +
          `find=${(r.findMs / 1000).toFixed(1)}s total=${(r.ms / 1000).toFixed(1)}s${r.error ? ` ERROR ${r.error}` : ""}`,
      );
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`wrote ${out}`);
}

if (import.meta.main) main();
