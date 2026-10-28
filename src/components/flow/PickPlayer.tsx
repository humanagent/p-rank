"use client";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_NAME, type Box, type Category, type Entry, type Side } from "@/shared/types";
import { clipUrl, pickMe } from "./api";
import ui from "./ui.module.css";
import styles from "./PickPlayer.module.css";

/** Box [ymin,xmin,ymax,xmax] 0–1000 -> pixel rect on a w×h frame. Padded a full box each way and clamped: the
 *  model's boxes land up to about half a box off, so a tight crop can miss the player. The clothes text names them. */
function rectOf(box: Box, w: number, h: number) {
  const [ymin, xmin, ymax, xmax] = box;
  const bw = xmax - xmin;
  const bh = ymax - ymin;
  const x0 = Math.max(0, xmin - bw);
  const x1 = Math.min(1000, xmax + bw);
  const y0 = Math.max(0, ymin - bh * 0.7);
  const y1 = Math.min(1000, ymax + bh * 0.7);
  return { x: (x0 / 1000) * w, y: (y0 / 1000) * h, w: ((x1 - x0) / 1000) * w, h: ((y1 - y0) / 1000) * h };
}

export function PickPlayer({ entry, onUpdated }: { entry: Entry; onUpdated: (e: Entry) => void }) {
  const find = entry.find;
  const players = find?.players ?? [];
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [drawn, setDrawn] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [side, setSide] = useState<Side | null>(null);
  const [claimed, setClaimed] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !find) return;
    // Draw straight onto visible canvases (no toDataURL), so a cross-origin presigned clip still works.
    const draw = () => {
      if (!v.videoWidth) return;
      const w = v.videoWidth;
      const h = v.videoHeight;
      find.players.forEach((p, i) => {
        const c = cropRefs.current[i];
        const ctx = c?.getContext("2d");
        if (!c || !ctx) return;
        const r = rectOf(p.box, w, h);
        const scale = 320 / Math.max(r.w, r.h, 1);
        c.width = Math.max(1, Math.round(r.w * scale));
        c.height = Math.max(1, Math.round(r.h * scale));
        ctx.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      });
      setDrawn(true);
    };
    const onMeta = () => {
      const at = Math.min(Math.max(0, find.at), Math.max(0, (v.duration || find.at) - 0.05));
      if (Math.abs(v.currentTime - at) < 0.01 && v.readyState >= 2) draw();
      else v.currentTime = at;
    };
    const onErr = () => setFrameError("We couldn't load your clip to show the players.");
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("seeked", draw);
    v.addEventListener("error", onErr);
    if (v.readyState >= 1) onMeta();
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("seeked", draw);
      v.removeEventListener("error", onErr);
    };
  }, [find]);

  async function verify() {
    if (!side || !claimed) return;
    setBusy(true);
    setError(null);
    try {
      onUpdated(await pickMe(entry.id, side, claimed));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className={ui.stack}>
      <div>
        <p className={ui.eyebrow}>Who are you</p>
        <h1 className={ui.title}>Which one is you?</h1>
      </div>
      <p className={ui.sub}>Tap yourself, then the category you play.</p>

      <video ref={videoRef} src={clipUrl(entry.clipKey)} muted playsInline preload="auto" className={styles.hidden} />

      {frameError && <p className={ui.error}>{frameError}</p>}

      <div className={styles.grid}>
        {players.map((p, i) => {
          const selected = side === p.side;
          return (
            <button
              key={p.side + i}
              type="button"
              className={`${styles.player} ${selected ? styles.selected : ""}`}
              onClick={() => setSide(p.side)}
              aria-pressed={selected}
            >
              <span className={styles.thumb}>
                <canvas
                  ref={(el) => {
                    cropRefs.current[i] = el;
                  }}
                  aria-label={p.looks}
                  className={drawn ? undefined : styles.hidden}
                />
                {!drawn && <span className={styles.placeholder}>{frameError ? "No preview" : "Loading…"}</span>}
              </span>
              <span className={styles.looks}>{p.looks}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.cats} role="radiogroup" aria-label="Your category">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={claimed === c}
            className={`${styles.cat} ${claimed === c ? styles.catOn : ""}`}
            onClick={() => setClaimed(c)}
          >
            {CATEGORY_NAME[c]}
          </button>
        ))}
      </div>

      {error && <p className={ui.error}>{error}</p>}
      <button type="button" className={ui.primary} disabled={!side || !claimed || busy} onClick={verify}>
        {busy ? "Sending…" : "Verify"}
      </button>
    </div>
  );
}
