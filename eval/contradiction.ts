// Ablation: show the model the category the entrant claimed and ask if the clip contradicts it, instead of asking for a
// category. Reuses the players the product found (eval/<set>/results.jsonl), so no detection call is repeated.
// Each player is asked twice: claiming the tournament category (honest) and claiming two below it (low claim).
// A flag on the honest claim is a false flag; on the low claim, a catch. bun eval/report.ts scores it.
// Usage: infisical run -- bun eval/contradiction.ts <dev|test> <clips folder>   Writes eval/<set>/results-contradiction.jsonl.
import { appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { FoundPlayer } from "@/shared/types";
import { ask } from "@/server/verifier/openrouter";

const NAMES = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];
const prompt = (p: FoundPlayer, claim: number) => `You watch an amateur padel match clip from Argentina. Argentine categories go from 7th (beginner) to 1st (pro).
Look only at one player: the one wearing ${p.looks}. At the start of the clip they are on the ${p.side.replace("_", " ")} side of the
court (near means the half closer to the camera); follow the clothes, not the side. The other players are context.
This player entered a tournament saying they play ${NAMES[claim]} category.
Watch every shot and movement of this player. Flag the claim only if you see concrete evidence that they play at a
different category (better or worse), and say what you saw and the second. If the clip does not show enough, do not flag.`;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["flag", "direction", "evidence"],
  properties: {
    flag: { type: "boolean" },
    direction: { type: "string", enum: ["better", "worse", "none"] },
    evidence: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["at", "what"], properties: { at: { type: "number" }, what: { type: "string" } } },
    },
  },
};
type Flag = { flag: boolean; direction: string; evidence: { at: number; what: string }[] };

const SET = process.argv[2] === "test" ? "test" : "dev";
const dir = process.argv[3];
const OUT = `eval/${SET}/results-contradiction.jsonl`;
const rows = async (f: string) => (existsSync(f) ? (await readFile(f, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const done = new Set((await rows(OUT)).map((r) => r.id));
const todo = (await rows(`eval/${SET}/results.jsonl`)).filter((r) => r.category !== null && r.isPadel && !done.has(r.id));
console.log(`${done.size} done, ${todo.length} to run`);

async function worker() {
  for (let row = todo.shift(); row; row = todo.shift()) {
    try {
      const video = await readFile(`${dir}/${row.id}.mp4`);
      const players = await Promise.all(
        // Only the players the run rated, so both benches ask about the same people.
        (row.found as FoundPlayer[]).filter((p) => row.players.some((r: { side: string }) => r.side === p.side)).map(async (p) => ({
          side: p.side,
          honest: (await ask<Flag>(prompt(p, row.category), SCHEMA, video, "video/mp4")).data,
          lowClaim: row.category + 2 <= 7 ? (await ask<Flag>(prompt(p, row.category + 2), SCHEMA, video, "video/mp4")).data : null,
        })),
      );
      await appendFile(OUT, JSON.stringify({ id: row.id, category: row.category, players }) + "\n");
      console.log(`${row.id}  ${players.length} players`);
    } catch (err) {
      console.log(`${row.id}  failed: ${err instanceof Error ? err.message.slice(0, 200) : err}`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
