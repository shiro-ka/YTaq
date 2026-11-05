(function () {
	'use strict';

	const YTaq = window.YTaq;
	const INTERVAL_MS = 24 * 60 * 60 * 1000;
	const MAX_PAGES = 50;
	const AVATAR_WIDTH = 48;

	function collect(node, test, out) {
		if (Array.isArray(node)) {
			for (const n of node) collect(n, test, out);
		} else if (node && typeof node === 'object') {
			if (test(node)) out.push(node);
			for (const k in node) collect(node[k], test, out);
		}
		return out;
	}

	function avatarOf(renderer) {
		const list = (renderer.thumbnail && renderer.thumbnail.thumbnails) || [];
		const url = (list.find(t => t.width >= AVATAR_WIDTH) || list[list.length - 1] || {}).url || '';
		return url.startsWith('//') ? 'https:' + url : url;
	}

	async function fetchSubs() {
		const channels = [];
		let body = { browseId: 'FEchannels' };
		for (let i = 0; i < MAX_PAGES && body; i++) {
			const json = await window.YTaqInnertube.call('browse', body);
			for (const { channelRenderer: r } of collect(json, o => o.channelRenderer, [])) {
				channels.push({ id: r.channelId, name: ((r.title && r.title.simpleText) || '').trim(), avatar: avatarOf(r) });
			}
			const next = collect(json, o => o.continuationCommand && o.continuationCommand.token, [])[0];
			body = next ? { continuation: next.continuationCommand.token } : null;
		}
		return channels;
	}

	YTaq.ready(async () => {
		const subs = await window.YTaqChannels.getSubs();
		if (Date.now() - subs.fetchedAt < INTERVAL_MS) return;
		try {
			const channels = await fetchSubs();
			if (channels.length) await window.YTaqChannels.setSubs(channels);
		} catch (e) {
			YTaq.warn('subs: fetch', e.message);
		}
	});
})();
