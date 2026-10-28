import type { ReactNode } from "react";
import styles from "./Screen.module.css";

/** The frame every step shares: the club name, the step count, then the step's content. Dark for the pipeline. */
export function Screen({ step, dark, children }: { step?: string; dark?: boolean; children: ReactNode }) {
  return (
    <div className={`${styles.screen} ${dark ? styles.dark : ""}`} data-theme-screen={dark ? "dark" : "light"}>
      <div className={styles.top}>
        <span className={styles.club}>Meridian Court</span>
        {step && <span className={styles.step}>{step}</span>}
      </div>
      {children}
    </div>
  );
}
