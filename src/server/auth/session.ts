// Session cookie: HMAC-signed, server only. Pure helpers (sign, verify, matchesClub) are exported for tests.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Session } from "@/shared/types";

export const COOKIE = "prank_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const DEV_SECRET = "prank-dev-secret-do-not-use-in-cloud";

const g = globalThis as unknown as { __prankSecretWarned?: boolean };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.COGNITO_CLIENT_ID || process.env.CLIPS_BUCKET) throw new Error("SESSION_SECRET is required in cloud mode");
  if (!g.__prankSecretWarned) {
    g.__prankSecretWarned = true;
    console.warn("[auth] SESSION_SECRET not set, using the fixed dev secret (local mode only)");
  }
  return DEV_SECRET;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Returns `<base64url(value)>.<base64url(hmac)>`. */
export function sign(value: string, key: string): string {
  const body = b64url(value);
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** Returns the original value, or null if the token is malformed or tampered. */
export function verify(token: string, key: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = Buffer.from(token.slice(dot + 1), "base64url");
  const want = createHmac("sha256", key).update(body).digest();
  if (mac.length !== want.length || !timingSafeEqual(mac, want)) return null;
  return Buffer.from(body, "base64url").toString("utf8");
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

/** Pure: does `email` match a CLUB_EMAILS-style list? "@domain" entries match a domain. */
export function matchesClub(email: string, list: string): boolean {
  const e = normalizeEmail(email);
  return list
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => (entry.startsWith("@") ? e.endsWith(entry) : e === entry));
}

export function isClubEmail(email: string): boolean {
  return matchesClub(email, process.env.CLUB_EMAILS ?? "@meridian.club");
}

type Payload = { email: string; exp: number };

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const raw = verify(token, secret());
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Payload;
    if (typeof p.email !== "string" || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return { email: p.email, isClub: isClubEmail(p.email) };
  } catch {
    return null;
  }
}

export async function setSession(email: string): Promise<Session> {
  const e = normalizeEmail(email);
  const payload: Payload = { email: e, exp: Date.now() + MAX_AGE * 1000 };
  (await cookies()).set(COOKIE, sign(JSON.stringify(payload), secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return { email: e, isClub: isClubEmail(e) };
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** In a route handler: `const auth = await requireSession(); if ("response" in auth) return auth.response;` */
export async function requireSession(): Promise<{ session: Session } | { response: Response }> {
  const session = await getSession();
  if (!session) return { response: Response.json({ error: "Sign in first." }, { status: 401 }) };
  return { session };
}

/** Like requireSession, plus 403 for non-club emails. */
export async function requireClub(): Promise<{ session: Session } | { response: Response }> {
  const auth = await requireSession();
  if ("response" in auth) return auth;
  if (!auth.session.isClub) return { response: Response.json({ error: "Club staff only." }, { status: 403 }) };
  return auth;
}
