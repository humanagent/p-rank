import { type Band, type Category, CATEGORY_NAME, DRAWS } from "../shared/types";

// Lowest and highest category number among the ratings. Callers pass a non-empty list.
export function bandOf(cats: Category[]): Band {
  if (cats.length === 0) throw new Error("bandOf: empty list");
  return { best: Math.min(...cats) as Category, worst: Math.max(...cats) as Category };
}

export function withinOne(claimed: Category, band: Band): boolean {
  return claimed >= band.best - 1 && claimed <= band.worst + 1;
}

// Draws (7th to 2nd) an entrant with this band may join, ordered 7 -> 2.
export function drawsFor(band: Band): Category[] {
  return DRAWS.filter((c) => withinOne(c, band));
}

// 0 inside the band, else how many categories outside it.
export function distance(claimed: Category, band: Band): number {
  if (claimed < band.best) return band.best - claimed;
  if (claimed > band.worst) return claimed - band.worst;
  return 0;
}

export function bandLabel(band: Band): string {
  if (band.best === band.worst) return CATEGORY_NAME[band.best];
  // Stronger (lower number) first: "4th / 5th".
  return `${CATEGORY_NAME[band.best]} / ${CATEGORY_NAME[band.worst]}`;
}
