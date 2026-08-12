// YTaq: 動画リンクのクリックを奪ってポップアップ表示に差し替える
//
// 以前は body 全体の MutationObserver（デバウンス無し）が発火のたびに
// document 全体へ querySelectorAll を投げ、全リンクに click ハンドラを
// 付けて回っていた。YouTube はスクロール中ほぼ毎フレーム DOM を触るので、
// これがスクロールジャンクの最大要因だった。
//
// イベント委譲なら document に1個のリスナーで済み、DOM 走査はゼロになる。

(function () {
	'use strict';

	const YTaq = window.YTaq;

	// 動画クリック時の挙動。
	//   popup  : ポップアップ(iframe で /embed/)。フィードを生かしたまま観られる
	//   newtab : 新しいタブで開く。フィードのタブに一切触らないので再描画ゼロ
	//   normal : 何もしない（YouTube 標準の SPA 遷移）
	const CLICK_KEY = 'ytaq_click';
	let clickAction = 'popup';

	YTaq.getStorage(CLICK_KEY, null).then(v => { clickAction = v || 'popup'; });
	YTaq.onStorageChange(CLICK_KEY, v => { clickAction = v || 'popup'; });

	const VIDEO_ID_PATTERNS = [
		/[?&]v=([\w-]{11})/,      // /watch?v=ID
		/\/shorts\/([\w-]{11})/,  // /shorts/ID
		/\/embed\/([\w-]{11})/    // /embed/ID
	];

	function getVideoId(url) {
		if (!url) return null;
		for (const re of VIDEO_ID_PATTERNS) {
			const m = url.match(re);
			if (m) return m[1];
		}
		return null;
	}

	// クリックされた a から動画タイトルを引く。
	// a 自身の title/aria-label が最もきれいで、無ければ親レンダラから拾う。
	const RENDERERS = 'ytd-video-renderer, ytd-rich-item-renderer, ytd-grid-video-renderer, ' +
		'ytd-compact-video-renderer, yt-lockup-view-model';

	const TITLE_SELECTORS = [
		'#video-title',
		'.yt-lockup-metadata-view-model__title',
		'h3 a',
		'yt-formatted-string'
	].join(',');

	function extractTitle(a) {
		let title = a.getAttribute('title') || a.getAttribute('aria-label') || '';

		if (!title) {
			const parent = a.closest(RENDERERS);
			const el = (parent && parent.querySelector(TITLE_SELECTORS)) || a.querySelector(TITLE_SELECTORS);
			if (el) {
				title = el.getAttribute('title') || el.getAttribute('aria-label') ||
					(el.textContent || '').trim();
			}
		}

		// aria-label には尺が混ざる（「... 42 分」「... 12:34」）ので落とす。
		// 落とした結果が空になる場合は元に戻す。
		const cleaned = title
			.replace(/\s+\d+\s*(分|秒|時間)$/, '')
			.replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*$/, '')
			.trim();

		return cleaned || title;
	}

	/**
	 * クリックされた a を探す。
	 *
	 * closest() はシャドウ DOM の境界を越えられない。YouTube の新 UI には
	 * シャドウルート内に <a> を持つカードがあり、その場合 e.target は
	 * ホスト要素に retarget されるので closest では見つからない。
	 * これが「カードによってポップアップが出たり出なかったりする」原因。
	 * composedPath() はシャドウ境界を含む全経路を返すので、まずこちらを見る。
	 */
	function findAnchor(e, target) {
		if (e.composedPath) {
			const path = e.composedPath();
			for (let i = 0; i < path.length; i++) {
				const n = path[i];
				if (n === document || n === window) break;
				if (n.nodeType === 1 && n.tagName === 'A' && n.getAttribute('href')) return n;
			}
		}
		return target.closest ? target.closest('a[href]') : null;
	}

	function onClick(e) {
		// 修飾キー・中クリックは「新しいタブで開く」意図なので邪魔しない
		if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

		const t = e.target;
		if (!t || !t.closest) return;

		// 自前 UI（ポップアップやリストカラム）の中のクリックは対象外
		if (t.closest('#ytaq-popup, #ytaq-channel-modal, .ytaq-list-column')) return;

		const a = findAnchor(e, t);
		if (!a) return;

		const href = a.href;
		// 再生リストへの遷移は挙動が変わるので素通しする
		if (href.includes('&list=') || href.includes('?list=')) {
			YTaq.log('home: skip (playlist)', href);
			return;
		}

		const videoId = getVideoId(href);
		if (!videoId) {
			YTaq.log('home: skip (no video id)', href);
			return;
		}

		if (clickAction === 'normal') return;
		if (clickAction === 'popup' && !window.YTaqPopup) return; // 初期化前は素通し

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		if (clickAction === 'newtab') {
			// フィードのタブには一切触らないので、YouTube の重い再描画が起きない
			window.open(href, '_blank', 'noopener');
			return;
		}

		window.YTaqPopup.showVideoPopup(videoId, extractTitle(a), href.includes('/shorts/'));
	}

	YTaq.ready(() => {
		// キャプチャ段階で YouTube 自身のハンドラより先に取る
		document.addEventListener('click', onClick, true);
		YTaq.log('home: click delegation ready');
	});
})();
