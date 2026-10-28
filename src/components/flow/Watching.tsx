"use client";
import type { Entry } from "@/shared/types";
import { clipUrl } from "./api";
import { LiveLog } from "./LiveLog";
import { PoweredBy } from "@/components/brand/PoweredBy";
import ui from "./ui.module.css";
import styles from "./Watching.module.css";

type Check = { label: string; state: "done" | "active" | "todo" };

function playersFound(e: Entry): number | null {
  if (e.find) return e.find.players.length;
  const line = e.log.find((l) => l.step === "find_done");
  if (!line) return null;
  try {
    return (JSON.parse(line.msg) as { players?: number }).players ?? null;
  } catch {
    return null;
  }
}

/** The checklist is read straight off the entry's log, so it lights up with what the worker actually did. */
function checks(e: Entry): Check[] {
  const has = (step: string) => e.log.some((l) => l.step === step);
  const found = playersFound(e);
  const looks = e.log.filter((l) => l.step === "sample_done").length;
  const steps: [string, boolean][] = [
    ["Clip received", has("clip_loaded") || has("find_started") || !!e.find],
    [found !== null ? `It is padel, ${found} players found` : "Finding the players", found !== null],
    [`Watching your shots: technique, legs, contact (${looks} of 3 looks)`, has("merged")],
    ["Checking against your category", has("verdict") || e.status === "done"],
  ];
  const firstOpen = steps.findIndex(([, done]) => !done);
  return steps.map(([label, done], i) => ({ label, state: done ? "done" : i === firstOpen ? "active" : "todo" }));
}

/** Finding and Rating: the clip dimmed, the steps lighting up, then the live log. Sits on a dark Screen. */
export function Watching({ entry, title, note }: { entry: Entry; title: string; note: string }) {
  return (
    <>
      <div className={ui.head}>
        <h2 className={`${ui.title} ${styles.title}`}>{title}</h2>
        <span className={styles.note}>{note}</span>
        <PoweredBy tone="dark" />
      </div>
      <div className={styles.clip}>
        <video src={clipUrl(entry.clipKey)} autoPlay muted loop playsInline />
      </div>
      <ol className={styles.checklist}>
        {checks(entry).map((c) => (
          <li key={c.label} data-state={c.state}>
            <span className={styles.dot}>{c.state === "done" ? "✓" : ""}</span>
            {c.label}
          </li>
        ))}
      </ol>
      <LiveLog log={entry.log} />
    </>
  );
}
