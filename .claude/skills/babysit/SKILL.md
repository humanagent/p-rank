---
name: babysit
description: CI for a take-home repo built by parallel sub-agents. Use when Fabri says "babysit", "check it", "is it green", after any sub-agent finishes, and before he commits. Runs typecheck, tests and build, checks every agent stayed in its folder, and reports. Never commits, pushes or merges.
---

# Babysit (take-home version)

The take-home repo has no CI and several sub-agents writing at once, each in its own folder
(the plan's agent table). This skill is the check that runs between them and Fabri's commit.

**It never commits, pushes or merges.** The repo's hook blocks that anyway; Fabri commits himself.

## Steps

1. **What changed:** `git status --short` and `git diff --stat`.
2. **Folder ownership:** map every changed path to the agent that owns its folder (the agent table in
   the plan, copied into this repo's `CLAUDE.md`). A path no agent owns, or one agent writing in another's
   folder, is a finding. `src/shared/` changes only by the lead.
3. **Checks, in order, stop at the first red:**
   - `bun run typecheck`
   - `bun run test`
   - `bun run build`
4. **Contract:** if `src/shared/types.ts` changed, list every importer and run their tests.
5. **Secrets:** `git diff` must not contain a key; secrets come from Infisical, never from the repo.

## Report

Three lines, then the detail:

- green or red, and the first failing check
- which agents' folders changed, and any path outside its owner
- what Fabri should read before committing (the files, smallest first)

Then stop. Fixing a red check is the owning agent's job, sent back to it with the failing output.
