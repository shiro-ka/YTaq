#!/bin/bash
set -eu
cd "$(dirname "$0")"

SUISOU="${SUISOU:-$HOME/dev/Suisou}"
SRC="$SUISOU/dist/suisou-trench-blue.css"
[ -f "$SRC" ] || { echo "見つからない: $SRC" >&2; exit 1; }

# テーマ本体とアクセントの2ブロックから --suisou- 行だけ抜く
extract() {
  awk -v sel="$1" '
    index($0, sel) == 1 { on = 1; next }
    on && /^\}/ { on = 0 }
    on && /--suisou-/ { print }
  ' "$SRC"
}

{
  cat <<'HEAD'
/* YTaq の色 = Suisou trench × blue。
 * 生成物。編集しない。作り直すのは ./sync-suisou.sh（色の根拠は Suisou 側）。
 * https://github.com/shiro-ka/Suisou */
:root {
HEAD
  extract '[data-suisou-theme="trench"] {'
  extract '[data-suisou-theme="trench"][data-suisou-accent="blue"] {'
  cat <<'TAIL'

  /* 寸法だけは写せない: YouTube は html{font-size:10px} なので rem が縮む。px で持つ */
  --suisou-radius-small: 4px;
  --suisou-radius: 8px;
  --suisou-radius-pill: 999px;
  --suisou-focus: 2px solid var(--suisou-focus-ring);
  --suisou-motion-fast: 120ms;
  --suisou-ease: cubic-bezier(0.2, 0, 0, 1);
}
@media (prefers-reduced-motion: reduce) {
  :root { --suisou-motion-fast: 0.01ms; }
}
TAIL
} > ytaq-variables.css

echo "書いた: ytaq-variables.css ($(grep -c -- '--suisou-' ytaq-variables.css) トークン)"
