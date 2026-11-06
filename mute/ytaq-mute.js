(function () {
	'use strict';

	const YTaq = window.YTaq;

	const ATTR = 'data-ytaq-muted';
	const VIDEOS = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ' +
		'ytd-reel-item-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, .ytaq-feed-item';
	const OUTER = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-reel-item-renderer';
	const COMMENTS = 'ytd-comment-view-model, ytd-comment-renderer';
	const TITLES = '#video-title, .ytLockupMetadataViewModelTitle, .ytaq-feed-title, h3';
	const CHANNEL_LINKS = 'a[href^="/@"], a[href^="/channel/UC"]';
	const CHANNEL_PAGE = /^\/(@[^/]+|channel\/UC[^/]+|c\/[^/]+|user\/[^/]+)(\/|$)/;

	let rules = { words: [], ids: new Set(), handles: new Set(), commentWords: false, any: false };
	const seen = new WeakMap();
	let handleIds = {};
	let version = 0;

	function normalize(s) {
		return String(s || '').normalize('NFKC').toLowerCase();
	}

	function compileWord(w) {
		const m = /^\/(.+)\/([a-z]*)$/.exec(w);
		if (m) {
			try {
				const re = new RegExp(m[1], m[2].includes('i') ? m[2] : m[2] + 'i');
				return text => re.test(text);
			} catch {
				return null;
			}
		}
		const needle = normalize(w);
		return needle ? text => normalize(text).includes(needle) : null;
	}

	function handleOf(href) {
		const m = /^\/(@[^/?#]+)/.exec(href || '');
		if (!m) return null;
		try {
			return decodeURIComponent(m[1]).toLowerCase();
		} catch {
			return m[1].toLowerCase();
		}
	}

	function idOf(href) {
		const m = /^\/channel\/(UC[\w-]{22})/.exec(href || '');
		return m ? m[1] : null;
	}

	function configure(v) {
		const words = (v.words || []).map(w => String(w).trim()).filter(Boolean).map(compileWord).filter(Boolean);
		const ids = new Set();
		const handles = new Set();
		for (const c of v.channels || []) {
			if (c.id) ids.add(c.id);
			if (c.handle) handles.add(c.handle.toLowerCase());
		}
		rules = { words, ids, handles, commentWords: !!v.commentWords, any: words.length > 0 || ids.size > 0 || handles.size > 0 };
		version++;
		scanAll();
	}

	function channelMuted(links, id) {
		if (id && rules.ids.has(id)) return true;
		for (const a of links) {
			const href = a.getAttribute('href');
			const h = handleOf(href);
			if (h && (rules.handles.has(h) || rules.ids.has(handleIds['/' + h]))) return true;
			const i = idOf(href);
			if (i && rules.ids.has(i)) return true;
		}
		return false;
	}

	function wordMuted(text) {
		if (!text) return false;
		for (const test of rules.words) if (test(text)) return true;
		return false;
	}

	function titleOf(el) {
		const t = el.querySelector(TITLES);
		if (!t) return '';
		const original = window.YTaqTitle ? window.YTaqTitle.originalOf(t) : t.textContent;
		return t.getAttribute('title') || original.trim();
	}

	function videoMuted(el) {
		const id = el.dataset && el.dataset.channel;
		if (channelMuted(el.querySelectorAll(CHANNEL_LINKS), id)) return true;
		return wordMuted(titleOf(el));
	}

	function commentMuted(el) {
		const author = el.querySelector('#author-text');
		if (author && channelMuted([author])) return true;
		if (!rules.commentWords) return false;
		const content = el.querySelector('#content-text');
		return wordMuted(content && content.textContent);
	}

	function mark(el, on) {
		if (on) el.setAttribute(ATTR, '');
		else el.removeAttribute(ATTR);
	}

	function check(el, test, target) {
		const key = version + '|' + el.textContent.length + '|' + (el.querySelector('a[href]') || {}).href;
		if (seen.get(el) === key) return;
		seen.set(el, key);
		mark(target || el, rules.any && test(el));
	}

	function scanAll() {
		const onChannelPage = CHANNEL_PAGE.test(location.pathname);
		for (const el of document.querySelectorAll(VIDEOS)) {
			if (el.matches('yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2') && el.parentElement && el.parentElement.closest(OUTER)) continue;
			if (onChannelPage && !el.classList.contains('ytaq-feed-item')) {
				mark(el, false);
				seen.delete(el);
				continue;
			}
			check(el, videoMuted);
		}
		for (const el of document.querySelectorAll(COMMENTS)) {
			const thread = el.closest('ytd-comment-thread-renderer');
			const top = thread && !el.closest('#replies') ? thread : null;
			check(el, commentMuted, top || el);
		}
	}

	let scheduled = false;
	function schedule() {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			if (rules.any) scanAll();
		});
	}

	YTaqSettings.watch('mute', configure);
	YTaq.getStorage('ytaq_channel_handles', {}).then(v => {
		handleIds = v || {};
		version++;
		schedule();
	});
	YTaq.onStorageChange('ytaq_channel_handles', v => {
		handleIds = v || {};
		version++;
		schedule();
	});

	YTaq.ready(() => {
		YTaq.onMutation(schedule);
		YTaq.onNavigate(() => {
			version++;
			schedule();
		});
	});
})();
