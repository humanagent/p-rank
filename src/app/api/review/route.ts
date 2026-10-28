import { requireClub } from "@/server/auth/session";
import { store } from "@/server/store";
import { reviewQueue } from "@/lib/queue";


export async function GET() {
  const auth = await requireClub();
  if ("response" in auth) return auth.response;
  return Response.json(reviewQueue(await store.list(), auth.session.email));
}
