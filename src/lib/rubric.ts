// What the model sees and answers: the rehearsal's prompts, word for word (the eval numbers are measured on them).
// Step 1 finds the players and how to tell them apart; step 2 watches one of them, shot by shot, and names a
// category. Argentine categories: 7th (beginner) to 1st (pro). The model never sees the claimed category.
import type { Side } from "@/shared/types";

// Step 1: is padel being played, where is each player, and what they wear. A serve or a point that ends early counts;
// nobody playing does not. The boxes are for the entrant to pick themselves; the clothes are how step 2 follows them.
export const FIND_PROMPT = `Look at this short video clip.
First say in one line what you see. Then decide if padel is being played: players on a glass-walled padel court
in a point, which can be a serve, a rally, or a point that ends early (a fault, a missed ball).
Not padel: another sport (tennis, squash, pickleball), an empty court, or nobody playing
(a warm-up drill, stretching, players walking or standing between points).
If padel is being played, pick the second of the clip where the players on court are seen most clearly ("at").
For each player on court (up to 4): draw a box around them in that frame, as [ymin, xmin, ymax, xmax] normalized
to 0-1000, whole body and feet included, and say what they wear and anything that tells them apart (shirt and shorts
colour, cap, shoes, racket colour).`;

export const FIND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reason", "is_padel", "at", "players"],
  properties: {
    reason: { type: "string" },
    is_padel: { type: "boolean" },
    at: { type: "number" },
    players: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["box", "looks"],
        properties: { box: { type: "array", items: { type: "number" } }, looks: { type: "string" } },
      },
    },
  },
};

// Step 2: the one player the entrant picked, followed by their clothes. The model never sees the claimed category.
const RATE_TEMPLATE = `You watch an amateur padel match clip from Argentina. Argentine categories go from 7th (beginner) to 1st (pro).
Look only at one player: the one wearing {looks}. At the start of the clip they are on the {side} of the court
(near means the half closer to the camera); players move during a point, so follow the clothes, not the side.
The other players are context.
1. List every shot this player hits, in order, through the whole clip: the second, the stroke
   (serve, drive, backhand, volley, bandeja, vibora, smash, lob, off the glass...) and its technique: preparation,
   contact point, legs and body, and what the ball does. Also list what they do between shots (footwork, position).
2. Then estimate this player's category, and say which things in the technique made you decide.
Write the descriptions in Rioplatense Spanish, the way an Argentine padel coach talks: voseo, and Argentine padel words (paleta, pelota, cancha, vidrio, reja, bandeja, víbora, globo, chiquita, salida de pared), never "pala", "bola" or "pista".`;

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
        properties: { at: { type: "number" }, stroke: { type: "string" }, technique: { type: "string" } },
      },
    },
    category: { type: "integer", minimum: 1, maximum: 7 },
    why: { type: "string" },
  },
};

export function RATE_PROMPT(looks: string, side: Side): string {
  return RATE_TEMPLATE.replace("{looks}", looks).replace("{side}", `${side.replace("_", " ")} side`);
}
