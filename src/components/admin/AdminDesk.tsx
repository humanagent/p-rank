"use client";

import { useCallback, useEffect, useState } from "react";
import { type Category, CATEGORY_NAME, type Entry } from "@/shared/types";
import { EntryCard } from "./EntryCard";
import { bandText, fmtTime, postReview, type Action } from "./util";
import styles from "./admin.module.css";
import { PoweredBy } from "@/components/brand/PoweredBy";

type Queue = { needsLook: Entry[]; waitlist: { category: Category; entries: Entry[] }[]; decided: Entry[] };

export function AdminDesk({ email, onSignOut }: { email: string; onSignOut: () => void | Promise<void> }) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/review", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Could not load (${res.status}).`);
      setQueue(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the queue.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const act = useCallback(
    async (id: string, action: Action, note?: string) => {
      setBusy(id);
      setError(null);
      try {
        await postReview(id, action, note);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not go through.");
      } finally {
        await load();
        setBusy(null);
      }
    },
    [load],
  );

  // One queue: every entry a coach still has to decide. Outside the band first (furthest first), then the ones
  // within it waiting for their draw. Every card has the clip and P-Rank's read.
  const toDecide = queue
    ? [
        ...queue.needsLook.map((e) => ({ e, mode: "review" as const })),
        ...queue.waitlist.flatMap((g) => g.entries.map((e) => ({ e, mode: "waitlist" as const }))),
      ]
    : [];
  const confirmedCount = queue?.decided.filter((e) => e.waitlist?.status === "confirmed").length ?? 0;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.seal} aria-hidden>M</span>
          <div>
            <p className={styles.crest}>Meridian Court Club · Admin</p>
            <PoweredBy />
            <h1 className={styles.h1}>Summer Invitational entries</h1>
          </div>
        </div>
        <div className={styles.who}>
          <span className={styles.muted}>{email}</span>
          <button className={styles.btnGhost} onClick={() => void onSignOut()}>Sign out</button>
        </div>
      </header>

      <dl className={styles.counts}>
        <div><dt>Needs a look</dt><dd>{queue ? toDecide.length : "–"}</dd></div>
        <div><dt>Confirmed</dt><dd>{queue ? confirmedCount : "–"}</dd></div>
        <div><dt>Decided</dt><dd>{queue?.decided.length ?? "–"}</dd></div>
      </dl>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {!queue && !error && <p className={styles.muted}>Loading the queue…</p>}

      {queue && (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>Needs a look</h2>
            <p className={styles.sub}>Every entry, outside the band first. Watch the rally, read P-Rank, then decide.</p>
            {toDecide.length === 0 ? (
              <p className={styles.empty}>Nothing to decide right now.</p>
            ) : (
              <div className={styles.grid}>
                {toDecide.map(({ e, mode }) => (
                  <EntryCard key={e.id} entry={e} mine={e.email === email} busy={busy === e.id} mode={mode} onAct={act} />
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Decided</h2>
            {queue.decided.length === 0 ? (
              <p className={styles.empty}>No decisions yet.</p>
            ) : (
              <ul className={styles.rows}>
                {queue.decided.map((e) => (
                  <li key={e.id} className={styles.decided}>
                    <span className={styles.email}>{e.email}</span>
                    {e.review && (
                      <span>
                        <b className={e.review.decision === "approved" ? styles.ok : styles.no}>{e.review.decision}</b>{" "}
                        <span className={styles.muted}>by {e.review.by} · {fmtTime(e.review.at)}</span>
                        {e.review.note && <span className={styles.note}> “{e.review.note}”</span>}
                      </span>
                    )}
                    {e.waitlist && e.waitlist.status !== "waiting" && (
                      <span>
                        <b className={e.waitlist.status === "confirmed" ? styles.ok : styles.no}>
                          {e.waitlist.status} · {CATEGORY_NAME[e.waitlist.category]} draw
                        </b>{" "}
                        {e.waitlist.decided && (
                          <span className={styles.muted}>by {e.waitlist.decided.by} · {fmtTime(e.waitlist.decided.at)}</span>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
