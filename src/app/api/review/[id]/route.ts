import { requireClub } from "@/server/auth/session";
import { store } from "@/server/store";
import { applyReview, isAction, isRuleError, PAST } from "../rules";


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireClub();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  let body: { action?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  if (!isAction(body.action)) {
    return Response.json({ error: "action must be approve, reject, confirm or decline." }, { status: 400 });
  }
  const action = body.action;
  const note = typeof body.note === "string" ? body.note : undefined;

  const entry = await store.get(id);
  if (!entry) return Response.json({ error: "No such entry." }, { status: 404 });

  const by = auth.session.email;
  const now = new Date().toISOString();
  // Check first so a bad request never writes; then apply inside update against the fresh copy.
  const check = applyReview(entry, action, by, now, note);
  if (isRuleError(check)) return Response.json({ error: check.error }, { status: check.status });

  let conflict: { error: string; status: number } | null = null;
  await store.update(id, (fresh) => {
    const r = applyReview(fresh, action, by, now, note);
    if (isRuleError(r)) {
      conflict = r;
      return fresh;
    }
    return r;
  });
  if (conflict) {
    const c = conflict as { error: string; status: number };
    return Response.json({ error: c.error }, { status: c.status });
  }

  const msg = `${by} ${PAST[action]}${note?.trim() ? `: ${note.trim().slice(0, 200)}` : ""}`;
  process.stdout.write(JSON.stringify({ at: now, step: "review", id, msg }) + "\n");
  const saved = await store.appendLog(id, "review", msg);
  return Response.json(saved);
}
