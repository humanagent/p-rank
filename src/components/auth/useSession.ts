"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@/shared/types";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<Session | null> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const s = res.ok ? ((await res.json()) as Session) : null;
      setSession(s);
      return s;
    } catch {
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    setSession(null);
  }, []);

  useEffect(() => {
    // refresh only sets state after the fetch resolves, so this doesn't cascade renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { session, loading, refresh, signOut };
}
