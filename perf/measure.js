(function () {
	'use strict';

	const ITEM_SELECTOR = [
		'ytd-rich-item-renderer',
		'ytd-video-renderer',
		'ytd-grid-video-renderer',
		'yt-lockup-view-model'
	].join(',');

	const WARMUP_TARGET = 120;
	const TRAVERSE_ITEMS = 80;
	const TAIL_MARGIN = 24;
	const STEP_ITEMS = 2;
	const STEP_MS = 220;
	const SETTLE_MS = 1200;

	const PERF_CLASSES = [
		'ytaq-no-hover-preview',
		'ytaq-lazy-offscreen',
		'ytaq-no-ambient',
		'ytaq-no-anim',
		'ytaq-no-shorts'
	];

	const nodeCount = () => document.getElementsByTagName('*').length;
	const items = () => document.querySelectorAll(ITEM_SELECTOR);
	const sleep = ms => new Promise(r => setTimeout(r, ms));

	function percentile(sorted, p) {
		if (!sorted.length) return 0;
		return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
	}

	async function warmup() {
		let stalls = 0;
		while (items().length < WARMUP_TARGET && stalls < 5) {
			const before = items().length;
			window.scrollTo(0, document.body.scrollHeight);
			await sleep(900);
			stalls = items().length > before ? 0 : stalls + 1;
		}
		window.scrollTo(0, 0);
		await sleep(SETTLE_MS);
		console.log(`[YTaqMeasure] ウォームアップ完了: カード ${items().length} 件`);
	}

	function traverse(label) {
		return new Promise(resolve => {
			const list = items();
			const limit = Math.min(TRAVERSE_ITEMS, Math.max(0, list.length - TAIL_MARGIN));
			const startNodes = nodeCount();
			const frames = [];
			let last = performance.now();
			let index = 0;

			function tick(now) {
				frames.push(now - last);
				last = now;
				if (index < limit) return requestAnimationFrame(tick);
				finish();
			}

			const stepper = setInterval(() => {
				if (index >= limit) return;
				const el = list[index];
				if (el && el.isConnected) {
					window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80);
				}
				index += STEP_ITEMS;
			}, STEP_MS);

			function finish() {
				clearInterval(stepper);
				const sorted = frames.slice().sort((a, b) => a - b);
				const median = percentile(sorted, 0.5);
				const jankThreshold = Math.max(median * 2, 12);
				const janky = frames.filter(f => f > jankThreshold).length;
				resolve({
					label,
					medianMs: +median.toFixed(1),
					jank閾値: +jankThreshold.toFixed(1),
					p95Ms: +percentile(sorted, 0.95).toFixed(1),
					worstMs: +percentile(sorted, 1).toFixed(1),
					'jank%': +(janky / frames.length * 100).toFixed(1),
					'freeze>100ms': frames.filter(f => f > 100).length,
					nodesAdded: nodeCount() - startNodes
				});
			}

			requestAnimationFrame(tick);
		});
	}

	function setPerfEnabled(on) {
		PERF_CLASSES.forEach(c => document.documentElement.classList.toggle(c, on));
	}

	async function ab() {
		const had = PERF_CLASSES.filter(c => document.documentElement.classList.contains(c));
		if (!had.length) {
			console.warn('[YTaqMeasure] perf クラスが付いていません。拡張が動いていない可能性があります。');
		}

		await warmup();

		const available = items().length - TAIL_MARGIN;
		if (available < 30) {
			console.warn(
				`[YTaqMeasure] 走査できるカードが ${Math.max(0, available)} 件しかありません。` +
				' 件数の多いページ（ホームや登録チャンネル）で試すか、先に手動で下までスクロールしてください。'
			);
		}

		const order = [true, false, false, true];
		const results = [];

		for (let i = 0; i < order.length; i++) {
			setPerfEnabled(order[i]);
			window.scrollTo(0, 0);
			await sleep(SETTLE_MS);
			console.log(`[YTaqMeasure] ${i + 1}/${order.length} — perf ${order[i] ? 'ON' : 'OFF'}（触らないでください）`);
			results.push(await traverse(order[i] ? 'ON' : 'OFF'));
		}

		PERF_CLASSES.forEach(c => document.documentElement.classList.toggle(c, had.includes(c)));

		const dirty = results.filter(r => r.nodesAdded > 200);
		if (dirty.length) {
			console.warn(
				`[YTaqMeasure] ${dirty.length} 回で追加読み込みが混ざりました（nodesAdded > 200）。` +
				' 結果は信用できません。TRAVERSE_ITEMS を減らすか、件数の多いページで再試行してください。'
			);
		}

		const avg = (label, key) => {
			const xs = results.filter(r => r.label === label).map(r => r[key]);
			return +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
		};

		const summary = ['medianMs', 'p95Ms', 'jank%', 'freeze>100ms'].map(key => ({
			指標: key,
			'perf OFF': avg('OFF', key),
			'perf ON': avg('ON', key),
			'改善（正なら ON が良い）': +(avg('OFF', key) - avg('ON', key)).toFixed(1)
		}));

		console.table(results);
		console.table(summary);
		window.__ytaqPerf = results;
		return summary;
	}

	async function run(label) {
		await warmup();
		window.scrollTo(0, 0);
		await sleep(SETTLE_MS);
		console.log(`[YTaqMeasure] "${label}" 計測開始（触らないでください）`);
		const r = await traverse(label);
		window.__ytaqPerf = window.__ytaqPerf || [];
		window.__ytaqPerf.push(r);
		console.table([r]);
		return r;
	}

	window.YTaqMeasure = {
		ab,
		run,
		compare() {
			const runs = window.__ytaqPerf || [];
			if (runs.length < 2) return console.warn('[YTaqMeasure] 2回以上必要です');
			console.table(runs);
		},
		reset() { window.__ytaqPerf = []; }
	};

	console.log('[YTaqMeasure] 準備完了。 YTaqMeasure.ab() で自動 A/B 比較。');
})();
