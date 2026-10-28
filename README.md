# P-Rank

A helper for the coaches who review entries to the Summer Invitational at the (fictional) Meridian Court Club.
An entrant uploads a short padel rally, picks themselves in it and claims a category (7th = beginner, 1st = pro).
P-Rank rates that player and says whether the claim is within ±1 of the band it saw. **A coach confirms every
entry; nothing is auto-approved.** The model only describes what it sees; code merges the answers and decides.

Deployed: https://d1b9aupggweoi.cloudfront.net

## The flow

1. `/`: the club's landing page.
2. `/enter`: sign in with an email code, upload a clip, pick yourself from the players found, claim a category,
   get the verdict and the draws you can join (or a waitlist).
3. `/admin`: the coaches' desk (internal, not linked from the landing). Coaches see the queue, approve or reject entries outside the band, confirm or decline
   waitlists. Nobody can review their own entry.

## Development setup

You need [Bun](https://bun.sh) 1.4.4 (the version CI uses) and an [OpenRouter](https://openrouter.ai) API key.
No AWS account, no database: local mode runs everything on your machine.

```bash
git clone https://github.com/humanagent/p-rank.git && cd p-rank
bun install
OPENROUTER_API_KEY=sk-or-... bun dev
```

Open http://localhost:3000.

- Clips and entries are saved under `.data/` (gitignored); delete it to start over.
- The sign-in code is shown on screen instead of emailed, so any email works.
- `coach@meridian.club` (or any `@meridian.club` email) opens `/admin`. Use another email for your own entries:
  nobody reviews their own.
- Each entry costs about USD 0.03 in model calls (1 find, 3 rate).

On the team, secrets come from Infisical instead of the command line: `infisical login` once, then
`infisical run -- bun dev`.

Before a PR: `bun run test` (the unit tests, the same check CI runs) and `bun run typecheck`. Never run `bun run
build` while `bun dev` is running; they share `.next/`.

### Environment variables

Local mode needs only the first one; everything else has a default.

| Variable | Needed | What it does |
|---|---|---|
| `OPENROUTER_API_KEY` | yes, locally | The model calls. In AWS the worker reads it from SSM instead (`OPENROUTER_KEY_PARAM`). |
| `CLUB_EMAILS` | no | Who can open `/admin`: a comma list of emails and `@domain` entries. Default `@meridian.club`. |
| `PRANK_MODEL` | no | OpenRouter model id. Default `google/gemini-3.8-flash`. It must take video input. |
| `SESSION_SECRET` | in AWS | Signs the session cookie. Locally a fixed dev secret is used, with a warning. |
| `PRANK_DATA_DIR` | no | Where local mode keeps clips and entries. Default `.data/`. |

Set by the deploy, not by hand (`amplify/hosting.ts`, `amplify/backend.ts`). Leave them unset locally; each one
switches a piece to AWS: `CLIPS_BUCKET` moves clips to S3 and entries to DynamoDB (then `ENTRIES_TABLE` is required),
`COGNITO_CLIENT_ID` moves sign-in to Cognito, `WORKER_FUNCTION` runs the verifier in its Lambda,
`OPENROUTER_KEY_PARAM` reads the key from SSM, `AWS_REGION` defaults to `sa-east-1`. With `CLIPS_BUCKET` or
`COGNITO_CLIENT_ID` set, `SESSION_SECRET` is required.

Eval only (see Eval below): `EVAL_PLAYERS=near` rates only the two players nearest the camera, `DETECT_CACHE`
reuses find answers from a results file, `EVAL_OUT` changes the output file, `CLIP_SECONDS` labels the report.

## What to try

- **Happy path:** sign in as any non-club email, upload a padel rally, pick yourself, claim your category. The
  verdict says within or outside, with the band and the shots it based it on.
- **A tennis clip gets rejected:** upload a tennis (or pickleball, squash) clip; the find step says it is not
  padel and the entry stops there.
- **Claim 2 below:** on the same clip, claim two categories weaker than the band; it lands outside and goes to the
  admin.
- **Admin:** sign in as `coach@meridian.club`, open `/admin`, approve or reject the entry outside the band.
- **Self-review is blocked:** enter a clip as `coach@meridian.club`, then try to review it from `/admin` (403).

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

Run during the prep, before the 2-hour build, on the same prompts and pipeline this repo ships
(`src/lib/rubric.ts`, find → rate ×3 → median and band → ±1). The cached answers are in `eval/<set>/results.jsonl`,
so the reports regenerate without a model call.

Public 30 s clips from padel tournament finals, each labelled with the category in the video title (every player
of that final gets it); the two players nearest the camera rated. **Dev**: 17 padel clips (7th to 1st, no 2nd) and
3 negatives, where every prompt was tuned. **Test**: 12 clips from other finals (7th to 4th) at a random second,
run once. Labels: `eval/<set>/labels.tsv`; clips are not in git (`eval/fetch-clips.sh`).

| | Exact | Within ±1 | Claims their own category: within the band | Claims 2 below: outside the band |
|---|---|---|---|---|
| **Production, dev** | 29% (12–50) | 68% (50–85) | 71% (53–85) | 35% (10–67) |
| **Production, test (run once)** | 18% (0–41) | 64% (36–86) | 82% (68–95) | 20% (0–67) |
| 1 sample instead of 3, dev | 26% | 59% | 59% | 45% |
| Claim shown, flag contradictions, dev | – | – | 97% not flagged | 30% flagged |
| Baseline: say 7th to everyone, dev / test | 24% / 27% | 41% / 55% | 41% / 55% | 40% / 0% |
| Control: shuffled labels, 1000 shuffles, dev / test | 17% / 24% | 46% / 67% | 54% / 83% | 44% / 23% |

95% bootstrap intervals over clips. Not-padel gate: 3 of 3 negatives rejected on dev; 1 of 29 padel clips wrongly
rejected (a changeover at the test's random second). Latency after "Verify me": p50 38 s, p90 53 s. P-Rank lands near
the category but doesn't separate amateurs (on test, shuffled labels score the same), so a coach confirms every entry.
Full tables: `eval/dev/REPORT.md`, `eval/test/REPORT.md`.

```bash
EVAL_PLAYERS=near infisical run -- bun eval/run.ts dev <clips folder>   # paid: 1 find + 3 rate calls per player
bun eval/report.ts dev                                                  # no model calls -> REPORT.md, summary.json
infisical run -- bun eval/contradiction.ts dev <clips folder>           # the claim-shown ablation
```

## Deploy

AWS `sa-east-1`, Amplify Gen 2 (`amplify/`): Cognito (email codes, no passwords), S3 (clips, presigned PUT/GET,
deleted after 30 days), DynamoDB (one item per entry, compare-and-set writes), the verifier as a Lambda invoked
asynchronously, the Next app on CloudFront + Lambda, CloudWatch (one JSON line per step). The OpenRouter key lives in
SSM as a SecureString and only the worker can read it. Secrets come from Infisical.

```sh
infisical run -- sh -c 'aws ssm put-parameter --region sa-east-1 --type SecureString --overwrite \
  --name /amplify/p-rank-take-home/openrouter-api-key --value "$OPENROUTER_API_KEY"'
yes | infisical run -- env npm_config_user_agent=npm/10 bunx ampx deploy --identifier p-rank-take-home
```

Everything runs on Bun except two things Bun can't do here: the Amplify CLI refuses Bun as a package manager (the
`npm_config_user_agent` override gets past that check; the project itself stays on Bun), and the Lambdas run on
AWS's Node runtime.

## What is incomplete

[TK]
