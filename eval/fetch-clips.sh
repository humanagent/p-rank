#!/usr/bin/env bash
# Downloads every labelled clip of a set (dev or test): SECONDS_PER_CLIP (default 30) of each YouTube video from its
# start second, as <id>.mp4.
# Usage: [SECONDS_PER_CLIP=10] eval/fetch-clips.sh <dev|test> <folder>   (needs yt-dlp and ffmpeg)
set -euo pipefail
set_="${1:?usage: eval/fetch-clips.sh <dev|test> <folder>}"
out="${2:?usage: eval/fetch-clips.sh <dev|test> <folder>}"
labels="$(dirname "$0")/$set_/labels.tsv"
len="${SECONDS_PER_CLIP:-30}"
mkdir -p "$out"
cp "$labels" "$out/labels.tsv"

grep -v '^#' "$labels" | tail -n +2 | while IFS=$'\t' read -r id youtube _ start _; do
  [ -f "$out/$id.mp4" ] && continue
  yt-dlp -q -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]" \
    --download-sections "*${start}-$((start + len))" --force-keyframes-at-cuts \
    --merge-output-format mp4 -o "$out/$id.%(ext)s" "https://www.youtube.com/watch?v=$youtube" || { echo "$id failed"; continue; }
  echo "$id"
done
