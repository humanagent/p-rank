"use client";

import { useRef, useState } from "react";
import { CATEGORY_NAME, type Entry } from "@/shared/types";
import { bandText, outsideText, type Action } from "./util";
import styles from "./club.module.css";

type Props = { entry: Entry; mine: boolean; busy: boolean; onAct: (id: string, action: Action, note?: string) => void };

export function EntryCard({ entry, mine, busy, onAct }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [note, setNote] = useState("");
  const a = entry.analysis;

  const seek = (at: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = at;
    void v.play().catch(() => {});
  };

  return (
    <article className={styles.card}>
      <video
        ref={video}
        className={styles.video}
        src={`/api/clips/${entry.clipKey.split("/").map(encodeURIComponent).join("/")}`}
        controls
        preload="metadata"
        playsInline
      />
      <div className={styles.cardBody}>
        <p className={styles.email}>{entry.email}</p>
        <div className={styles.claim}>
          <span><small>Claimed</small>{entry.claimed ? CATEGORY_NAME[entry.claimed] : "–"}</span>
          <span><small>P-Rank</small>{bandText(entry)}</span>
          <span className={styles.gap}><small>Outside by</small>{outsideText(entry)}</span>
        </div>
        {a?.why && <p className={styles.why}>{a.why}</p>}
        {a && a.shots.length > 0 && (
          <ul className={styles.shots} aria-label="Shots, tap to jump">
            {a.shots.map((s, i) => (
              <li key={i}>
                <button className={styles.shot} onClick={() => seek(s.at)}>
                  <span className={styles.at}>{s.at.toFixed(1)}s</span>
                  <span><b>{s.stroke}</b> {s.technique}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {mine ? (
          <p className={styles.muted}>Your own entry. Another coach decides this one.</p>
        ) : (
          <div className={styles.decide}>
            <input
              className={styles.input}
              placeholder="Note (optional)"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
            />
            <div className={styles.actions}>
              <button className={styles.btn} disabled={busy} onClick={() => onAct(entry.id, "approve", note || undefined)}>
                {busy ? "Saving…" : "Approve"}
              </button>
              <button className={styles.btnGhost} disabled={busy} onClick={() => onAct(entry.id, "reject", note || undefined)}>
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
