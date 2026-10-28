"use client";
import type { Entry } from "@/shared/types";
import { Watching } from "./Watching";

export function Rating({ entry }: { entry: Entry }) {
  return <Watching entry={entry} title="P-Rank is watching your shots" note="Three separate looks at your rally, then code compares them." />;
}
