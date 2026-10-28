"use client";

import { SignIn } from "@/components/auth/SignIn";
import { useSession } from "@/components/auth/useSession";
import { AdminDesk } from "@/components/admin/AdminDesk";
import styles from "@/components/admin/admin.module.css";

export default function ClubPage() {
  const { session, loading, refresh, signOut } = useSession();

  if (loading) return <main className={styles.shell}><p className={styles.muted}>Opening the desk…</p></main>;
  if (!session) {
    return (
      <main className={styles.shell}>
        <SignIn onSignedIn={refresh} title="Admin · coaches only" />
      </main>
    );
  }
  if (!session.isClub) {
    return (
      <main className={styles.shell}>
        <div className={styles.forbidden}>
          <p className={styles.crest}>Meridian Court Club</p>
          <h1 className={styles.h1}>This desk is for club coaches</h1>
          <p className={styles.muted}>
            You are signed in as {session.email}. Entries are reviewed by the club&apos;s coaching staff; your own entry
            lives on the entry page.
          </p>
          <button className={styles.btnGhost} onClick={() => void signOut()}>Sign out</button>
        </div>
      </main>
    );
  }
  return <AdminDesk email={session.email} onSignOut={signOut} />;
}
