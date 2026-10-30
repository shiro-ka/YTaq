#!/bin/bash
set -eu
cd "$(dirname "$0")"

SUISOU="${SUISOU:-$HOME/dev/Suisou}"
[ -f "$SUISOU/pages/palette.css" ] || { echo "見つからない: $SUISOU/pages/palette.css" >&2; exit 1; }

python3 "$SUISOU/tools/bundle.py" >/dev/null
cp "$SUISOU/pages/palette.css" suisou-palette.css
cp "$SUISOU/pages/v3/suisou.css" options/suisou.css
echo "書いた: suisou-palette.css ($(grep -c '^\[data-suisou-theme~=' suisou-palette.css) ブロック) / options/suisou.css"
