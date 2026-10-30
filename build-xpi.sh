#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

css_files=$(ls ytaq-style.css perf/ytaq-perf.css popup/*.css home/*.css subscriptions/*.css folder/*.css rate/*.css)

missing=0
for v in $(grep -ho 'var(--suisou-[a-z0-9-]*' $css_files | sed 's/var(//' | sort -u); do
  grep -q -- "^  $v:" ytaq-variables.css suisou-palette.css || { echo "未定義: $v" >&2; missing=1; }
done

if grep -n 'var(--aq\|var(--ytaq-' $css_files; then
  echo "旧色システムの参照が残っている（上記）" >&2
  missing=1
fi

[ "$missing" = 0 ] || { echo "検査に落ちたので固めない" >&2; exit 1; }

rm -f YTaq.xpi
targets="manifest.json content.js suisou-palette.css ytaq-variables.css ytaq-style.css \
  core theme perf background popup home rate title folder subscriptions options icons"
if command -v zip >/dev/null; then
  zip -r -FS YTaq.xpi $targets -x '*.DS_Store' -x 'perf/measure.js' >/dev/null
else
  python3 - $targets <<'PY'
import os, sys, zipfile
with zipfile.ZipFile('YTaq.xpi', 'w', zipfile.ZIP_DEFLATED) as z:
    for t in sys.argv[1:]:
        paths = [t] if os.path.isfile(t) else \
            [os.path.join(d, f) for d, _, fs in os.walk(t) for f in fs]
        for p in paths:
            if p.endswith('.DS_Store') or p == 'perf/measure.js':
                continue
            z.write(p)
PY
fi
echo "built: $PWD/YTaq.xpi"
