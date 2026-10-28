---
name: babysit
description: Runs the unit tests, the same check CI runs. Use when Fabri says "babysit", "check it", "is it green", after any sub-agent finishes, and before he commits. Never commits, pushes or merges.
---

# Babysit

Runs locally the one check CI runs (`.github/workflows/ci.yml`): the unit tests.

**It never commits, pushes or merges.** Fabri commits himself.

## Steps

1. `bun run test`

## Report

One line: green or red. If red, the failing tests and their output.

Then stop. Fixing a red test is the owning agent's job, sent back to it with the failing output.
