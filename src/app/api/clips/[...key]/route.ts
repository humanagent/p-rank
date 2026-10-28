import fs from "node:fs";
import { Readable } from "node:stream";
import { requireSession } from "@/server/auth/session";
import { checkClip, contentTypeOf, isCloud, localPath, storage, validKey } from "@/server/storage";

type Ctx = { params: Promise<{ key: string[] }> };

async function keyOf(ctx: Ctx): Promise<string | null> {
  const { key } = await ctx.params;
  const k = key.map(decodeURIComponent).join("/");
  return k.includes("..") || !validKey(k) ? null : k;
}

const bad = (error: string, status = 400) => Response.json({ error }, { status });

// Local mode only: the browser PUTs the clip here (cloud mode PUTs straight to S3).
export async function PUT(req: Request, ctx: Ctx) {
  if (isCloud()) return bad("Uploads go to S3 in cloud mode.", 405);
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const key = await keyOf(ctx);
  if (!key) return bad("Bad clip key.");

  const contentType = req.headers.get("content-type") ?? "";
  const declared = Number(req.headers.get("content-length") ?? NaN);
  const early = checkClip(contentType, Number.isFinite(declared) ? declared : 1);
  if (early) return bad(early);

  const body = Buffer.from(await req.arrayBuffer());
  const error = checkClip(contentType, body.length);
  if (error) return bad(error);
  if (contentTypeOf(key) !== contentType.split(";")[0].trim()) return bad("Content type does not match the key.");

  await storage.writeLocal(key, body);
  return Response.json({ ok: true, key });
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const key = await keyOf(ctx);
  if (!key) return bad("Bad clip key.");

  if (isCloud()) return Response.redirect(await storage.viewUrl(key), 302);

  const file = localPath(key);
  let size: number;
  try {
    size = (await fs.promises.stat(file)).size;
  } catch {
    return bad("Clip not found.", 404);
  }
  const type = contentTypeOf(key);
  const range = req.headers.get("range");
  const stream = (start: number, end: number) =>
    Readable.toWeb(fs.createReadStream(file, { start, end })) as unknown as ReadableStream;

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = m && m[1] ? Number(m[1]) : NaN;
    let end = m && m[2] ? Number(m[2]) : size - 1;
    if (m && !m[1] && m[2]) {
      // suffix range: last N bytes
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    }
    end = Math.min(end, size - 1);
    if (!m || Number.isNaN(start) || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(stream(start, end), {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  return new Response(stream(0, size - 1), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
