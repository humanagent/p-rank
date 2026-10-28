// Shared helpers for the /api/audit routes.
import type { Entry, Session } from "@/shared/types";
import { store } from "@/server/store";

export const err = (status: number, error: string) => Response.json({ error }, { status });

export async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The entry if the session owns it (or, with club = true, is the club). Anything else is a 404, so ids don't leak.
export async function load(id: string, session: Session, club = false): Promise<Entry | Response> {
  const entry = await store.get(id);
  if (!entry) return err(404, "Entry not found");
  if (same(entry.email, session.email) || (club && session.isClub)) return entry;
  return err(404, "Entry not found");
}

export const isCategory = (n: unknown): n is 1 | 2 | 3 | 4 | 5 | 6 | 7 =>
  typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 7;
