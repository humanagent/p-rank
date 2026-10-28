import { verifyCode } from "@/server/auth/codes";
import { isValidEmail, normalizeEmail, setSession } from "@/server/auth/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; code?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const code = typeof body?.code === "string" ? body.code : "";
  if (!isValidEmail(email)) return Response.json({ error: "Enter a valid email." }, { status: 400 });
  const r = await verifyCode(email, code);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  await setSession(email);
  return Response.json({ ok: true });
}
