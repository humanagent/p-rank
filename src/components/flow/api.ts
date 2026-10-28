import type { Category, Entry, Side } from "@/shared/types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const clipUrl = (key: string) => `/api/clips/${key.split("/").map(encodeURIComponent).join("/")}`;

export const listEntries = () => fetch("/api/audit", { cache: "no-store" }).then((r) => json<Entry[]>(r));
export const getEntry = (id: string) =>
  fetch(`/api/audit/${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => json<Entry>(r));
export const createEntry = (clipKey: string) => post("/api/audit", { clipKey }).then((r) => json<Entry>(r));
export const pickMe = (id: string, side: Side, claimed: Category) =>
  post(`/api/audit/${encodeURIComponent(id)}/me`, { side, claimed }).then((r) => json<Entry>(r));
export const retryEntry = (id: string) => post(`/api/audit/${encodeURIComponent(id)}/retry`).then((r) => json<Entry>(r));
export const joinWaitlist = (id: string, category: Category) =>
  post(`/api/audit/${encodeURIComponent(id)}/waitlist`, { category }).then((r) => json<Entry>(r));
export const uploadUrl = (contentType: string, size: number) =>
  post("/api/upload-url", { contentType, size }).then((r) => json<{ key: string; url: string; method: "PUT" }>(r));

/** PUT with progress (fetch has no upload progress). */
export function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}
