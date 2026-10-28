"use client";
import { useRef, useState } from "react";
import { CATEGORY_NAME, type Category, type Entry } from "@/shared/types";
import { bandLabel } from "@/lib/categories";
import { clipUrl, joinWaitlist } from "./api";
import ui from "./ui.module.css";
import styles from "./Result.module.css";

const WAITLIST_LABEL = { waiting: "Waiting for the club", confirmed: "Confirmed", declined: "Declined" } as const;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function Result({
  entry,
  onUpdated,
  onNewClip,
}: {
  entry: Entry;
  onUpdated: (e: Entry) => void;
  onNewClip: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [joining, setJoining] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const a = entry.analysis;
  const rated = !!a && a.category !== null && !!a.band;
  const within = entry.verdict === "within" && rated;
  const draws = entry.draws ?? [];

  function seek(at: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = at;
    v.play().catch(() => {});
  }

  async function join(c: Category) {
    setJoining(c);
    setError(null);
    try {
      onUpdated(await joinWaitlist(entry.id, c));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(null);
    }
  }

  return (
    <div className={ui.stack}>
      {/* The verdict card: your category big, P-Rank's band underneath. */}
      {within ? (
        <div className={`${styles.verdict} ${styles.ok}`}>
          <span className={styles.vEyebrow}>Within P-Rank&apos;s band</span>
          <span className={styles.big}>{entry.claimed ? CATEGORY_NAME[entry.claimed] : "–"} category</span>
          <span className={styles.small}>
            You said {entry.claimed ? CATEGORY_NAME[entry.claimed] : "–"} · P-Rank: {bandLabel(a!.band!)} · within one category
          </span>
        </div>
      ) : (
        <div className={`${styles.verdict} ${styles.wait}`}>
          <span className={styles.vEyebrow}>{rated ? "Outside P-Rank\u2019s band" : "Not rated"}</span>
          <span className={styles.big}>A coach takes a look</span>
          <span className={styles.small}>
            You said {entry.claimed ? CATEGORY_NAME[entry.claimed] : "–"} · P-Rank: {rated ? bandLabel(a!.band!) : "–"} · the club decides
          </span>
        </div>
      )}

      <video ref={video} className={styles.video} src={clipUrl(entry.clipKey)} controls playsInline preload="metadata" />

      {a?.why && (
        <section className={styles.card}>
          <h2 className={styles.h2}>Why</h2>
          <p className={styles.why}>{a.why}</p>
        </section>
      )}

      {a && a.shots.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.h2}>Your shots</h2>
          <ul className={styles.shots}>
            {a.shots.map((s, i) => (
              <li key={i}>
                <button type="button" className={styles.shot} onClick={() => seek(s.at)}>
                  <span className={styles.at}>{fmt(s.at)}</span>
                  <span className={styles.stroke}>{s.stroke}</span>
                  <span className={styles.tech}>{s.technique}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {entry.review && (
        <section className={styles.card}>
          <h2 className={styles.h2}>Coach review</h2>
          <p className={styles.why}>
            {entry.review.decision === "approved" ? "A coach approved your rating." : "A coach did not approve this clip."}
            {entry.review.note ? ` “${entry.review.note}”` : ""}
          </p>
        </section>
      )}

      {/* One row per draw P-Rank would accept; joining puts you on its waitlist and the club confirms the spot. */}
      <section className={styles.drawList}>
        <h2 className={styles.h2}>{within ? "Waitlists you can join" : "Waitlists P-Rank would accept"}</h2>
        {draws.length === 0 && <p className={styles.why}>No draw to join from this clip yet. A coach will review it.</p>}
        {draws.map((c) => {
          const mine = entry.waitlist?.category === c ? entry.waitlist : undefined;
          return (
            <div key={c} className={styles.drawRow}>
              <span>{CATEGORY_NAME[c]} category</span>
              {mine ? (
                <span className={styles.drawStatus}>{WAITLIST_LABEL[mine.status]}</span>
              ) : (
                <button
                  type="button"
                  className={styles.joinBtn}
                  disabled={joining !== null || !!entry.waitlist}
                  onClick={() => join(c)}
                >
                  {joining === c ? "Joining…" : "Join waitlist"}
                </button>
              )}
            </div>
          );
        })}
        {entry.waitlist && (
          <span className={styles.footnote}>The club confirms every spot before the draw is set.</span>
        )}
        {error && <p className={ui.error}>{error}</p>}
      </section>

      {!within && (
        <button type="button" className={ui.secondary} onClick={onNewClip}>
          Add another clip
        </button>
      )}
    </div>
  );
}
