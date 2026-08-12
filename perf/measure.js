// YTaq 計測スクリプト
//
// 使い方: YouTube の「固定の URL」（検索結果 or チャンネルの動画タブ）を開き、
//         DevTools のコンソールにこのファイルの中身を貼って Enter。
//
//   YTaqMeasure.ab()            ← 推奨。perf 設定の ON/OFF を自動で A/B 比較
//   YTaqMeasure.run("ラベル")    ← 1回だけ測る（拡張そのものの ON/OFF 比較用）
//
// --- 計測条件の設計について ------------------------------------------------
// 最初は「一定ピクセル数スクロールする」方式にしていたが、これは間違いだった。
// content-visibility:auto は画面外要素を contain-intrinsic-size に潰すので
// ページ全体が短くなる。同じピクセル数でも ON の方がずっと下まで到達し、
// 先に底に着いて無限スクロールの追加読み込みを誘発する。結果として
// 「ON だけ大量の DOM 構築とネットワークをやっている」状態を比較していた。
//
// 正しい条件は「同じ本数の動画カードを通過する」こと。なので:
//   1. 先に一度だけウォームアップして十分な件数を読み込んでおく
//   2. 計測中は読み込み済みの範囲だけを走査し、追加読み込みを起こさせない
//   3. nodesAdded が 0 付近であることを毎回確認する（0 でなければ結果は無効）
//
// なぜ Long Tasks API を使わないか: Firefox が未実装。体感に効くのは結局
// 「フレームを落としたか」なので rAF の間隔を直接測る。

(function () {
	'use strict';

	const ITEM_SELECTOR = [
		'ytd-rich-item-renderer',
		'ytd-video-renderer',
		'ytd-grid-video-renderer',
		'yt-lockup-view-model'
	].join(',');

	const WARMUP_TARGET = 120;   // 計測前に読み込んでおきたいカード数
	const TRAVERSE_ITEMS = 80;   // 1回の計測で通過するカード数（上限）
	const TAIL_MARGIN = 24;      // 末尾に残す余白。追加読み込みを起こさないため
	const STEP_ITEMS = 2;        // 何枚ずつ飛ばすか
	const STEP_MS = 220;         // 1ステップの間隔
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

	/** 計測前に十分な件数を読み込ませる。全計測を通して一度だけ実行する。 */
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

	/**
	 * 読み込み済みカードを一定間隔で通過しながら rAF の間隔を測る。
	 * ピクセルではなく「カード何枚目」を基準にするので、
	 * ページの高さが変わる設定同士でも同じ量の中身を通過できる。
	 */
	function traverse(label) {
		return new Promise(resolve => {
			const list = items();
			// 末尾に近づくと無限スクロールが発火してしまうので余白を残す。
			// ここを list.length にすると必ず追加読み込みが混ざる（前回の失敗）。
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
				// 閾値を 33ms 固定にすると 120Hz 環境では 4 フレーム落ちに相当し緩すぎる。
				// 実測の中央値（= その環境のフレーム間隔）の 2 倍を「1フレーム落とした」とみなす。
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
					// 0 付近でなければ追加読み込みが混ざっており、その回は無効
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

		// ON→OFF→OFF→ON。走査で DOM が増えて後半ほど不利になるので、
		// 左右対称に並べて線形のドリフトを打ち消す。
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
