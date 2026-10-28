import { requireSession } from "@/server/auth/session";
import { load } from "../_lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const entry = await load(id, auth.session, true);
  return entry instanceof Response ? entry : Response.json(entry);
}
