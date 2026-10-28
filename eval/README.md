# P-Rank eval

How far a coach can trust P-Rank's read, measured on public padel clips. The short answer: P-Rank lands near a
player's category and catches big under-claims, but it does not separate amateurs well enough to approve an entry
alone. That is why a coach confirms every entry, and why auto-approve stays research.

Numbers come from `eval/dev/REPORT.md` and `eval/test/REPORT.md`, which `bun eval/report.ts dev|test` rebuilds from
the cached model answers (`results.jsonl`) with no model calls.

## The question

An entrant uploads a rally, picks themselves and claims a category (Argentine scale, 7th beginner to 1st pro).
P-Rank rates that player three times, takes the median and the band (lowest to highest of the three), and says if
the claim is within ±1 of the band. Two things matter to the club:

1. **A player who claims their own category should land within the band**, or the coach is flooded with false
   alarms.
2. **A player who claims lower than they are should land outside it**, so a coach looks closer. That is the
   uneven match the tournament wants to stop.

Exact-category accuracy is reported too, but it is not the product's question: the decision is ±1 of a band.

## Data

- **Clips.** Public YouTube videos of padel tournament finals, cut to 30 s at a second where a point is played
  (`eval/fetch-clips.sh <dev|test> <folder>`, yt-dlp + ffmpeg). The ids and start seconds are in
  `eval/<set>/labels.tsv`; the clips are not in git.
- **Labels.** Every player in a final gets the category in the video title. It is a noisy label: finalists are the
  best of their category, so one may play a category above it.
- **Players rated.** The two players nearest the camera (`EVAL_PLAYERS=near`); far players are small and often cut.
- **Dev set**: 17 padel clips (7th to 1st, no 2nd final found) and 3 that are not padel (pickleball, an empty court,
  a warm-up). 34 players found, 31 rated. Every prompt change was tuned here.
- **Test set**: 12 clips from other finals (7th to 4th) at a random second (seed 7), no negatives, run **once** with
  the final prompts.

## Method

- **The product's pipeline**, not a copy: find (padel or not, a box and the clothes of each player), then the rating
  prompt per player, followed by their clothes, three samples at temperature 0, merged in code. Model:
  `google/gemini-3.8-flash` through OpenRouter, video inline, strict JSON schema.
- **The model never sees the claim.** Claims are simulated afterwards on the same bands: for each player, the claim
  of their label (own category) and of two below it. One set of model calls scores every claim, so trying every
  distance (1 to 6 below) costs nothing.
- **Intervals.** 95% bootstrap over clips (2000 resamples), so the two players of a clip move together.
- **Baseline.** "Say 7th to everyone": the mode of the labels.
- **Control.** Labels shuffled across clips, mean of 1000 shuffles with its 2.5–97.5 percentile spread. It tells how
  much of a number comes from the label distribution alone.

## Results

| Config | Exact | Within ±1 | Claims their own category: within the band | Claims 2 below: outside the band |
|---|---|---|---|---|
| **Production, dev** | 29% (12–50) | 68% (50–85) | 71% (53–85) | 35% (10–67) |
| **Production, test (run once)** | 18% (0–41) | 64% (36–86) | 82% (68–95) | 20% (0–67) |
| 1 sample instead of 3, dev | 26% (9–47) | 59% (38–79) | 59% (38–79) | 45% (20–73) |
| Claim shown, flag contradictions, dev | – | – | 97% not flagged | 30% flagged |
| Baseline: say 7th to everyone, dev / test | 24% / 27% | 41% / 55% | 41% / 55% | 40% / 0% |
| Control: shuffled labels, dev / test | 17% / 24% | 46% / 67% | 54% / 83% | 44% / 23% |

**Claims below their category, by distance** (dev, same bands, no extra calls):

| Claims | 1 below | 2 below | 3 below | 4 below | 5 below | 6 below |
|---|---|---|---|---|---|---|
| Outside the band | 4 of 26 (15%) | 7 of 20 (35%) | 7 of 14 (50%) | 6 of 8 (75%) | 4 of 4 | 4 of 4 |

- **Ranking.** Spearman between P-Rank's category and the label: 0.49 on dev (the pro finals pull it up), 0.04 on
  test.
- **Not-padel gate.** 3 of 3 negatives rejected on dev; 1 of 29 padel clips wrongly rejected (test, a changeover at
  the random second).
