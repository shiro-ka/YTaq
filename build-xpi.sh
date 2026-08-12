#!/usr/bin/env bash
# YTaq を .xpi に固める。
# flatpak Firefox のファイル選択ポータル問題(ディレクトリ読み込みだと
# manifest.json 1ファイルしか渡らない)を回避するため、1ファイルにまとめる。
#
# 同梱するのは manifest が実際に参照するものだけ。
# css/ と ytaq-results.css は現状どこからも参照されていないので入れない。
set -euo pipefail
cd "$(dirname "$0")"
rm -f YTaq.xpi
zip -r -FS YTaq.xpi \
  manifest.json content.js \
  ytaq-variables.css ytaq-style.css \
  core perf background popup home rate title folder subscriptions options icons \
  -x '*.DS_Store' -x 'perf/measure.js' >/dev/null
echo "built: $PWD/YTaq.xpi"
