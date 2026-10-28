"use client";
import type { Entry } from "@/shared/types";
import { Watching } from "./Watching";

export function Finding({ entry }: { entry: Entry }) {
  return <Watching entry={entry} title="Finding the players…" note="P-Rank looks for the four players on court." />;
}
