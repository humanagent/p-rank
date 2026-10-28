import { requireSession } from "@/server/auth/session";
import { CLIP_TYPES, checkClip, storage } from "@/server/storage";

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: { contentType?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON: { contentType, size }." }, { status: 400 });
  }
  const error = checkClip(body.contentType, body.size);
  if (error) return Response.json({ error }, { status: 400 });

  const contentType = (body.contentType as string).split(";")[0].trim();
  const key = storage.newKey(auth.session.email, CLIP_TYPES[contentType]);
  const { url, method } = await storage.uploadTarget(key, contentType);
  return Response.json({ key, url, method });
}
