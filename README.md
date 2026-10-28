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

## Accuracy

Measured on public 30 s clips of padel finals, labelled with the tournament category; the two players nearest the
camera rated with the product's own pipeline. Dev set (17 padel + 3 not padel) for tuning, test set (12 other
finals) run once. 95% bootstrap intervals over clips. Full method, every iteration and the gaps:
[`eval/README.md`](eval/README.md).

| | Within ±1 | Claims their own category: within the band | Claims 2 below: outside the band |
|---|---|---|---|
| **Dev** | 68% (50–85) | 71% (53–85) | 35% (10–67) |
| **Test, run once** | 64% (36–86) | 82% (68–95) | 20% (0–67) |
| Say 7th to everyone, dev / test | 41% / 55% | 41% / 55% | 40% / 0% |
| Shuffled labels, dev / test | 46% / 67% | 54% / 83% | 44% / 23% |

It lands near the category and catches big under-claims (4 or more categories below: 75–100%), but on the test set
it does no better than shuffled labels at telling amateurs apart. So a coach confirms every entry, and auto-approve
stays research.

## What is incomplete (to be done later)

- **Auto-approve**: off on purpose; it would need a rule that passes a threshold on a fresh test set.
- **Eval next steps**: measure Find on its own, a confusion matrix, one ablation per rubric change
  ([`eval/README.md`](eval/README.md#to-be-done-later)).
- **More data**: more clips per category from more channels (today 17 dev clips, 2 to 4 per category, mostly one
  channel), and negatives and higher categories in the test set.
- **Not production ready**: no queue or concurrency cap on model calls; Cognito's default email sender (~50 a day);
  no consent or delete flow for the other players in a clip; no end-to-end test; deployed from a laptop.

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

