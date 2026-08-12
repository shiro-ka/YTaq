// YTaq Perf: youtube.com そのものを軽くするモジュール
//
// base.js（YouTube 本体の SPA ランタイム）は消せない。消したらページが死ぬ。
// なので「base.js が作った重い仕事を止める」引き算に徹する。効果の大きい順:
//   1. ホバープレビュー再生の停止  … サムネに乗せるだけで video がデコードを始める
//   2. 画面外要素のレンダリング省略 … 無限スクロールで DOM が単調増加するため
//   3. アンビエント照明の停止      … watch ページの常時 CPU 消費
//   4. アニメーション停止          … スクロール中のコンポジット削減
//
// CSS 側の実体は perf/ytaq-perf.css。ここは <html> のクラス付け外しと、
// CSS だけでは止められない「既に再生が始まった要素」の後始末を担当する。

(function () {
	'use strict';

	const KEY = 'ytaq_perf';

	const DEFAULTS = {
		hoverPreview: true,   // ホバープレビューを止める
		lazyOffscreen: true,  // 画面外を content-visibility でスキップ
		ambient: true,        // シネマティック照明を止める
		animations: true,     // アニメーション/トランジションを止める
		hideShorts: false     // Shorts 棚ごと隠す（好みが分かれるので既定 OFF）
	};

	// クラス名は CSS 側と対応。値が true のときクラスを付ける。
	const CLASS_MAP = {
		hoverPreview: 'ytaq-no-hover-preview',
		lazyOffscreen: 'ytaq-lazy-offscreen',
		ambient: 'ytaq-no-ambient',
		animations: 'ytaq-no-anim',
		hideShorts: 'ytaq-no-shorts'
	};

	let settings = DEFAULTS;

	function applyClasses() {
		const root = document.documentElement;
		if (!root) return;
		for (const key in CLASS_MAP) {
			root.classList.toggle(CLASS_MAP[key], !!settings[key]);
		}
	}

	// --- ホバープレビューの実効的な停止 -------------------------------------
	// CSS の display:none は「見えなくする」だけで、要素が生きていれば
	// デコードは走り続ける。そもそもプレビュー生成のトリガである
	// mouseover をサムネ上で握りつぶすのが一番安い。
	// :hover による純粋な CSS 演出は JS イベントを使わないので壊れない。

	// closest() は毎回ツリーを遡るので、セレクタは実際にプレビューを抱える
	// 2種類だけに絞る。親のレンダラまで含めると mouseover ごとのコストが増える。
	const HOVER_TARGETS = 'ytd-thumbnail,yt-lockup-view-model';

	function blockHoverEvent(e) {
		if (!settings.hoverPreview) return;
		const t = e.target;
		if (!t || !t.closest) return;
		if (!t.closest(HOVER_TARGETS)) return;
		// YouTube 側のプレビュー起動ハンドラより先に止める。
		// preventDefault はしない（クリック等の既定動作に影響させないため）。
		e.stopPropagation();
	}

	// 設定変更前に既に走っているプレビューや、すり抜けたものを後始末する
	const PREVIEW_VIDEO = '#video-preview video, ytd-video-preview video, #inline-preview-player video';

	function killLivePreviews(root) {
		const scope = root && root.querySelectorAll ? root : document;
		const vids = scope.querySelectorAll(PREVIEW_VIDEO);
		for (let i = 0; i < vids.length; i++) {
			const v = vids[i];
			if (v.paused && !v.src) continue;
			try {
				v.pause();
				v.removeAttribute('src');
				v.load();
			} catch (e) {
				window.YTaq.warn('preview stop failed:', e);
			}
		}
	}

	// --- アンビエント照明の canvas を実際に外す -----------------------------
	// display:none でも描画ループが止まる保証がないので、canvas 自体を除去する。
	function killAmbientCanvas(root) {
		if (!settings.ambient) return;
		const scope = root && root.querySelectorAll ? root : document;
		const canvases = scope.querySelectorAll('#cinematics canvas, yt-cinematic-container-view-model canvas');
		for (let i = 0; i < canvases.length; i++) canvases[i].remove();
	}

	function sweep(root) {
		if (settings.hoverPreview) killLivePreviews(root);
		killAmbientCanvas(root);
	}

	// --- 起動 ---------------------------------------------------------------

	function start() {
		// クラスは body より先に当てたいので documentElement へ即適用
		applyClasses();

		document.addEventListener('mouseover', blockHoverEvent, true);
		document.addEventListener('mouseenter', blockHoverEvent, true);

		window.YTaq.ready(() => {
			sweep(document);

			// 追加ノードだけを見る。共有 Observer なので専用の監視は増えない。
			window.YTaq.onMutation(added => {
				for (let i = 0; i < added.length; i++) sweep(added[i]);
			});

			window.YTaq.onNavigate(() => sweep(document));
		});
	}

	// 既定値を先に当てておく。storage 読み込みは非同期なので、待つと
	// document_start に間に合わずアニメーションが一瞬走ってしまう。
	applyClasses();

	window.YTaq.getStorage(KEY, null).then(stored => {
		settings = Object.assign({}, DEFAULTS, stored || {});
		start();
	});

	window.YTaq.onStorageChange(KEY, next => {
		settings = Object.assign({}, DEFAULTS, next || {});
		applyClasses();
		sweep(document);
	});
})();
