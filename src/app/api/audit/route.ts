import type { Entry } from "@/shared/types";
import { requireSession } from "@/server/auth/session";
import { store } from "@/server/store";
import { startFind } from "@/server/verifier";
import { validKey } from "@/server/storage";
import { body, err } from "./_lib/http";

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const b = await body(req);
  const clipKey = b?.clipKey;
  if (typeof clipKey !== "string" || !validKey(clipKey)) {
    return err(400, "clipKey must be a key under clips/");
  }
  const entry: Entry = {
    id: crypto.randomUUID(),
    email: auth.session.email,
    createdAt: new Date().toISOString(),
    clipKey,
    status: "uploaded",
    log: [],
  };
  await store.put(entry);
  await store.appendLog(entry.id, "uploaded", clipKey);
  await startFind(entry.id);
  return Response.json((await store.get(entry.id)) ?? entry, { status: 201 });
}

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  return Response.json(await store.listByEmail(auth.session.email));
}
