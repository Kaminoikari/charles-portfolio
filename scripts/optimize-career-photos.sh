#!/usr/bin/env bash
#
# Optimize career photos into the two-tier WebP set that CareerGallery expects.
#
# Usage:
#   scripts/optimize-career-photos.sh <prefix> <image...>
#
# For the Nth input image (1-based), writes under public/assets/career/:
#   <prefix>-<N>.webp        rail thumbnail   (longest edge <= 1200, q80)
#   <prefix>-<N>-full.webp   lightbox source  (longest edge <= 2400, q86)
#
# Then reference them in src/data/career-photos.ts, e.g.
#   { src: '/assets/career/<prefix>-1.webp', full: '/assets/career/<prefix>-1-full.webp', alt: '...' }
#
# Never upscales: a source smaller than the target edge is encoded at its own size.
# Requires: cwebp (brew install webp) and sips (macOS built-in).

set -euo pipefail

THUMB_EDGE=1200
THUMB_Q=80
FULL_EDGE=2400
FULL_Q=86

OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/assets/career"

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <prefix> <image...>" >&2
  echo "example: $0 nueip ~/Downloads/team1.jpg ~/Downloads/team2.jpg" >&2
  exit 1
fi
command -v cwebp >/dev/null || { echo "error: cwebp not found (brew install webp)" >&2; exit 1; }
command -v sips  >/dev/null || { echo "error: sips not found (macOS only)" >&2; exit 1; }

prefix="$1"; shift
mkdir -p "$OUT_DIR"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# Largest of width/height, so we cap the longest edge regardless of orientation.
longest_edge() {
  sips -g pixelWidth -g pixelHeight "$1" 2>/dev/null \
    | awk '/pixelWidth/{w=$2} /pixelHeight/{h=$2} END{print (w>h)?w:h}'
}

# clamp <desired> <actual-longest> -> min, so we downscale only (never upscale).
clamp() { [ "$1" -gt "$2" ] && echo "$2" || echo "$1"; }

i=0
for src in "$@"; do
  i=$((i + 1))
  if [ ! -f "$src" ]; then
    echo "skip (not a file): $src" >&2
    continue
  fi
  edge="$(longest_edge "$src")"
  thumb_edge="$(clamp "$THUMB_EDGE" "$edge")"
  full_edge="$(clamp "$FULL_EDGE" "$edge")"

  sips -Z "$thumb_edge" "$src" --out "$tmp/t.jpg" >/dev/null 2>&1
  cwebp -quiet -q "$THUMB_Q" -m 6 "$tmp/t.jpg" -o "$OUT_DIR/${prefix}-${i}.webp"

  sips -Z "$full_edge" "$src" --out "$tmp/f.jpg" >/dev/null 2>&1
  cwebp -quiet -q "$FULL_Q" -m 6 "$tmp/f.jpg" -o "$OUT_DIR/${prefix}-${i}-full.webp"

  # Thumbnail pixel size feeds the `w`/`h` fields in career-photos.ts (the rail
  # reserves each frame's width from this, avoiding layout shift).
  tw="$(sips -g pixelWidth "$OUT_DIR/${prefix}-${i}.webp" 2>/dev/null | awk '/pixelWidth/{print $2}')"
  th="$(sips -g pixelHeight "$OUT_DIR/${prefix}-${i}.webp" 2>/dev/null | awk '/pixelHeight/{print $2}')"

  printf '%-14s thumb %-6s full %s\n' "${prefix}-${i}" \
    "$(du -h "$OUT_DIR/${prefix}-${i}.webp" | cut -f1)" \
    "$(du -h "$OUT_DIR/${prefix}-${i}-full.webp" | cut -f1)"
  printf "    { src: '/assets/career/%s-%d.webp', full: '/assets/career/%s-%d-full.webp', w: %s, h: %s, alt: '' },\n" \
    "$prefix" "$i" "$prefix" "$i" "$tw" "$th"
done

echo "done: ${i} image(s) -> ${OUT_DIR}"
echo "Paste the lines above into the right org in src/data/career-photos.ts and fill in alt."
