(function () {
	'use strict';

	const YTaq = window.YTaq;

	let clickAction = YTaqSettings.defaults('click');
	YTaqSettings.watch('click', v => { clickAction = v; });

	const VIDEO_ID_PATTERNS = [
		/[?&]v=([\w-]{11})/,
		/\/shorts\/([\w-]{11})/,
		/\/embed\/([\w-]{11})/
	];

	function getVideoId(url) {
		if (!url) return null;
		for (const re of VIDEO_ID_PATTERNS) {
			const m = url.match(re);
			if (m) return m[1];
		}
		return null;
	}

	const RENDERERS = 'ytd-video-renderer, ytd-rich-item-renderer, ytd-grid-video-renderer, ' +
		'ytd-compact-video-renderer, yt-lockup-view-model';

	const TITLE_SELECTORS = [
		'#video-title',
		'.ytLockupMetadataViewModelTitle',
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

		const cleaned = title
			.replace(/\s+\d+\s*(分|秒|時間)$/, '')
			.replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*$/, '')
			.trim();

		return cleaned || title;
	}

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

	function isChosenList(a, href) {
		const params = new URL(href).searchParams;
		const list = params.get('list');
		if (!list) return false;
		const autoMix = params.get('start_radio') === '1' && list === 'RD' + params.get('v');
		return !(autoMix && a.closest('ytd-video-renderer, ytd-compact-video-renderer'));
	}

	function onClick(e) {
		if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

		const t = e.target;
		if (!t || !t.closest) return;

		if (t.closest('#ytaq-popup, #ytaq-channel-modal, .ytaq-list-column')) return;

		const a = findAnchor(e, t);
		if (!a) return;

		const href = a.href;
		if (isChosenList(a, href)) {
			YTaq.log('home: skip (playlist)', href);
			return;
		}

		const videoId = getVideoId(href);
		if (!videoId) {
			YTaq.log('home: skip (no video id)', href);
			return;
		}

		if (clickAction === 'normal') return;
		if (clickAction === 'popup' && !window.YTaqPopup) return;

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		if (clickAction === 'newtab') {
			window.open(href, '_blank', 'noopener');
			return;
		}

		window.YTaqPopup.showVideoPopup(videoId, extractTitle(a), href.includes('/shorts/'));
	}

	YTaq.ready(() => {
		document.addEventListener('click', onClick, true);
		YTaq.log('home: click delegation ready');
	});
})();
