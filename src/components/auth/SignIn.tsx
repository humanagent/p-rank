"use client";
import { useState, type FormEvent } from "react";
import type { Session } from "@/shared/types";
import styles from "./SignIn.module.css";

type Props = { onSignedIn: (s: Session) => void; title?: string };

async function post<T>(url: string, body: unknown): Promise<T & { error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

export function SignIn({ onSignedIn, title = "Sign in" }: Props) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ ok: boolean; devCode?: string }>("/api/auth/start", { email });
      setDevCode(r.devCode ?? null);
      setCode("");
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/verify", { email, code });
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (!me.ok) throw new Error("Signed in, but the session did not stick. Try again.");
      onSignedIn((await me.json()) as Session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{title}</h2>
      {step === "email" ? (
        <form onSubmit={sendCode} className={styles.form}>
          <p className={styles.hint}>We will email you a code. No password needed.</p>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button className={styles.button} disabled={busy || !email}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={checkCode} className={styles.form}>
          <p className={styles.hint}>
            We sent a code to <strong>{email}</strong>.
          </p>
          {devCode && (
            <p className={styles.dev}>
              Local mode: your code is <strong>{devCode}</strong>
            </p>
          )}
          <label className={styles.label}>
            Code
            <input
              className={`${styles.input} ${styles.code}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}(\d{2})?"
              maxLength={8}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
          </label>
          <button className={styles.button} disabled={busy || code.length < 6}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className={styles.links}>
            <button type="button" className={styles.link} disabled={busy} onClick={() => sendCode()}>
              Send a new code
            </button>
            <button
              type="button"
              className={styles.link}
              disabled={busy}
              onClick={() => {
                setStep("email");
                setError(null);
                setDevCode(null);
              }}
            >
              Use another email
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default SignIn;
