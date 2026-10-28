"use client";
import { useEffect, useState } from "react";
import { CATEGORY_NAME, type Entry, type EntryStatus } from "@/shared/types";
import { listEntries } from "./api";
import ui from "./ui.module.css";
import styles from "./Home.module.css";

const STATUS: Record<EntryStatus, string> = {
  uploaded: "Uploaded",
  finding: "Finding players",
  picking: "Pick yourself",
  rating: "Rating",
  done: "Rated",
  rejected: "Not padel",
  failed: "Failed",
};

function chipFor(e: Entry): string {
  if (e.status !== "done") return STATUS[e.status];
  if (e.waitlist) return { waiting: "Waiting for the club", confirmed: "Confirmed", declined: "Declined" }[e.waitlist.status];
  if (e.verdict === "within") return "Within your category";
  return "Coach review";
}

export function Home({
  email,
  onOpen,
  onNew,
  onSignOut,
}: {
  email: string;
  onOpen: (e: Entry) => void;
  onNew: () => void;
  onSignOut: () => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listEntries()
      .then((list) => live && setEntries(list))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className={ui.stack}>
      <div className={styles.top}>
        <div>
          <p className={ui.eyebrow}>Meridian Court Club</p>
          <h1 className={ui.title}>Summer Invitational</h1>
        </div>
        <button type="button" className={styles.signout} onClick={onSignOut} title={email}>
          Sign out
        </button>
      </div>
      <p className={ui.sub}>Send a clip, tell us your category, and P-Rank helps the coaches check it. The club confirms every spot.</p>
      <button type="button" className={ui.primary} onClick={onNew}>
        New entry
      </button>

      <h2 className={styles.h2}>Your entries</h2>
      {error && <p className={ui.error}>{error}</p>}
      {!entries && !error && <p className={ui.sub}>Loading…</p>}
      {entries?.length === 0 && <p className={ui.sub}>No entries yet.</p>}
      <ul className={styles.list}>
        {entries?.map((e) => (
          <li key={e.id}>
            <button type="button" className={styles.row} onClick={() => onOpen(e)}>
              <span className={styles.meta}>
                <span className={styles.date}>
                  {new Date(e.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                  {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={styles.claim}>{e.claimed ? `You said ${CATEGORY_NAME[e.claimed]}` : "No category yet"}</span>
              </span>
              <span className={ui.chip}>{chipFor(e)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
