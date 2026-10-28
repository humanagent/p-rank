// Reads labels.tsv: one row per 10 s clip, labelled with the tournament category in the video title.
import { readFile } from "node:fs/promises";
import type { Category } from "@/shared/types";

export type Label = { id: string; youtube: string; category: Category | null; start: number; source: string };

const CATEGORY: Record<string, Category | null> = {
  "1ra": 1, "2da": 2, "3ra": 3, "4ta": 4, "5ta": 5, "6ta": 6, "7ma": 7, none: null,
};

export async function readLabels(file: string): Promise<Label[]> {
  const lines = (await readFile(file, "utf8")).split("\n").filter((l) => l && !l.startsWith("#"));
  return lines.slice(1).map((line) => {
    const [id, youtube, category, start, source] = line.split("\t");
    if (!(category in CATEGORY)) throw new Error(`unknown category "${category}" for ${id}`);
    return { id, youtube, category: CATEGORY[category], start: Number(start), source };
  });
}
