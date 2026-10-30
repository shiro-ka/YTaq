#!/bin/bash
set -eu
cd "$(dirname "$0")"

SUISOU="${SUISOU:-$HOME/dev/Suisou}"
SRC="$SUISOU/pages/palette.css"
[ -f "$SRC" ] || { echo "見つからない: $SRC" >&2; exit 1; }

cp "$SRC" suisou-palette.css
echo "書いた: suisou-palette.css ($(grep -c '^\[data-suisou-theme~=' suisou-palette.css) ブロック)"
