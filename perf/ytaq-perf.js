// YTaq Perf: youtube.com そのものを軽くするモジュール
//
// base.js（YouTube 本体の SPA ランタイム）は消せない。消したらページが死ぬ。
// なので「base.js が作った重い仕事を止める」引き算に徹する。
//
// ただし当初の想定「無限スクロールで DOM が増える → スクロールが重い」は
// 実測で否定された（ホーム 327 件で A/B、ON/OFF とも median 8ms / jank 0.1%）。
// この環境の本当の痛みはページ遷移であり、そちらはポップアップ側で解決している。
// このモジュールは「未計測だが理屈上効くもの」を既定 ON、
// 「実測で効果が無かったもの」を既定 OFF にして残してある。詳細は DEFAULTS。
//
// CSS 側の実体は perf/ytaq-perf.css。ここは <html> のクラス付け外しと、
// CSS だけでは止められない「既に再生が始まった要素」の後始末を担当する。

(function () {
	'use strict';

	// manifest の content_scripts エントリが2つ（トップ用とサブフレーム用）あり、
	// トップフレームには両方から注入される。二重にリスナーを張らないための番人。
	if (window.__ytaqPerfLoaded) return;
	window.__ytaqPerfLoaded = true;

	const KEY = 'ytaq_perf';

	// 既定値は実測に基づく。ホームで 327 件を A/B 計測したところ、
	// lazyOffscreen と animations はスクロール性能に有意差が出なかった
	// （median 8ms / jank 0.1% で ON/OFF 同値）。効果が確認できないものを
	// 既定で有効にはしない。設定自体は残してあるのでいつでも試せる。
	//
	// hoverPreview と ambient はこの計測ではカバーできていない
	// （前者はホバーしないと発火せず、後者は watch ページ限定）。
	// 「効かない」と示されたわけではないので既定 ON のまま。
	const DEFAULTS = {
		hoverPreview: true,   // ホバープレビューを止める（未計測・理屈上は CPU 削減）
		lazyOffscreen: false, // 画面外を content-visibility でスキップ（実測で効果なし）
		ambient: true,        // シネマティック照明を止める（未計測・watch ページ限定）
		animations: false,    // アニメーション/トランジション停止（実測で効果なし）
		hideShorts: false     // Shorts 棚ごと隠す（好みの問題）
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
