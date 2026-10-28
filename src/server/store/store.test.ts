import { afterEach, beforeEach, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Entry } from "@/shared/types";
import { createLocalStore } from "./index";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prank-store-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const entry = (id: string, email: string, createdAt: string): Entry => ({
  id, email, createdAt, clipKey: `clips/${id}.mp4`, status: "uploaded", log: [],
});

test("listByEmail returns only that entrant, newest first, case-insensitive", async () => {
  const s = createLocalStore(dir);
  await s.put(entry("a", "ana@x.com", "2026-10-01T10:00:00Z"));
  await s.put(entry("b", "bob@x.com", "2026-10-02T10:00:00Z"));
  await s.put(entry("c", "ana@x.com", "2026-10-03T10:00:00Z"));
  expect((await s.listByEmail("Ana@x.com")).map((e) => e.id)).toEqual(["c", "a"]);
  expect((await s.list()).map((e) => e.id)).toEqual(["c", "b", "a"]);
});

test("update applies the function, persists, and throws when missing", async () => {
  const s = createLocalStore(dir);
  await s.put(entry("a", "ana@x.com", "2026-10-01T10:00:00Z"));
  const out = await s.update("a", (e) => ({ ...e, status: "finding" }));
  expect(out.status).toBe("finding");
  // a fresh store reads the file back
  expect((await createLocalStore(dir).get("a"))?.status).toBe("finding");
  await expect(s.update("nope", (e) => e)).rejects.toThrow("not found");
});

test("returned entries are copies, not live references", async () => {
  const s = createLocalStore(dir);
  await s.put(entry("a", "ana@x.com", "2026-10-01T10:00:00Z"));
  const e = (await s.get("a"))!;
  e.status = "done";
  expect((await s.get("a"))?.status).toBe("uploaded");
});

test("appendLog adds a line and persists it", async () => {
  const s = createLocalStore(dir);
  await s.put(entry("a", "ana@x.com", "2026-10-01T10:00:00Z"));
  await s.appendLog("a", "find", "started");
  const log = (await createLocalStore(dir).get("a"))!.log;
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ step: "find", msg: "started" });
});
