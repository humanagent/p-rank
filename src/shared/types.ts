// The contract every part of P-Rank shares. Only the lead changes this file.

// Argentine padel categories: 7 is a beginner, 1 is a pro. The Invitational runs draws 7th to 2nd.
export type Category = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const CATEGORIES: Category[] = [7, 6, 5, 4, 3, 2, 1];
export const DRAWS: Category[] = [7, 6, 5, 4, 3, 2];
export const CATEGORY_NAME: Record<Category, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th" };

export type Side = "near_left" | "near_right" | "far_left" | "far_right";
// Box is [ymin, xmin, ymax, xmax] normalized 0–1000 on the frame at second `at` of the clip.
export type Box = [number, number, number, number];
export type FoundPlayer = { side: Side; box: Box; looks: string };
export type Find = { isPadel: boolean; reason: string; at: number; players: FoundPlayer[] };

export type Shot = { at: number; stroke: string; technique: string };
// One model answer about the picked player. category null = not rated.
export type Sample = { shots: Shot[]; category: Category | null; why: string };
// Lowest and highest category the samples gave, e.g. { best: 4, worst: 5 }.
export type Band = { best: Category; worst: Category };
export type Analysis = { category: Category | null; band: Band | null; shots: Shot[]; why: string; samples: number };

// within = claim within ±1 of the band; outside = not, or not rated; rejected = clip is not padel.
export type Verdict = "within" | "outside" | "rejected";

export type EntryStatus =
  | "uploaded" // clip stored, find not started
  | "finding" // find call running
  | "picking" // players found, waiting for the entrant to pick themselves and a category
  | "rating" // 3 rate calls running
  | "done" // verdict set
  | "rejected" // not padel
  | "failed"; // a model call failed; retry keeps the clip

export type LogLine = { at: string; step: string; msg: string };

export type Decision = { by: string; at: string };
export type Review = Decision & { decision: "approved" | "rejected"; note?: string };
export type Waitlist = { category: Category; status: "waiting" | "confirmed" | "declined"; decided?: Decision };

export type Entry = {
  id: string;
  email: string; // the entrant
  createdAt: string; // ISO
  clipKey: string; // storage key of the MP4/MOV
  status: EntryStatus;
  find?: Find;
  side?: Side; // the player the entrant picked
  claimed?: Category;
  analysis?: Analysis;
  verdict?: Verdict;
  draws?: Category[]; // draws the entrant can join: within ±1 of the band
  waitlist?: Waitlist;
  review?: Review; // a coach's decision on an entry outside the band
  error?: string;
  log: LogLine[];
};

export type Session = { email: string; isClub: boolean };

// API (all JSON, all need a session cookie except /api/auth/*):
// POST /api/auth/start { email } -> { ok, devCode? }          devCode only in local mode
// POST /api/auth/verify { email, code } -> { ok }              sets the session cookie
// POST /api/auth/signout -> { ok }
// GET  /api/auth/me -> Session | 401
// POST /api/upload-url { contentType, size } -> { key, url, method: "PUT" }
// POST /api/audit { clipKey } -> Entry                       creates the entry and starts find in the background
// GET  /api/audit -> Entry[]                                 the signed-in entrant's entries, newest first
// GET  /api/audit/:id -> Entry                               owner or club only
// POST /api/audit/:id/me { side, claimed } -> Entry          starts the 3 rate calls in the background
// POST /api/audit/:id/retry -> Entry                         re-runs the failed step
// POST /api/audit/:id/waitlist { category } -> Entry         only a category in entry.draws
// GET  /api/clips/:key -> the clip bytes (local mode) or a redirect to a presigned GET
// GET  /api/review -> Entry[]                                  club only; queue order is in src/lib/queue.ts
// POST /api/review/:id { action: "approve" | "reject" | "confirm" | "decline", note? } -> Entry   club only, never your own entry

// Env (cloud mode when CLIPS_BUCKET is set, local mode otherwise):
// OPENROUTER_API_KEY, PRANK_MODEL (default google/gemini-3.8-flash), SESSION_SECRET, CLUB_EMAILS (comma list or @domain),
// CLIPS_BUCKET, ENTRIES_TABLE, COGNITO_CLIENT_ID, WORKER_FUNCTION
