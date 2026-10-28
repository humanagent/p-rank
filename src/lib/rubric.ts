// What the model is asked, and the JSON shape it must answer in. The model only describes; code decides.
// The model never sees the category the entrant claimed.

import type { Side } from "@/shared/types";

const VOICE =
  "Write every description in Rioplatense Spanish, like an Argentine padel coach talking to a student: voseo, " +
  "and padel words as they are said in Argentina (paleta, pelota, cancha, vidrio, reja, bandeja, víbora, globo). " +
  "Never say pala, bola or pista.";

export const FIND_PROMPT = [
  "You are looking at a short video clip from a padel court.",
  "First, in one line, say what you see.",
  "Then decide if padel is being played. A serve, a rally, or a point that ends early counts as padel being played. " +
    "Another sport, an empty court, a warm-up, or players just standing around does not.",
  "Look at the very first frame of the clip (second 0) and list each player you can see in it, up to 4. " +
    "For each one give `box` as [ymin, xmin, ymax, xmax] " +
    "normalized 0 to 1000 on that frame, covering the whole body including the feet, and `looks`: their clothes " +
    "and anything else that tells them apart from the others (shirt and shorts colour, socks, shoes, cap, sleeves, hair). " +
    "Describe only how they look, never where they stand: players swap sides during a point.",
  "If padel is not being played, still say why in `reason`, and list the players you see, if any.",
  VOICE,
].join("\n\n");

export const FIND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reason", "isPadel", "players"],
  properties: {
    reason: { type: "string", description: "One line: what the clip shows and why it is or is not padel being played." },
    isPadel: { type: "boolean" },
    players: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["box", "looks"],
        properties: {
          box: {
            type: "array",
            items: { type: "integer" },
            minItems: 4,
            maxItems: 4,
            description: "[ymin, xmin, ymax, xmax] normalized 0-1000, whole body including feet.",
          },
          looks: { type: "string", description: "Clothes and anything that tells this player apart." },
        },
      },
    },
  },
} as const;

const SIDE_WORDS: Record<Side, string> = {
  near_left: "near left (the half of the court closer to the camera, on the left)",
  near_right: "near right (the half of the court closer to the camera, on the right)",
  far_left: "far left (the half of the court farther from the camera, on the left)",
  far_right: "far right (the half of the court farther from the camera, on the right)",
};

export function RATE_PROMPT(looks: string, side: Side): string {
  return [
    "You are an Argentine padel coach watching a short clip to rate one player.",
    `Watch only the player wearing: ${looks}. At the start of the clip they are on the ${SIDE_WORDS[side]} side. ` +
      "Players switch sides during a point, so follow the clothes, not the side.",
    "List every shot that player hits, in order. For each: the second it happens (`at`), the stroke (serve, drive, " +
      "backhand, volley, bandeja, víbora, smash, lob, off the glass, and so on), and the technique: preparation, " +
      "contact, legs and body, and what the pelota does. Also describe what they do between shots (positioning, " +
      "split step, moving to the net or back).",
    "Then name the player's category from 1 to 7 on the Argentine scale, where 7 is a beginner and 1 is a pro, " +
      "and say why in `why`.",
    VOICE,
  ].join("\n\n");
}

export const RATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shots", "category", "why"],
  properties: {
    shots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["at", "stroke", "technique"],
        properties: {
          at: { type: "number", description: "Second of the clip." },
          stroke: { type: "string" },
          technique: { type: "string", description: "Preparation, contact, legs and body, what the pelota does, and what the player does after." },
        },
      },
    },
    category: { type: "integer", minimum: 1, maximum: 7, description: "Argentine category: 7 beginner, 1 pro." },
    why: { type: "string" },
  },
} as const;
