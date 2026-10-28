import { requireSession } from "@/server/auth/session";
import { store } from "@/server/store";
import { startFind, startRate } from "@/server/verifier";
import { err, load } from "../../_lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const entry = await load(id, auth.session);
  if (entry instanceof Response) return entry;
  if (entry.status !== "failed") return err(409, `Entry is ${entry.status}, only a failed entry can be retried`);
  const step = entry.find ? "rate" : "find";
  await store.update(id, (x) => ({ ...x, status: step === "find" ? "finding" : "rating", error: undefined }));
  await store.appendLog(id, "retry", step);
  await (step === "find" ? startFind(id) : startRate(id));
  return Response.json(await store.get(id));
}
