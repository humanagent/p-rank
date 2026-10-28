// Worker Lambda (cloud mode): invoked async with { job, entryId }.
import { runFind, runRate } from "./index";

type Event = { job?: string; entryId?: string };

export async function handler(event: Event): Promise<{ ok: boolean }> {
  const { job, entryId } = event ?? {};
  if (!entryId || typeof entryId !== "string") throw new Error("entryId is required");
  if (job === "find") await runFind(entryId);
  else if (job === "rate") await runRate(entryId);
  else throw new Error(`unknown job: ${job}`);
  return { ok: true };
}
