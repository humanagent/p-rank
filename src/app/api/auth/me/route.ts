import { getSession } from "@/server/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });
  return Response.json(session);
}
