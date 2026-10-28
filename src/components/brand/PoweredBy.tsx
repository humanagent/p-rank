import styles from "./PoweredBy.module.css";

/** "Powered by P-Rank · Beta": the AI is a helper in beta, and a coach confirms every entry. */
export function PoweredBy({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className={`${styles.mark} ${tone === "dark" ? styles.dark : ""}`}>
      Powered by <strong>P-Rank</strong>
      <span className={styles.beta}>Beta</span>
    </span>
  );
}
