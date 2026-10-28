"use client";

import { useCallback, useEffect, useState } from "react";
import { type Category, CATEGORY_NAME, type Entry } from "@/shared/types";
import { EntryCard } from "./EntryCard";
import { bandText, fmtTime, postReview, type Action } from "./util";
import styles from "./club.module.css";

type Queue = { needsLook: Entry[]; waitlist: { category: Category; entries: Entry[] }[]; decided: Entry[] };

export function ClubDesk({ email, onSignOut }: { email: string; onSignOut: () => void | Promise<void> }) {
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

  const waitingCount = queue?.waitlist.reduce((n, g) => n + g.entries.length, 0) ?? 0;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.seal} aria-hidden>M</span>
          <div>
            <p className={styles.crest}>Meridian Court Club · Club desk</p>
            <h1 className={styles.h1}>Summer Invitational entries</h1>
          </div>
        </div>
        <div className={styles.who}>
          <span className={styles.muted}>{email}</span>
          <button className={styles.btnGhost} onClick={() => void onSignOut()}>Sign out</button>
        </div>
      </header>

      <dl className={styles.counts}>
        <div><dt>Needs a look</dt><dd>{queue?.needsLook.length ?? "–"}</dd></div>
        <div><dt>On the waitlist</dt><dd>{queue ? waitingCount : "–"}</dd></div>
        <div><dt>Decided</dt><dd>{queue?.decided.length ?? "–"}</dd></div>
      </dl>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {!queue && !error && <p className={styles.muted}>Loading the queue…</p>}

      {queue && (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>Needs a look</h2>
            <p className={styles.sub}>Claims outside the P-Rank band, furthest first. A coach decides.</p>
            {queue.needsLook.length === 0 ? (
              <p className={styles.empty}>Nothing waiting. Every claim so far sits within the band.</p>
            ) : (
              <div className={styles.grid}>
                {queue.needsLook.map((e) => (
                  <EntryCard key={e.id} entry={e} mine={e.email === email} busy={busy === e.id} onAct={act} />
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Waitlist by draw</h2>
            {queue.waitlist.length === 0 ? (
              <p className={styles.empty}>No one waiting for a draw.</p>
            ) : (
              queue.waitlist.map((g) => (
                <div key={g.category} className={styles.draw}>
                  <h3 className={styles.h3}>{CATEGORY_NAME[g.category]} draw <span className={styles.muted}>· {g.entries.length}</span></h3>
                  <ul className={styles.rows}>
                    {g.entries.map((e) => {
                      const mine = e.email === email;
                      const off = busy === e.id || mine;
                      return (
                        <li key={e.id} className={styles.row}>
                          <span className={styles.rowMain}>
                            <span className={styles.email}>{e.email}</span>
                            <span className={styles.muted}>P-Rank {bandText(e)}</span>
                          </span>
                          {mine ? (
                            <span className={styles.muted}>Your entry</span>
                          ) : (
                            <span className={styles.actions}>
                              <button className={styles.btn} disabled={off} onClick={() => void act(e.id, "confirm")}>Confirm</button>
                              <button className={styles.btnGhost} disabled={off} onClick={() => void act(e.id, "decline")}>Decline</button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
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
