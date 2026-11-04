(function () {
	'use strict';

	const FEED_KEY = 'ytaq_feed';
	const FOLDERS_KEY = 'ytaq_folders';
	const CLIENT_KEY = 'ytaq_innertube';
	const ORIGIN = 'https://www.youtube.com';

	const RSS_SIZE = 15;
	const KEEP_PER_CHANNEL = 200;
	const DETAILS_PER_RUN = 60;
	const SHORTS_MAX_SECONDS = 180;
	const INTERVAL_MS = 30 * 60 * 1000;
	const MIN_GAP_MS = 2 * 60 * 1000;
	const RSS_DOWN_GAP_MS = 2 * 60 * 60 * 1000;
	const VIDEOS_TAB = 'EgZ2aWRlb3PyBgQKAjoA';
	const STREAMS_TAB = 'EgdzdHJlYW1z8gYECgJ6AA==';
	const SHORTS_TAB = 'EgZzaG9ydHPyBgUKA5oBAA==';
	const BASE_TABS = [VIDEOS_TAB, STREAMS_TAB];

	let withShorts = YTaqSettings.defaults('feedShorts');
	let backfillAll = false;
	YTaqSettings.onChange('feedShorts', v => {
		withShorts = !!v;
		if (withShorts) {
			backfillAll = true;
			refresh();
		}
	});
	YTaqSettings.get('feedShorts').then(v => { withShorts = !!v; });

	function tabs() {
		return withShorts ? BASE_TABS.concat(SHORTS_TAB) : BASE_TABS;
	}

	function read(keys) {
		return new Promise(ok => chrome.storage.local.get(keys, ok));
	}

	function write(values) {
		return new Promise(ok => chrome.storage.local.set(values, ok));
	}

	function emptyFeed() {
		return { channels: {}, videos: {} };
	}

	async function fetchRss(channelId) {
		const res = await fetch(ORIGIN + '/feeds/videos.xml?channel_id=' + encodeURIComponent(channelId), { credentials: 'omit' });
		if (!res.ok) throw new Error('rss ' + res.status);
		const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
		return [...doc.getElementsByTagName('entry')].map(e => ({
			id: e.getElementsByTagName('yt:videoId')[0].textContent,
			title: e.getElementsByTagName('title')[0].textContent,
			published: Date.parse(e.getElementsByTagName('published')[0].textContent)
		}));
	}

	async function innertube(path, body) {
		const cfg = (await read([CLIENT_KEY]))[CLIENT_KEY];
		if (!cfg || !cfg.clientVersion) throw new Error('no client version');
		const res = await fetch(ORIGIN + '/youtubei/v1/' + path + '?prettyPrint=false', {
			method: 'POST',
			credentials: 'omit',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(Object.assign({
				context: { client: { clientName: 'WEB', clientVersion: cfg.clientVersion, hl: cfg.hl || 'ja', gl: cfg.gl || 'JP' } }
			}, body))
		});
		if (!res.ok) throw new Error(path + ' ' + res.status);
		return res.json();
	}

	function collectLockups(node, out) {
		if (Array.isArray(node)) {
			for (const n of node) collectLockups(n, out);
		} else if (node && typeof node === 'object') {
			const l = node.lockupViewModel;
			if (l && l.contentId && l.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
				const meta = l.metadata && l.metadata.lockupMetadataViewModel;
				out.push({ id: l.contentId, title: meta && meta.title ? meta.title.content : '' });
				return;
			}
			const s = node.shortsLockupViewModel;
			const reel = s && s.onTap && s.onTap.innertubeCommand && s.onTap.innertubeCommand.reelWatchEndpoint;
			if (reel && reel.videoId) {
				const text = s.overlayMetadata && s.overlayMetadata.primaryText;
				out.push({ id: reel.videoId, title: text ? text.content : '' });
				return;
			}
			for (const k in node) collectLockups(node[k], out);
		}
		return out;
	}

	async function readTabs(channelId, tabs) {
		const found = [];
		for (const params of tabs) {
			try {
				collectLockups(await innertube('browse', { browseId: channelId, params }), found);
			} catch (e) {
				console.warn('[YTaq feed] tab', channelId, e.message);
			}
		}
		return found;
	}

	async function isShort(id) {
		const res = await fetch(ORIGIN + '/shorts/' + id, { method: 'HEAD', redirect: 'manual', credentials: 'omit' });
		return res.status === 200;
	}

	async function details(id) {
		const json = await innertube('player', { videoId: id, contentCheckOk: true, racyCheckOk: true });
		const vd = json.videoDetails || {};
		const mf = (json.microformat && json.microformat.playerMicroformatRenderer) || {};
		const seconds = Number(vd.lengthSeconds || 0);
		const live = !!vd.isLiveContent;
		const upcoming = !!vd.isUpcoming;
		const short = !live && seconds > 0 && seconds <= SHORTS_MAX_SECONDS ? await isShort(id) : false;
		const start = mf.liveBroadcastDetails && mf.liveBroadcastDetails.startTimestamp;
		return {
			seconds,
			live,
			upcoming,
			liveNow: !!(mf.liveBroadcastDetails && mf.liveBroadcastDetails.isLiveNow),
			short,
			category: mf.category || null,
			published: Date.parse(start || mf.publishDate || '') || null
		};
	}

	function prune(feed, channelId) {
		const ids = Object.keys(feed.videos)
			.filter(id => feed.videos[id].channel === channelId)
			.sort((a, b) => (feed.videos[b].published || 0) - (feed.videos[a].published || 0));
		for (const id of ids.slice(KEEP_PER_CHANNEL)) delete feed.videos[id];
	}

	function addUndated(feed, channelId, found) {
		for (const e of found) {
			if (!feed.videos[e.id]) feed.videos[e.id] = { channel: channelId, title: e.title, published: null, detail: null };
		}
	}

	async function refreshChannel(feed, channelId) {
		const prev = feed.channels[channelId];
		let entries;
		try {
			entries = await fetchRss(channelId);
		} catch (e) {
			console.warn('[YTaq feed] rss', channelId, e.message);
			rssFailed = true;
			addUndated(feed, channelId, await readTabs(channelId, tabs()));
			feed.channels[channelId] = { fetchedAt: Date.now(), newest: prev && prev.newest || 0 };
			return;
		}
		const oldest = entries.length ? Math.min(...entries.map(e => e.published)) : 0;
		const gap = backfillAll || !prev || (prev.newest && entries.length >= RSS_SIZE && oldest > prev.newest);

		for (const e of entries) {
			const v = feed.videos[e.id];
			if (v) {
				v.title = e.title;
			} else {
				feed.videos[e.id] = { channel: channelId, title: e.title, published: e.published, detail: null };
			}
		}

		if (gap) addUndated(feed, channelId, await readTabs(channelId, tabs()));

		const newest = Math.max(prev && prev.newest || 0, ...entries.map(e => e.published));
		feed.channels[channelId] = { fetchedAt: Date.now(), newest };
	}

	async function fillDetails(feed) {
		const todo = Object.keys(feed.videos).filter(id => !feed.videos[id].detail).slice(0, DETAILS_PER_RUN);
		for (const id of todo) {
			try {
				const d = await details(id);
				const v = feed.videos[id];
				v.detail = d;
				if (!v.published && d.published) v.published = d.published;
			} catch (e) {
				console.warn('[YTaq feed] details', id, e.message);
				return false;
			}
		}
		return todo.length === DETAILS_PER_RUN;
	}

	let running = null;
	let again = false;
	let lastFull = 0;
	let rssFailed = false;
	let rssDown = false;

	function minGap() {
		return rssDown ? RSS_DOWN_GAP_MS : MIN_GAP_MS;
	}

	async function run(only) {
		rssFailed = false;
		const got = await read([FEED_KEY, FOLDERS_KEY]);
		const feed = got[FEED_KEY] || emptyFeed();
		const folders = (got[FOLDERS_KEY] && got[FOLDERS_KEY].folders) || [];
		const wanted = [...new Set(folders.flatMap(f => f.channels))];

		for (const id of Object.keys(feed.channels)) {
			if (!wanted.includes(id)) delete feed.channels[id];
		}
		for (const id of Object.keys(feed.videos)) {
			if (!wanted.includes(feed.videos[id].channel)) delete feed.videos[id];
		}

		const targets = only ? wanted.filter(id => only.includes(id)) : wanted;
		for (const id of targets) {
			try {
				await refreshChannel(feed, id);
				prune(feed, id);
			} catch (e) {
				console.warn('[YTaq feed] channel', id, e.message);
			}
		}
		if (targets.length) rssDown = rssFailed;
		if (!only) backfillAll = false;

		await write({ [FEED_KEY]: feed });

		let more = true;
		while (more) {
			more = await fillDetails(feed);
			await write({ [FEED_KEY]: feed });
		}
	}

	function refresh(only) {
		if (running) {
			again = true;
			return running;
		}
		if (!only) lastFull = Date.now();
		running = run(only).finally(() => {
			running = null;
			if (again) {
				again = false;
				refresh();
			}
		});
		return running;
	}

	const SELF = browser.runtime.getURL('');

	browser.webRequest.onBeforeSendHeaders.addListener(
		details => {
			if (!(details.originUrl || '').startsWith(SELF)) return;
			const headers = details.requestHeaders.filter(h => h.name.toLowerCase() !== 'origin');
			headers.push({ name: 'Origin', value: ORIGIN });
			return { requestHeaders: headers };
		},
		{ urls: [ORIGIN + '/youtubei/v1/*'] },
		['blocking', 'requestHeaders']
	);

	chrome.runtime.onMessage.addListener((msg, sender, reply) => {
		if (!msg || msg.type !== 'ytaq-feed-refresh') return;
		if (Date.now() - lastFull < minGap()) return reply(true);
		refresh().then(() => reply(true), () => reply(false));
		return true;
	});

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area === 'local' && changes[CLIENT_KEY] && !changes[CLIENT_KEY].oldValue) refresh();
	});

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== 'local' || !changes[FOLDERS_KEY]) return;
		const before = new Set(((changes[FOLDERS_KEY].oldValue || {}).folders || []).flatMap(f => f.channels));
		const added = ((changes[FOLDERS_KEY].newValue || {}).folders || []).flatMap(f => f.channels).filter(id => !before.has(id));
		if (added.length) refresh(added);
	});

	setInterval(() => {
		if (Date.now() - lastFull >= minGap()) refresh();
	}, INTERVAL_MS);
	refresh();
})();
