"use client";
import { useEffect, useRef } from "react";
import type { LogLine } from "@/shared/types";
import styles from "./LiveLog.module.css";

function time(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** The pipeline log, newest at the bottom, auto-scrolled. */
export function LiveLog({ log }: { log: LogLine[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [log.length]);
  return (
    <ol className={styles.log} ref={ref} aria-live="polite">
      {log.length === 0 && <li className={styles.empty}>Waiting for the first step…</li>}
      {log.map((l, i) => (
        <li key={i} className={styles.line}>
          <time className={styles.time}>{time(l.at)}</time>
          <span className={styles.step}>{l.step}</span>
          <span className={styles.msg}>{l.msg}</span>
        </li>
      ))}
    </ol>
  );
}
