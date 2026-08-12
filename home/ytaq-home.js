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

	function onClick(e) {
		// 修飾キー・中クリックは「新しいタブで開く」意図なので邪魔しない
		if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

		const t = e.target;
		if (!t || !t.closest) return;

		// 自前 UI（ポップアップやリストカラム）の中のクリックは対象外
		if (t.closest('#ytaq-popup, #ytaq-channel-modal, .ytaq-list-column')) return;

		const a = t.closest('a[href]');
		if (!a) return;

		const href = a.href;
		// 再生リストへの遷移は挙動が変わるので素通しする
		if (href.includes('&list=') || href.includes('?list=')) return;

		const videoId = getVideoId(href);
		if (!videoId) return;

		if (!window.YTaqPopup) return; // 初期化前なら通常遷移に任せる

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		window.YTaqPopup.showVideoPopup(videoId, extractTitle(a), href.includes('/shorts/'));
	}

	YTaq.ready(() => {
		// キャプチャ段階で YouTube 自身のハンドラより先に取る
		document.addEventListener('click', onClick, true);
		YTaq.log('home: click delegation ready');
	});
})();
