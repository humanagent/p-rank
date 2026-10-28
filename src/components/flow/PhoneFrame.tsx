import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./PhoneFrame.module.css";

export const STEPS = ["Sign in", "Upload your clip", "Who are you", "Verifying", "Your result"];

/**
 * Full screen on a phone. On desktop: the flow inside an iPhone-shaped frame, the Invitational on the left and the
 * steps on the right (wide windows only). The phone fits the window height; only its screen scrolls.
 */
export function PhoneFrame({
  children,
  step,
  dark,
  onSignOut,
}: {
  children: ReactNode;
  step?: number; // index into STEPS, lights up on the right panel
  dark?: boolean;
  onSignOut?: () => void;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.side}>
        <span className={styles.eyebrow}>Meridian Court · Summer Invitational</span>
        <h1 className={styles.big}>
          Enter the <i>Invitational</i>
        </h1>
        <p>Players enter from their phone, right after filming. On desktop the same flow runs inside the phone.</p>
        <span className={styles.hint}>Open this link on a phone for the full-screen version.</span>
        <Link href="/" className={styles.hint}>
          Back to the Invitational
        </Link>
        {onSignOut && (
          <button type="button" className={styles.linkButton} onClick={onSignOut}>
            Sign out
          </button>
        )}
      </div>

      <div className={styles.phone}>
        <div className={styles.notch} aria-hidden />
        <div className={`${styles.screen} ${dark ? styles.dark : ""}`}>{children}</div>
      </div>

      <ol className={`${styles.side} ${styles.progress}`} aria-label="Entry steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <span className={styles.n}>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
    </main>
  );
}
