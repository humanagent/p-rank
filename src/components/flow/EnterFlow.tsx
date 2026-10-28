"use client";
import { useCallback, useEffect, useState } from "react";
import type { Entry } from "@/shared/types";
import { SignIn } from "@/components/auth/SignIn";
import { useSession } from "@/components/auth/useSession";
import { getEntry, retryEntry } from "./api";
import { PhoneFrame } from "./PhoneFrame";
import { Home } from "./Home";
import { Upload } from "./Upload";
import { Finding } from "./Finding";
import { PickPlayer } from "./PickPlayer";
import { Rating } from "./Rating";
import { Result } from "./Result";
import ui from "./ui.module.css";
import styles from "./EnterFlow.module.css";

type View = { kind: "home" } | { kind: "upload" } | { kind: "entry"; entry: Entry };

const POLLING = new Set(["uploaded", "finding", "rating"]);
const POLL_MS = 1500;

function setUrlId(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("id", id);
  else url.searchParams.delete("id");
  window.history.replaceState(null, "", url);
}

export function EnterFlow() {
  const { session, loading, refresh, signOut } = useSession();
  const [view, setView] = useState<View>({ kind: "home" });
  const [pollError, setPollError] = useState<string | null>(null);

  const open = useCallback((entry: Entry) => {
    setUrlId(entry.id);
    setPollError(null);
    setView({ kind: "entry", entry });
  }, []);
  const goHome = useCallback(() => {
    setUrlId(null);
    setView({ kind: "home" });
  }, []);

  // Deep link: /enter?id=<entry>
  useEffect(() => {
    if (!session) return;
    const id = new URL(window.location.href).searchParams.get("id");
    if (!id) return;
    getEntry(id).then(open).catch(() => setUrlId(null));
  }, [session, open]);

  // Poll while the pipeline is working.
  const entryId = view.kind === "entry" ? view.entry.id : null;
  const status = view.kind === "entry" ? view.entry.status : null;
  useEffect(() => {
    if (!entryId || !status || !POLLING.has(status)) return;
    let live = true;
    const t = setInterval(async () => {
      try {
        const e = await getEntry(entryId);
        if (live) {
          setPollError(null);
          setView((v) => (v.kind === "entry" && v.entry.id === e.id ? { kind: "entry", entry: e } : v));
        }
      } catch (err) {
        if (live) setPollError((err as Error).message);
      }
    }, POLL_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [entryId, status]);

  const startUpload = useCallback(() => setView({ kind: "upload" }), []);

  if (loading) {
    return (
      <PhoneFrame>
        <div className={styles.center}>
          <p className={ui.sub}>Loading…</p>
        </div>
      </PhoneFrame>
    );
  }

  if (!session) {
    return (
      <PhoneFrame step={0}>
        <div className={styles.body}>
          <SignIn title="Enter the Summer Invitational" onSignedIn={() => refresh()} />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame step={stepOf(view)} dark={isWorking(view)} onSignOut={signOut}>
      <div className={styles.body}>
        {view.kind !== "home" && (
          <button type="button" className={styles.back} onClick={goHome}>
            ‹ My entries
          </button>
        )}
        {view.kind === "home" && (
          <Home email={session.email} onOpen={open} onNew={startUpload} onSignOut={signOut} />
        )}
        {view.kind === "upload" && <Upload onCreated={open} />}
        {view.kind === "entry" && (
          <EntryView entry={view.entry} onUpdated={open} onNewClip={() => setView({ kind: "upload" })} onHome={goHome} />
        )}
        {pollError && <p className={ui.error}>Lost contact with the server: {pollError}. Retrying…</p>}
      </div>
    </PhoneFrame>
  );
}

function EntryView({
  entry,
  onUpdated,
  onNewClip,
  onHome,
}: {
  entry: Entry;
  onUpdated: (e: Entry) => void;
  onNewClip: () => void;
  onHome: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  switch (entry.status) {
    case "uploaded":
    case "finding":
      return <Finding entry={entry} />;
    case "picking":
      return <PickPlayer entry={entry} onUpdated={onUpdated} />;
    case "rating":
      return <Rating entry={entry} />;
    case "done":
      return <Result entry={entry} onUpdated={onUpdated} onNewClip={onNewClip} onHome={onHome} />;
    case "rejected":
      return (
        <div className={ui.stack}>
          <p className={ui.eyebrow}>Not this one</p>
          <h1 className={ui.title}>We couldn&apos;t see a padel rally</h1>
          <p className={ui.sub}>{entry.find?.reason ?? "This clip doesn't look like padel."}</p>
          <button type="button" className={ui.primary} onClick={onNewClip}>
            Try another clip
          </button>
        </div>
      );
    case "failed":
      return (
        <div className={ui.stack}>
          <p className={ui.eyebrow}>Something went wrong</p>
          <h1 className={ui.title}>P-Rank hit an error</h1>
          <p className={ui.error}>{entry.error ?? "A model call failed."}</p>
          <p className={ui.sub}>Your clip is saved. Retry runs the failed step again.</p>
          {error && <p className={ui.error}>{error}</p>}
          <button
            type="button"
            className={ui.primary}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                onUpdated(await retryEntry(entry.id));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Retrying…" : "Retry"}
          </button>
        </div>
      );
  }
}

// Which step lights up on the desktop rail (STEPS in PhoneFrame).
function stepOf(view: { kind: string; entry?: Entry }): number {
  if (view.kind !== "entry" || !view.entry) return 1;
  switch (view.entry.status) {
    case "uploaded":
    case "finding":
    case "picking":
      return 2;
    case "rating":
      return 3;
    default:
      return 4;
  }
}

// While P-Rank works, the clip sits dimmed behind the pipeline on a dark screen.
function isWorking(view: { kind: string; entry?: Entry }): boolean {
  const st = view.kind === "entry" ? view.entry?.status : undefined;
  return st === "uploaded" || st === "finding" || st === "rating";
}
