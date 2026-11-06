(function () {
	'use strict';

	const YTaq = window.YTaq;

	const ATTR = 'data-ytaq-muted';
	const PENDING_ATTR = 'data-ytaq-mute-pending';
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
		current = v;
		dirty = true;
		const words = (v.words || []).map(w => String(w).trim()).filter(Boolean).map(compileWord).filter(Boolean);
		const ids = new Set();
		const handles = new Set();
		for (const c of v.channels || []) {
			if (c.id) ids.add(c.id);
			if (c.handle) handles.add(c.handle.toLowerCase());
		}
		rules = { words, ids, handles, commentWords: !!v.commentWords, any: words.length > 0 || ids.size > 0 || handles.size > 0 };
		version++;
		schedule();
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

	function linklessOwner(el) {
		const links = el.querySelectorAll(CHANNEL_LINKS);
		if (links.length || (el.dataset && el.dataset.channel)) return undefined;
		const a = el.querySelector('a[href^="/shorts/"], a[href^="/watch?v="]');
		const m = a && /^\/(?:shorts\/|watch\?v=)([\w-]{11})/.exec(a.getAttribute('href'));
		if (!m) return undefined;
		if (owners.has(m[1])) return owners.get(m[1]);
		lookup(m[1]);
		return null;
	}

	function videoMuted(el) {
		if (wordMuted(titleOf(el))) return true;
		const id = el.dataset && el.dataset.channel;
		if (rules.ids.size || rules.handles.size) {
			const owner = linklessOwner(el);
			if (owner === null) return PENDING;
			if (owner) return rules.handles.has(owner) || rules.ids.has(handleIds['/' + owner]);
		}
		return channelMuted(el.querySelectorAll(CHANNEL_LINKS), id);
	}

	const PENDING = 'pending';
	const OWNERS_KEY = 'ytaq_short_owners';
	const OWNERS_MAX = 3000;
	const LOOKUPS_AT_ONCE = 4;
	const owners = new Map();
	const queue = [];
	const asked = new Set();
	let running = 0;
	let saveTimer = 0;

	function lookup(videoId) {
		if (asked.has(videoId)) return;
		asked.add(videoId);
		queue.push(videoId);
		pump();
	}

	function pump() {
		while (running < LOOKUPS_AT_ONCE && queue.length) {
			const videoId = queue.shift();
			running++;
			fetchOwner(videoId).then(handle => {
				owners.set(videoId, handle);
				saveOwners();
			}).finally(() => {
				running--;
				version++;
				schedule();
				pump();
			});
		}
	}

	async function fetchOwner(videoId) {
		try {
			const url = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + videoId);
			const res = await fetch(url, { credentials: 'omit' });
			if (!res.ok) return '';
			const json = await res.json();
			return handleOf(new URL(json.author_url).pathname) || '';
		} catch {
			return '';
		}
	}

	function saveOwners() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			while (owners.size > OWNERS_MAX) owners.delete(owners.keys().next().value);
			chrome.storage.local.set({ [OWNERS_KEY]: Object.fromEntries(owners) });
		}, 2000);
	}

	function commentMuted(el) {
		const author = el.querySelector('#author-text');
		if (author && channelMuted([author])) return true;
		if (!rules.commentWords) return false;
		const content = el.querySelector('#content-text');
		return wordMuted(content && content.textContent);
	}

	function mark(el, state) {
		el.toggleAttribute(ATTR, state === true);
		el.toggleAttribute(PENDING_ATTR, state === PENDING);
	}

	function check(el, test, target) {
		const key = version + '|' + el.textContent.length + '|' + (el.querySelector('a[href]') || {}).href;
		if (seen.get(el) === key) return;
		seen.set(el, key);
		mark(target || el, rules.any ? test(el) : false);
	}

	const WATCHED_ATTR = 'data-ytaq-watched';
	const WATCHED_BAR = '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment, ytd-thumbnail-overlay-resume-playback-renderer #progress';
	let hide = { percent: 90, places: {} };
	let hideOn = false;

	function placeOf(el) {
		if (el.classList.contains('ytaq-feed-item')) return 'feed';
		const path = location.pathname;
		if (path === '/') return 'home';
		if (path === '/results') return 'search';
		if (path === '/watch') return el.closest('#related, ytd-watch-next-secondary-results-renderer') ? 'related' : null;
		if (path === '/feed/subscriptions') return 'subs';
		if (CHANNEL_PAGE.test(path)) return 'channel';
		if (path.startsWith('/hashtag/') || path.startsWith('/feed/explore') || path.startsWith('/feed/trending') || path === '/gaming') return 'explore';
		return null;
	}

	function percentOf(el) {
		if (el.dataset && el.dataset.watched) return Number(el.dataset.watched);
		const bar = el.querySelector(WATCHED_BAR);
		return bar ? parseFloat(bar.style.width) || 0 : 0;
	}

	function watchedPass(items) {
		for (const el of items) {
			const place = placeOf(el);
			const on = hideOn && !!place && !!hide.places[place] && percentOf(el) >= hide.percent;
			el.toggleAttribute(WATCHED_ATTR, on);
		}
	}

	function scanAll() {
		const onChannelPage = CHANNEL_PAGE.test(location.pathname);
		const items = [];
		for (const el of document.querySelectorAll(VIDEOS)) {
			if (el.matches('yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2') && el.parentElement && el.parentElement.closest(OUTER)) continue;
			items.push(el);
		}
		watchedPass(items);
		const muting = rules.any || dirty;
		if (muting) for (const el of items) {
			if (onChannelPage && !el.classList.contains('ytaq-feed-item')) {
				mark(el, false);
				seen.delete(el);
				continue;
			}
			check(el, videoMuted);
		}
		for (const el of document.querySelectorAll(COMMENTS)) {
			commentButton(el);
			if (!muting) continue;
			const thread = el.closest('ytd-comment-thread-renderer');
			const top = thread && !el.closest('#replies') ? thread : null;
			check(el, commentMuted, top || el);
		}
	}

	let current = { words: [], channels: [], commentWords: false };

	function sameChannel(a, b) {
		return (a.id && b.id && a.id === b.id) || (a.handle && b.handle && a.handle.toLowerCase() === b.handle.toLowerCase());
	}

	function isChannelMuted(c) {
		return current.channels.some(x => sameChannel(x, c));
	}

	async function fill(c) {
		const out = { id: c.id || null, handle: c.handle || null, name: c.name || '' };
		if (!out.id && out.handle) out.id = handleIds['/' + out.handle.toLowerCase()] || null;
		if (!out.id && out.handle && window.YTaqFolders) out.id = await window.YTaqFolders.resolveChannel('/' + out.handle).catch(() => null);
		if (out.id && !out.handle) {
			const h = Object.keys(handleIds).find(k => handleIds[k] === out.id);
			if (h) out.handle = h.slice(1);
		}
		if (out.id && !out.handle && window.YTaqInnertube) {
			try {
				const json = await window.YTaqInnertube.call('browse', { browseId: out.id });
				const meta = json.metadata && json.metadata.channelMetadataRenderer;
				if (meta) {
					out.handle = handleOf(new URL(meta.vanityChannelUrl || meta.channelUrl || '', location.origin).pathname);
					out.name = out.name || meta.title || '';
				}
			} catch (e) {
				YTaq.warn('mute: browse', e.message);
			}
		}
		return out;
	}

	async function ownerOfVideo(videoId) {
		const json = await window.YTaqInnertube.call('player', { videoId });
		const d = json.videoDetails || {};
		const mf = (json.microformat && json.microformat.playerMicroformatRenderer) || {};
		return { id: d.channelId || null, handle: handleOf(new URL(mf.ownerProfileUrl || '/', location.origin).pathname), name: d.author || '' };
	}

	async function addChannel(c) {
		const entry = await fill(c);
		if (!entry.id && !entry.handle) return;
		const v = await YTaqSettings.get('mute');
		if (v.channels.some(x => sameChannel(x, entry))) return;
		v.channels.push(entry);
		await YTaqSettings.set('mute', v);
	}

	async function removeChannel(c) {
		const v = await YTaqSettings.get('mute');
		v.channels = v.channels.filter(x => !sameChannel(x, c));
		await YTaqSettings.set('mute', v);
	}

	function toggleChannel(c) {
		return isChannelMuted(c) ? removeChannel(c) : addChannel(c);
	}

	window.YTaqMute = { isChannelMuted, addChannel, removeChannel, toggleChannel, ownerOfVideo };

	const MENU_ROW = 'ytaq-mute-row';
	const MENU_MARGIN = 8;
	let menuItem = null;

	function videoIdOf(item) {
		const a = item.querySelector('a[href*="/watch?v="], a[href^="/shorts/"]');
		const m = a && /(?:v=|\/shorts\/)([\w-]{11})/.exec(a.getAttribute('href'));
		return m ? m[1] : null;
	}

	function menuRow(videoId, item) {
		const row = document.createElement('div');
		row.className = MENU_ROW;
		row.setAttribute('role', 'menuitem');
		row.tabIndex = 0;
		row.dataset.video = videoId;
		row.append(YTaqIcons.create('visibility_off'), document.createTextNode('チャンネルをミュート'));
		row.addEventListener('click', async e => {
			e.stopPropagation();
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
			const id = item.dataset && item.dataset.channel;
			try {
				const owner = id ? { id } : await ownerOfVideo(videoId);
				await addChannel(owner);
			} catch (err) {
				YTaq.warn('mute: menu', err.message);
			}
		});
		return row;
	}

	function injectMenu(tries) {
		if (!menuItem) return;
		const sheet = [...document.querySelectorAll('yt-sheet-view-model, ytd-menu-popup-renderer')].find(m => m.getBoundingClientRect().height > 0);
		const list = sheet && (sheet.querySelector('yt-list-view-model') || sheet.querySelector('#items') || sheet);
		if (!list) {
			if (tries > 0) setTimeout(() => injectMenu(tries - 1), 50);
			return;
		}
		const videoId = videoIdOf(menuItem);
		for (const old of document.querySelectorAll('.' + MENU_ROW)) old.remove();
		if (!videoId) return;
		list.append(menuRow(videoId, menuItem));
		requestAnimationFrame(() => keepOnScreen(sheet.closest('tp-yt-iron-dropdown') || sheet));
	}

	function keepOnScreen(box) {
		const r = box.getBoundingClientRect();
		const over = r.bottom - (window.innerHeight - MENU_MARGIN);
		if (over <= 0) return;
		box.style.top = Math.max(MENU_MARGIN, r.top - over) + 'px';
	}

	document.addEventListener('click', e => {
		const button = e.target.closest && e.target.closest('button');
		if (!button) return;
		const item = button.closest(VIDEOS);
		if (!item || button.closest('a[href]')) return;
		menuItem = item;
		setTimeout(() => injectMenu(10), 50);
	}, true);

	function commentButton(comment) {
		const header = comment.querySelector('#header-author');
		if (!header || header.querySelector('.ytaq-mute-comment')) return;
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'ytaq-mute-comment';
		b.title = 'このチャンネルをミュート';
		b.setAttribute('aria-label', 'このチャンネルをミュート');
		b.append(YTaqIcons.create('visibility_off'));
		b.addEventListener('click', e => {
			e.preventDefault();
			e.stopPropagation();
			const author = comment.querySelector('#author-text');
			const handle = author && handleOf(author.getAttribute('href'));
			const id = author && idOf(author.getAttribute('href'));
			if (handle || id) addChannel({ handle, id, name: author.textContent.trim() });
		});
		header.append(b);
	}

	const NOTICE = 'ytaq-mute-notice';

	function channelNotice() {
		const old = document.querySelector('.' + NOTICE);
		const m = CHANNEL_PAGE.exec(location.pathname);
		const host = m && document.querySelector('yt-flexible-actions-view-model');
		const c = m ? { handle: handleOf('/' + m[1]), id: idOf('/' + m[1]) } : null;
		if (!host || !isChannelMuted(c)) {
			if (old) old.remove();
			return;
		}
		if (old && old.parentElement === host) return;
		if (old) old.remove();
		const b = document.createElement('button');
		b.type = 'button';
		b.className = NOTICE;
		b.title = 'ミュートを解除';
		b.append(YTaqIcons.create('visibility_off'), document.createTextNode('ミュート中'));
		b.addEventListener('click', () => removeChannel(c));
		host.append(b);
	}

	let scheduled = false;
	let dirty = false;
	let hideDirty = false;
	function schedule() {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			if (rules.any || dirty || hideOn || hideDirty) scanAll();
			else for (const el of document.querySelectorAll(COMMENTS)) commentButton(el);
			hideDirty = false;
			dirty = rules.any;
			channelNotice();
		});
	}

	YTaqSettings.watch('mute', configure);
	YTaqSettings.watch('hideWatched', v => {
		hide = { percent: Number(v.percent) || 0, places: v.places || {} };
		hideOn = Object.values(hide.places).some(Boolean);
		hideDirty = true;
		schedule();
	});
	YTaq.getStorage(OWNERS_KEY, {}).then(v => {
		for (const [k, h] of Object.entries(v || {})) if (!owners.has(k)) owners.set(k, h);
		version++;
		schedule();
	});

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
