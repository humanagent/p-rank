"use client";
import { useEffect, useState } from "react";
import type { Entry } from "@/shared/types";
import { createEntry, putWithProgress, uploadUrl } from "./api";
import ui from "./ui.module.css";
import styles from "./Upload.module.css";

const MAX_BYTES = 60 * 1024 * 1024;
const MIN_S = 5;
const MAX_S = 30;

function contentTypeOf(file: File): string | null {
  const name = file.name.toLowerCase();
  if (file.type === "video/mp4" || name.endsWith(".mp4")) return "video/mp4";
  if (file.type === "video/quicktime" || name.endsWith(".mov")) return "video/quicktime";
  return null;
}

function durationOf(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("We couldn't read this video. Try an MP4 or MOV exported from your phone."));
    };
    v.src = url;
  });
}

export function Upload({ onCreated }: { onCreated: (e: Entry) => void }) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [picked, setPicked] = useState<{ file: File; type: string; preview: string } | null>(null);
  const busy = progress !== null;

  // Free the preview's object URL when it changes or the step unmounts.
  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked.preview);
  }, [picked]);

  async function choose(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    setPicked(null);
    const type = contentTypeOf(file);
    if (!type) return setError("That file isn't a video we accept. Use an MP4 or MOV.");
    if (file.size > MAX_BYTES)
      return setError(`That clip is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is 60 MB; trim it and try again.`);
    let seconds: number;
    try {
      seconds = await durationOf(file);
    } catch (e) {
      return setError((e as Error).message);
    }
    if (!Number.isFinite(seconds)) return setError("We couldn't read this clip's length. Try exporting it again.");
    if (seconds < MIN_S) return setError(`That clip is ${seconds.toFixed(1)} s. We need at least ${MIN_S} seconds.`);
    if (seconds > MAX_S + 0.5) return setError(`That clip is ${Math.round(seconds)} s. Trim it to ${MAX_S} seconds or less.`);
    setPicked({ file, type, preview: URL.createObjectURL(file) });
  }

  async function submit() {
    if (!picked || busy) return;
    setError(null);
    try {
      setProgress(0);
      const { key, url } = await uploadUrl(picked.type, picked.file.size);
      await putWithProgress(url, picked.file, setProgress);
      onCreated(await createEntry(key));
    } catch (e) {
      setError((e as Error).message || "Upload failed. Try again.");
      setProgress(null);
    }
  }

  return (
    <div className={ui.stack}>
      <div className={ui.head}>
        <span className={ui.eyebrow}>Step 1 · Your clip</span>
        <h2 className={ui.title}>Upload your rally</h2>
        <p className={ui.sub}>Up to thirty seconds of you playing: the more of your shots, the better.</p>
      </div>

      <label
        className={`${styles.drop} ${drag ? styles.dragging : ""} ${busy ? styles.busy : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          choose(e.dataTransfer.files?.[0]);
        }}
      >
        {picked ? (
          <video src={picked.preview} muted autoPlay loop playsInline />
        ) : (
          <>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <span className={styles.choose}>Choose a video</span>
            <span className={ui.muted}>MP4 or MOV · 5 to 30 seconds · up to 60 MB</span>
            <span className={styles.dragHint}>or drop it here</span>
          </>
        )}
        <input
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          aria-label="Choose a video"
          disabled={busy}
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      <div className={styles.bullets}>
        <div>Film from behind the glass so all four players are in frame</div>
        <div>Feet visible, not cut by the frame</div>
        <div>Only you need to enter; the others stay anonymous</div>
      </div>

      {busy && (
        <div className={styles.progress} aria-live="polite">
          <span className={ui.muted}>{progress < 100 ? `Uploading… ${progress}%` : "Saving your entry…"}</span>
          <span className={styles.bar}>
            <span className={styles.fill} style={{ width: `${progress}%` }} />
          </span>
        </div>
      )}
      {error && (
        <span className={ui.error} role="alert">
          {error}
        </span>
      )}
      <div className={ui.spacer} />
      <button type="button" className={ui.primary} disabled={!picked || busy} onClick={submit}>
        {busy ? "Uploading…" : "Continue"}
      </button>
    </div>
  );
}