- **Latency** after the entrant picks themselves (3 rating calls in parallel): p50 38 s, p90 53 s.
- **Cost.** About USD 0.008 per call on 30 s clips, 4 calls per entry (1 find, 3 rate): about USD 0.03.

## What it shows

- **It lands near the category but does not order amateurs.** Within ±1 holds from dev to test (68% → 64%), but on
  test the shuffled control scores the same (67%): in a 7th–4th range, an answer of 5th or 6th is within one of
  almost any label. Spearman 0.04 on test says the same.
- **It sees big under-claims, not small ones.** A claim 1 below lands outside the band 15% of the time, 4 below 75%,
  5 or 6 below always. A pro entering 6th is caught; a 5th entering 6th is not.
- **Three samples beat one** on the product's question (71% vs 59% of own-category claims within the band), so the
  extra two calls stay. One sample catches more under-claims (45%) only because its band is narrower, which also
  flags more honest players.
- **Showing the model the claim does not help.** Asked to flag a contradiction, it leaves 97% of honest claims alone
  but catches only 30% of claims 2 below: it mostly goes along with the claim (our read of those two numbers).
- **The gate works**: not-padel clips are rejected before anything is rated.

So P-Rank is a helper for the coach, not a judge.

## What we tried, in order

| When | What changed | Result | What we kept |
|---|---|---|---|
| 2026-10-25 | **Stability**: the same clip three times, four players, the first rubric | The level moved 0.2 to 0.7 per player, and the category flipped for 3 of 4 | Three samples at temperature 0, merged by the median; the band shows the spread |
| 2026-10-26 | **First rubric**: five criteria scored 1.0–7.0 (strokes, consistency, movement, pace, net height), category computed in code; scores snapped to 0.5, movement nulled when the feet are hidden. 39 public 10 s clips, all four players rated in one call (140 data points) | Within ±1: 58%, against 52% for the baseline and 37% at random; exact 15%; 8 of 8 negatives rejected | The not-padel gate and the ±1 rule |
| 2026-10-27 | **One call per player**, the one the entrant picks, instead of all four in one call. A product decision: the other three were rated for nobody | Re-scored from the cached answers: own-category claims within the band ≈43% one per call vs ≈57% all four; claims 2 below caught ≈51% vs ≈35%. Approximate: the re-scoring gives 43% where the report of the time said 50% | One call per player |
| 2026-10-28 | **Rubric B**: the player followed by their clothes, every shot described with its second and technique, the model names the category directly, in Rioplatense Spanish; 30 s clips instead of 10 s | Within ±1 on dev from 49% to 68%; own category within the band 71% | Rubric B, 30 s clips |
| 2026-10-28 | **1 sample instead of 3** (ablation) | 59% own category within, 59% ±1 | Three samples |
| 2026-10-28 | **Claim shown, flag contradictions** (ablation) | 97% of honest claims not flagged, 30% of claims 2 below flagged | Not used: the blind rating stays |
| 2026-10-28 | **Test set**, 12 clips from other finals, run once | 64% ±1, 82% own category within, 20% of claims 2 below caught; control 67% / 83% / 23% | The read: a helper, a coach confirms |

## Gaps

- **Small sample.** 17 dev clips and 34 players give intervals of about ±17 points, with 2 to 4 clips per category,
  mostly from one channel. The test set has no negatives and no category above 4th.
- **Measured together.** Rubric B changed four things at once (clothes, shots, a direct category, 30 s clips), so
  what each adds is not known.
- **Find is not measured on its own**: whether it finds every player and whether the rating follows the right one by
  their clothes. A wrong player would hide inside the rating numbers.
- **Noisy labels.** The tournament category is a proxy for each player's level.
- **Next**: more clips per category from more channels, a confusion matrix from the cached answers, a Find check
  against hand-drawn boxes, and an auto-approve rule only if it passes a threshold on a fresh test set.

## Run it

```sh
EVAL_PLAYERS=near infisical run -- bun eval/run.ts dev eval/clips/dev    # paid: 1 find + 3 rate calls per player
bun eval/report.ts dev                                                   # no model calls -> REPORT.md, summary.json
infisical run -- bun eval/contradiction.ts dev eval/clips/dev           # the claim-shown ablation
```
