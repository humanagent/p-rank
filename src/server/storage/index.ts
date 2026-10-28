import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_CLIP_BYTES = 60 * 1024 * 1024;
export const CLIP_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov" };
const EXT_TYPE: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime" };

export const isCloud = () => Boolean(process.env.CLIPS_BUCKET);
const region = () => process.env.AWS_REGION || "sa-east-1";
const localDir = () => path.join(process.env.PRANK_DATA_DIR || path.join(process.cwd(), ".data"), "clips");

// Returns an error message, or null when the clip is acceptable.
export function checkClip(contentType: unknown, size: unknown): string | null {
  if (typeof contentType !== "string" || !CLIP_TYPES[contentType.split(";")[0].trim()])
    return "Only MP4 or MOV videos are accepted.";
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return "The file size is missing.";
  if (size > MAX_CLIP_BYTES) return "The clip is larger than 60 MB. Trim it and try again.";
  return null;
}

// Keys look like clips/<uuid>.<ext>. Anything else (.., absolute paths, odd chars) is refused.
export function validKey(key: string): boolean {
  return /^clips\/[A-Za-z0-9-]+\.(mp4|mov)$/.test(key) && !key.includes("..");
}

export function contentTypeOf(key: string): string {
  return EXT_TYPE[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/** Local mode only: absolute path of a key on disk. */
export function localPath(key: string): string {
  if (!validKey(key)) throw new Error(`bad key ${key}`);
  return path.join(localDir(), path.basename(key));
}

let s3P: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;
const s3 = () =>
  (s3P ??= import("@aws-sdk/client-s3").then(({ S3Client }) => new S3Client({ region: region() })));

export const storage = {
  /** clips/<uuid>.<ext>. email is accepted for the contract but not put in the key (no PII in URLs). */
  newKey(_email: string, ext: string): string {
    return `clips/${randomUUID()}.${ext.replace(/^\./, "").toLowerCase()}`;
  },

  async uploadTarget(key: string, contentType: string): Promise<{ url: string; method: "PUT" }> {
    if (!isCloud()) return { url: `/api/clips/${key}`, method: "PUT" };
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const url = await getSignedUrl(
      await s3(),
      new PutObjectCommand({ Bucket: process.env.CLIPS_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 600 },
    );
    return { url, method: "PUT" };
  },

  async read(key: string): Promise<Buffer> {
    if (!isCloud()) return fs.promises.readFile(localPath(key));
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const r = await (await s3()).send(new GetObjectCommand({ Bucket: process.env.CLIPS_BUCKET, Key: key }));
    if (!r.Body) throw new Error(`empty object ${key}`);
    return Buffer.from(await r.Body.transformToByteArray());
  },

  async viewUrl(key: string): Promise<string> {
    if (!isCloud()) return `/api/clips/${key}`;
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return getSignedUrl(await s3(), new GetObjectCommand({ Bucket: process.env.CLIPS_BUCKET, Key: key }), {
      expiresIn: 3600,
    });
  },

  /** Local mode only: write the uploaded bytes. */
  async writeLocal(key: string, body: Buffer): Promise<void> {
    const p = localPath(key);
    await fs.promises.mkdir(path.dirname(p), { recursive: true });
    await fs.promises.writeFile(p, body);
  },
};
