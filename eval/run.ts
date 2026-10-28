// Runs the product's verifier on every labelled clip of a set and caches each answer in eval/<set>/results.jsonl.
// The app rates only the player the entrant picks; the eval rates every found player, one call set each,
// with the same prompt, so it measures the product on all of them.
// Usage: infisical run -- bun eval/run.ts <dev|test> <folder with labels.tsv and the .mp4 clips>
// DETECT_CACHE=<jsonl> reuses the detections in that file instead of calling the model again.
// Re-running skips clips already in the cache, so a failed run resumes where it stopped.
import { appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Find as Found } from "@/shared/types";
import { find, rate } from "@/server/verifier";
import { readLabels } from "./labels";

const SET = process.argv[2] === "test" ? "test" : "dev";
const dir = process.argv[3] ?? `${process.env.HOME}/Downloads/p-rank-eval${SET === "test" ? "-test" : ""}`;
const OUT = process.env.EVAL_OUT ?? `eval/${SET}/results.jsonl`;
const CONCURRENCY = 3;
// EVAL_PLAYERS=near rates only the two players closest to the camera, half the cost of rating all four.
const rated = (p: { side: string }) => process.env.EVAL_PLAYERS !== "near" || p.side.startsWith("near");

const readRows = async (file: string) =>
  existsSync(file) ? (await readFile(file, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const done = new Set((await readRows(OUT)).map((r) => r.id));
const cached = new Map<string, Found>(
  (process.env.DETECT_CACHE ? await readRows(process.env.DETECT_CACHE) : []).map((r) => [
    r.id,
    { isPadel: r.isPadel, reason: r.reason, at: r.at, players: r.found ?? [] },
  ]),
);
const todo = (await readLabels(`${dir}/labels.tsv`)).filter((l) => !done.has(l.id) && existsSync(`${dir}/${l.id}.mp4`));
console.log(`${done.size} done, ${todo.length} to run, ${cached.size} detections cached`);

async function worker() {
  for (let label = todo.shift(); label; label = todo.shift()) {
    try {
      const video = await readFile(`${dir}/${label.id}.mp4`);
      const found = cached.get(label.id) ?? (await find(video, "video/mp4"));
      const players = found.isPadel
        ? await Promise.all(
            found.players.filter(rated).map(async (player) => {
              const started = Date.now();
              const { samples } = await rate(video, "video/mp4", player);
              return { side: player.side, looks: player.looks, seconds: (Date.now() - started) / 1000, samples };
            }),
          )
        : [];
      const row = { id: label.id, category: label.category, isPadel: found.isPadel, reason: found.reason, at: found.at, found: found.players, players };
      await appendFile(OUT, JSON.stringify(row) + "\n");
      console.log(`${label.id}  ${players.length} players`);
    } catch (err) {
      console.error(`${label.id}  failed: ${err instanceof Error ? err.message.slice(0, 200) : err}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
