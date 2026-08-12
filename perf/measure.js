// YTaq 計測スクリプト
//
// 使い方: YouTube のホームか検索結果を開き、DevTools のコンソールに
//         このファイルの中身を貼って Enter。約12秒の自動スクロール中の
//         フレーム時間と DOM の増え方を測る。
//
//   1. 拡張を「無効」にして計測 → about:addons で有効化 → 再読み込みして計測
//   2. window.__ytaqPerf に結果が溜まるので、最後に YTaqMeasure.compare() で比較
//
// なぜ Long Tasks API を使わないか: Firefox が未実装のため。
// 体感に効くのは結局「フレームを落としたかどうか」なので rAF の間隔を直接測る。

(function () {
	'use strict';

	const DURATION_MS = 12000;
	const SCROLL_STEP = 900;      // 1回のスクロール量(px)
	const SCROLL_EVERY_MS = 400;  // スクロール間隔

	function nodeCount() {
		return document.getElementsByTagName('*').length;
	}

	function resourceStats() {
		const entries = performance.getEntriesByType('resource');
		let bytes = 0;
		for (const e of entries) bytes += e.transferSize || 0;
		return { count: entries.length, kb: Math.round(bytes / 1024) };
	}

	function percentile(sorted, p) {
		if (!sorted.length) return 0;
		const i = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
		return sorted[i];
	}

	function run(label) {
		return new Promise(resolve => {
			const startNodes = nodeCount();
			const startRes = resourceStats();
			const frames = [];

			let last = performance.now();
			const t0 = last;
			let running = true;

			function tick(now) {
				if (!running) return;
				frames.push(now - last);
				last = now;
				if (now - t0 >= DURATION_MS) return finish();
				requestAnimationFrame(tick);
			}

			const scroller = setInterval(() => {
				window.scrollBy(0, SCROLL_STEP);
			}, SCROLL_EVERY_MS);

			function finish() {
				running = false;
				clearInterval(scroller);

				const sorted = frames.slice().sort((a, b) => a - b);
				const endNodes = nodeCount();
				const endRes = resourceStats();

				// 33ms = 60fps を2フレーム分落とした状態。ここを超えると体感で分かる。
				const janky = frames.filter(f => f > 33).length;
				const severe = frames.filter(f => f > 100).length;

				const result = {
					label,
					frames: frames.length,
					medianMs: +percentile(sorted, 0.5).toFixed(1),
					p95Ms: +percentile(sorted, 0.95).toFixed(1),
					worstMs: +percentile(sorted, 1).toFixed(1),
					'jank>33ms': janky,
					'jank%': +(janky / frames.length * 100).toFixed(1),
					'freeze>100ms': severe,
					nodesStart: startNodes,
					nodesEnd: endNodes,
					nodesAdded: endNodes - startNodes,
					reqCount: endRes.count - startRes.count,
					reqKB: endRes.kb - startRes.kb
				};

				window.__ytaqPerf = window.__ytaqPerf || [];
				window.__ytaqPerf.push(result);

				console.table([result]);
				resolve(result);
			}

			console.log(`[YTaqMeasure] "${label}" 計測開始 — ${DURATION_MS / 1000}秒間スクロールします。触らないでください。`);
			requestAnimationFrame(tick);
		});
	}

	window.YTaqMeasure = {
		run,
		compare() {
			const runs = window.__ytaqPerf || [];
			if (runs.length < 2) {
				console.warn('[YTaqMeasure] 比較には2回以上の計測が必要です');
				return;
			}
			console.table(runs);
			const [a, b] = [runs[0], runs[runs.length - 1]];
			console.log(
				`[YTaqMeasure] ${a.label} → ${b.label}\n` +
				`  中央値フレーム時間: ${a.medianMs}ms → ${b.medianMs}ms\n` +
				`  p95:                ${a.p95Ms}ms → ${b.p95Ms}ms\n` +
				`  ジャンク率:         ${a['jank%']}% → ${b['jank%']}%\n` +
				`  DOM 増加:           +${a.nodesAdded} → +${b.nodesAdded}`
			);
		},
		reset() {
			window.__ytaqPerf = [];
		}
	};

	console.log('[YTaqMeasure] 準備完了。 YTaqMeasure.run("拡張OFF") のように呼んでください。');
})();
