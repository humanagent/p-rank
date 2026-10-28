import type { Side } from "@/shared/types";
import { requireSession } from "@/server/auth/session";
import { store } from "@/server/store";
import { startRate } from "@/server/verifier";
import { body, err, isCategory, load } from "../../_lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const entry = await load(id, auth.session);
  if (entry instanceof Response) return entry;
  if (entry.status !== "picking") return err(409, `Entry is ${entry.status}, not waiting for a pick`);
  const b = await body(req);
  const side = b?.side;
  if (typeof side !== "string" || !entry.find?.players.some((p) => p.side === side)) {
    return err(400, "side must be one of the players found in the clip");
  }
  if (!isCategory(b?.claimed)) return err(400, "claimed must be a category from 1 to 7");
  const claimed = b.claimed;
  await store.update(id, (x) => ({ ...x, side: side as Side, claimed, status: "rating" }));
  await store.appendLog(id, "picked", JSON.stringify({ side, claimed }));
  await startRate(id);
  return Response.json(await store.get(id));
}
