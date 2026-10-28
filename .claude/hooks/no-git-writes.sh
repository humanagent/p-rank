#!/usr/bin/env bash
# PreToolUse hook for take-home repos: Claude never commits or pushes.
# Fabri commits himself, from his terminal or with `! git commit ...` in the session.
# Errs on the side of blocking: any git call whose words include a write subcommand is stopped.
cmd=$(jq -r '.tool_input.command // empty')
printf '%s\n' "$cmd" | tr ';&|' '\n\n\n' | while IFS= read -r seg; do
  if printf '%s' "$seg" | grep -Eq '(^|[[:space:]])git([[:space:]]|$)' &&
     printf '%s' "$seg" | grep -Eq '(^|[[:space:]])(commit|push|merge|rebase|tag|cherry-pick|revert|am|reset)([[:space:]]|$)'; then
    echo "Blocked: in a take-home repo only Fabri commits or pushes. Ask him; he runs it himself (! git commit ...)." >&2
    exit 2
  fi
done
