import { requireSession } from "@/server/auth/session";
import { store } from "@/server/store";
import { body, err, isCategory, load } from "../../_lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const entry = await load(id, auth.session);
  if (entry instanceof Response) return entry;
  if (entry.status !== "done") return err(409, `Entry is ${entry.status}, not done`);
  const b = await body(req);
  const category = b?.category;
  if (!isCategory(category)) return err(400, "category must be from 1 to 7");
  if (!entry.draws?.includes(category)) return err(403, "That draw is not open to this entry");
  if (entry.waitlist && entry.waitlist.status !== "declined") return err(409, "Already on a waitlist");
  const updated = await store.update(id, (x) => ({ ...x, waitlist: { category, status: "waiting" } }));
  await store.appendLog(id, "waitlist", `joined the ${category} waitlist`);
  return Response.json((await store.get(id)) ?? updated);
}
