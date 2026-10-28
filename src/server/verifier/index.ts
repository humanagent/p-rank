// The verifier: find the players in a clip, then rate the one the entrant picked.
// find() and rate() are pure (clip in, answer out) so the eval can reuse them. runFind/runRate drive an Entry.

import type { Box, Category, Find, FoundPlayer, Sample, Analysis } from "@/shared/types";
import { FIND_PROMPT, FIND_SCHEMA, RATE_PROMPT, RATE_SCHEMA } from "@/lib/rubric";
import { assignSides } from "@/lib/sides";
import { clean, merge, decide } from "@/lib/score";
import { store } from "@/server/store";
import { storage } from "@/server/storage";
import { ask } from "./openrouter";

type RawFind = { reason?: unknown; is_padel?: unknown; at?: unknown; players?: unknown };

const clamp = (n: number) => Math.min(1000, Math.max(0, Math.round(n)));

function toBox(raw: unknown): Box | null {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [ymin, xmin, ymax, xmax] = raw.map(clamp);
  if (ymax <= ymin || xmax <= xmin) return null;
  return [ymin, xmin, ymax, xmax];
}

export function mimeOf(key: string): string {
  return /\.mov$/i.test(key) ? "video/quicktime" : "video/mp4";
}

export async function find(video: Buffer, mime: string): Promise<Find> {
  const { data } = await ask<RawFind>(FIND_PROMPT, FIND_SCHEMA, video, mime);
  const raw = Array.isArray(data.players) ? data.players : [];
  const players = raw
    .map((p) => {
      const o = (p ?? {}) as { box?: unknown; looks?: unknown };
      const box = toBox(o.box);
      return box ? { box, looks: typeof o.looks === "string" ? o.looks.trim() : "" } : null;
    })
    .filter((p): p is { box: Box; looks: string } => p !== null)
    .slice(0, 4);
  return {
    isPadel: data.is_padel === true,
    reason: typeof data.reason === "string" ? data.reason : "",
    at: typeof data.at === "number" && Number.isFinite(data.at) && data.at >= 0 ? data.at : 0,
    players: assignSides(players),
  };
}

export async function rate(
  video: Buffer,
  mime: string,
  player: FoundPlayer,
  n = 3,
): Promise<{ samples: Sample[]; analysis: Analysis }> {
  const prompt = RATE_PROMPT(player.looks, player.side);
  const samples = await Promise.all(
    Array.from({ length: n }, async () => clean((await ask<unknown>(prompt, RATE_SCHEMA, video, mime)).data)),
  );
  return { samples, analysis: merge(samples) };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const secs = (t0: number) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

async function fail(entryId: string, step: string, e: unknown) {
  const error = errText(e);
  await store.update(entryId, (x) => ({ ...x, status: "failed", error })).catch(() => {});
  await store.appendLog(entryId, `${step}_failed`, error).catch(() => {});
}

export async function runFind(entryId: string): Promise<void> {
  const entry = await store.update(entryId, (x) => ({ ...x, status: "finding", error: undefined }));
  try {
    let t0 = Date.now();
    const video = await storage.read(entry.clipKey);
    await store.appendLog(entryId, "clip_loaded", `${(video.length / 1e6).toFixed(1)} MB in ${secs(t0)}`);
    t0 = Date.now();
    await store.appendLog(entryId, "find_started", "asking the model who is on court");
    const result = await find(video, mimeOf(entry.clipKey));
    await store.appendLog(
      entryId,
      "find_done",
      JSON.stringify({ isPadel: result.isPadel, players: result.players.length, took: secs(t0) }),
    );
    if (!result.isPadel || result.players.length === 0) {
      await store.update(entryId, (x) => ({ ...x, find: result, status: "rejected", verdict: "rejected" }));
      await store.appendLog(entryId, "rejected", result.reason || "no players found");
      return;
    }
    await store.update(entryId, (x) => ({ ...x, find: result, status: "picking" }));
    await store.appendLog(entryId, "picking", `${result.players.length} players, waiting for the entrant`);
  } catch (e) {
    await fail(entryId, "find", e);
  }
}

export async function runRate(entryId: string): Promise<void> {
  const entry = await store.update(entryId, (x) => ({ ...x, status: "rating", error: undefined }));
  try {
    const player = entry.find?.players.find((p) => p.side === entry.side);
    if (!player || !entry.claimed) throw new Error("no picked player or claimed category");
    const claimed: Category = entry.claimed;
    const t0 = Date.now();
    const video = await storage.read(entry.clipKey);
    const mime = mimeOf(entry.clipKey);
    await store.appendLog(entryId, "rate_started", `3 calls on ${player.side} (${player.looks})`);
    const samples = await Promise.all(
      [1, 2, 3].map(async (i) => {
        const s0 = Date.now();
        const s = clean((await ask<unknown>(RATE_PROMPT(player.looks, player.side), RATE_SCHEMA, video, mime)).data);
        await store.appendLog(entryId, "sample_done", JSON.stringify({ n: i, category: s.category, shots: s.shots.length, took: secs(s0) }));
        return s;
      }),
    );
    const analysis = merge(samples);
    await store.appendLog(entryId, "merged", JSON.stringify({ category: analysis.category, band: analysis.band, took: secs(t0) }));
    const { verdict, draws } = decide(analysis, claimed);
    await store.update(entryId, (x) => ({ ...x, status: "done", analysis, verdict, draws, error: undefined }));
    await store.appendLog(entryId, "verdict", JSON.stringify({ verdict, claimed, draws }));
  } catch (e) {
    await fail(entryId, "rate", e);
  }
}

type Job = "find" | "rate";

async function start(job: Job, entryId: string): Promise<void> {
  const fn = process.env.WORKER_FUNCTION;
  if (fn) {
    const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");
    const g = globalThis as unknown as { __prankLambda?: InstanceType<typeof LambdaClient> };
    g.__prankLambda ??= new LambdaClient({});
    await g.__prankLambda.send(
      new InvokeCommand({
        FunctionName: fn,
        InvocationType: "Event",
        Payload: new TextEncoder().encode(JSON.stringify({ job, entryId })),
      }),
    );
    return;
  }
  const run = job === "find" ? runFind : runRate;
  void run(entryId).catch((e) => fail(entryId, job, e));
}

// Fire and forget. In cloud mode the Lambda invoke itself is awaited (it returns at once); a failed invoke marks the entry failed.
export async function startFind(entryId: string): Promise<void> {
  await start("find", entryId).catch((e) => fail(entryId, "find", e));
}

export async function startRate(entryId: string): Promise<void> {
  await start("rate", entryId).catch((e) => fail(entryId, "rate", e));
}
