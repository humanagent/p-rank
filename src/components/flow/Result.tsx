"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { CATEGORY_NAME, type Category, type Entry } from "@/shared/types";
import { bandLabel } from "@/lib/categories";
import { PoweredBy } from "@/components/brand/PoweredBy";
import { clipUrl, joinWaitlist } from "./api";
import ui from "./ui.module.css";
import styles from "./Result.module.css";

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

  if (entry.waitlist && entry.waitlist.status !== "declined") return <Success entry={entry} />;

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
          <PoweredBy tone="dark" />
        </div>
      ) : (
        <div className={`${styles.verdict} ${styles.wait}`}>
          <span className={styles.vEyebrow}>{rated ? "Outside P-Rank\u2019s band" : "Not rated"}</span>
          <span className={styles.big}>A coach takes a look</span>
          <span className={styles.small}>
            You said {entry.claimed ? CATEGORY_NAME[entry.claimed] : "–"} · P-Rank: {rated ? bandLabel(a!.band!) : "–"} · the club decides
          </span>
          <PoweredBy />
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

      {/* The draw of the category you claimed, when P-Rank's band agrees. Outside it, a coach decides first. */}
      {within && entry.claimed && (
        <section className={styles.drawList}>
          <button type="button" className={ui.primary} disabled={joining !== null} onClick={() => join(entry.claimed!)}>
            {joining ? "Joining…" : `Enter the ${CATEGORY_NAME[entry.claimed]} category draw`}
          </button>
          <span className={styles.footnote}>You join its waitlist; the club confirms every spot before the draw is set.</span>
          {error && <p className={ui.error}>{error}</p>}
        </section>
      )}

      {!within && (
        <button type="button" className={ui.secondary} onClick={onNewClip}>
          Add another clip
        </button>
      )}
    </div>
  );
}

const SUCCESS_STATUS = { waiting: "Waiting for the club", confirmed: "Confirmed", declined: "Declined" } as const;

/** After joining: the club card for the draw, minimal, and what happens next. */
function Success({ entry }: { entry: Entry }) {
  const w = entry.waitlist!;
  const confirmed = w.status === "confirmed";
  return (
    <div className={ui.stack}>
      <p className={ui.eyebrow}>{confirmed ? "You're in the draw" : "You're on the waitlist"}</p>
      <h1 className={ui.title}>{confirmed ? "See you on court" : "Entry sent"}</h1>
      <div className={styles.memberCard} role="img" aria-label={`${CATEGORY_NAME[w.category]} category, ${SUCCESS_STATUS[w.status]}`}>
        <div className={styles.memberRow}>
          <span className={styles.memberClub}>Meridian Court</span>
          <span className={styles.memberM}>M</span>
        </div>
        <span className={styles.memberCat}>{CATEGORY_NAME[w.category]} category</span>
        <div className={styles.memberFoot}>
          <span>Summer Invitational</span>
          <span>{SUCCESS_STATUS[w.status]}</span>
        </div>
      </div>
      <p className={ui.sub}>
        {confirmed
          ? "A club coach confirmed your spot. We'll email you the draw."
          : "A club coach reviews P-Rank's read and confirms your spot before the draw is set. We'll email you."}
      </p>
      <PoweredBy />
      <Link className={ui.secondary} href="/">
        Back to the Invitational
      </Link>
    </div>
  );
}
