import { startCode } from "@/server/auth/codes";
import { isValidEmail, normalizeEmail } from "@/server/auth/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  if (!isValidEmail(email)) return Response.json({ error: "Enter a valid email." }, { status: 400 });
  const r = await startCode(email);
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
  return Response.json(r.devCode ? { ok: true, devCode: r.devCode } : { ok: true });
}
