# P-Rank

A helper for the coaches who review entries to the Summer Invitational at the (fictional) Meridian Court Club.
An entrant uploads a short padel rally, picks themselves in it and claims a category (7th = beginner, 1st = pro).
P-Rank rates that player and says whether the claim is within ±1 of the band it saw. **A coach confirms every
entry; nothing is auto-approved.** The model only describes what it sees; code merges the answers and decides.

Deployed: [TK]

## The flow

1. `/`: the club's landing page.
2. `/enter`: sign in with an email code, upload a clip, pick yourself from the players found, claim a category,
   get the verdict and the draws you can join (or a waitlist).
3. `/club`: the club desk. Coaches see the queue, approve or reject entries outside the band, confirm or decline
   waitlists. Nobody can review their own entry.

## Run it locally

```bash
bun install
infisical run -- bun dev            # or: OPENROUTER_API_KEY=... bun dev
```

Open http://localhost:3000. Local mode (no AWS) needs only `OPENROUTER_API_KEY`: clips and entries stay on the
machine, and the sign-in code is shown on screen instead of emailed. Club desk access goes to the emails in
`CLUB_EMAILS` (comma list or `@domain`), default `@meridian.club`, so `coach@meridian.club` is a coach.
Model: `PRANK_MODEL`, default `google/gemini-3.8-flash` via OpenRouter.

Tests: `bun test src` and `bun test eval`.

## What to try

- **Happy path:** sign in as any non-club email, upload a padel rally, pick yourself, claim your category. The
  verdict says within or outside, with the band and the shots it based it on.
- **A tennis clip gets rejected:** upload a tennis (or pickleball, squash) clip; the find step says it is not
  padel and the entry stops there.
- **Claim 2 below:** on the same clip, claim two categories weaker than the band; it lands outside and goes to the
  club desk.
- **Club desk:** sign in as `coach@meridian.club`, open `/club`, approve or reject the entry outside the band.
- **Self-review is blocked:** enter a clip as `coach@meridian.club`, then try to review it from `/club` (403).

## How it works

```
clip -> find (is it padel? who is on court, with boxes)
     -> entrant picks themselves + claims a category
     -> rate the picked player x3 (parallel, temperature 0, strict JSON, shots it saw + a category)
     -> code: median of the 3 = category, min..max = band (a category counts only if backed by a shot)
     -> code: claim within ±1 of the band? -> within / outside
     -> a coach confirms
```

The model never decides the verdict. `src/lib/score.ts` merges and decides; `src/lib/categories.ts` holds the ±1
rule and the draws.

## Eval

Public 30 s clips from padel tournament finals, each labelled with the category in the video title (every player
of that final gets it), plus not-padel negatives (tennis, pickleball, squash, an empty court, dead time).
Dev = 47 clips the prompts were tuned on; test = 12 clips from other videos at random seconds, run once.
Labels: `eval/labels.ts`. Clips are not in git.

```bash
infisical run -- bun eval/run.ts dev  <dev clips folder>     # paid: find + 3 rate calls per near player
infisical run -- bun eval/run.ts test <test clips folder>    # EVAL_PLAYERS=all to rate the far players too
bun eval/report.ts dev                                       # no model calls -> eval/dev/REPORT.md, summary.json
bun eval/report.ts test
```

The report gives exact and within-±1 accuracy, own-category claim within the band, claim 2 below landing outside,
a 1-sample ablation, a "say 7th to everyone" baseline, a shuffled-label control (1000 shuffles), 95% bootstrap CIs
over clips, Spearman, the not-padel gate, latency p50/p90, and % outside the band by claim distance.

| | dev | test |
|---|---|---|
| Own-category claim within the band | [TK] | [TK] |
| Claim 2 below lands outside | [TK] | [TK] |
| Within ±1 (median vs label) | [TK] | [TK] |
| Negatives rejected | [TK] | n/a (no negatives) |
| Latency per clip, p50 | [TK] | [TK] |

## What is incomplete

[TK]
