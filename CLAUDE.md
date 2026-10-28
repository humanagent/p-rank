# P-Rank

An AI helper for the coaches who review entries to the Summer Invitational (fictional Meridian Court Club).
An entrant uploads a padel rally, picks themselves and claims a category; P-Rank rates that player and says if the
claim is within ±1 of its band. A coach confirms every entry. The model only describes; code decides.

Next.js 16 (App Router), React 19, TypeScript, Bun. Model: OpenRouter `google/gemini-3.8-flash`, video inline as
base64, strict JSON schema, temperature 0. Local mode (no AWS) first; cloud mode on AWS Amplify Gen 2 in sa-east-1.
Secrets: `infisical run -- bun dev`.

## Rules

- **Never commit, push, merge.** Fabri commits.
- The contract is `src/shared/types.ts`. Only the lead changes it; ask the lead if you need a change.
- Stay in your folders (table below). Need something from another agent's folder? Import it, or leave a
  `// TODO(<agent>):` and tell the lead.
- Local mode keeps singletons on `globalThis` (dev reloads). Never `next build` while `next dev` runs.
- Log every pipeline step as one JSON line (`process.stdout.write`) and append it to `entry.log`.
- Copy in English. Look: luxury club (cream, forest green, bronze, serif headings, a crest).

## Agents and folders

| agent | owns |
|---|---|
| lead | `src/shared/`, `CLAUDE.md`, `package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `amplify/` |
| A Auth | `src/server/auth/`, `src/app/api/auth/`, `src/components/auth/` |
| B Upload + store | `src/server/storage/`, `src/server/store/`, `src/app/api/upload-url/`, `src/app/api/clips/` |
| C Verifier | `src/server/verifier/`, `src/lib/rubric.ts`, `src/app/api/entries/` |
| D Scoring | `src/lib/score.ts`, `src/lib/sides.ts`, `src/lib/categories.ts`, `src/lib/queue.ts`, `src/lib/*.test.ts` |
| E Entry flow | `src/app/enter/`, `src/components/flow/` |
| F Landing | `src/app/page.tsx`, `src/components/landing/` |
| G Club desk | `src/app/club/`, `src/app/api/review/`, `src/components/club/` |
| H Eval + docs | `eval/`, `README.md` |
