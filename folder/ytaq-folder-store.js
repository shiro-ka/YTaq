(function () {
	'use strict';

	const KEY = 'ytaq_folders';
	const HANDLES_KEY = 'ytaq_channel_handles';
	const OLD_KEY = 'ytaq_channel_lists';
	const ORIGIN = 'https://www.youtube.com';

	function read(keys) {
		return new Promise(ok => chrome.storage.local.get(keys, ok));
	}

	function write(values) {
		return new Promise(ok => chrome.storage.local.set(values, ok));
	}

	function empty() {
		return { folders: [], channels: {} };
	}

	function newId() {
		return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	}

	function innertubeConfig() {
		try {
			const page = window.wrappedJSObject;
			if (page && page.ytcfg && typeof page.ytcfg.get === 'function') {
				return {
					clientVersion: String(page.ytcfg.get('INNERTUBE_CLIENT_VERSION')),
					hl: String(page.ytcfg.get('HL') || 'ja'),
					gl: String(page.ytcfg.get('GL') || 'JP')
				};
			}
		} catch (e) {
			window.YTaq.warn('folder: ytcfg', e);
		}
		return null;
	}

	function waitConfig() {
		return new Promise(ok => {
			const until = Date.now() + 15000;
			(function poll() {
				const cfg = innertubeConfig();
				if (cfg && cfg.clientVersion && cfg.clientVersion !== 'undefined') return ok(cfg);
				if (Date.now() > until) return ok(null);
				setTimeout(poll, 200);
			})();
		});
	}

	async function resolveHandleOnline(path) {
		const cfg = await waitConfig();
		if (!cfg) return null;
		const res = await fetch(ORIGIN + '/youtubei/v1/navigation/resolve_url?prettyPrint=false', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				context: { client: { clientName: 'WEB', clientVersion: cfg.clientVersion, hl: cfg.hl } },
				url: ORIGIN + path
			})
		});
		if (!res.ok) return null;
		const json = await res.json();
		const id = json && json.endpoint && json.endpoint.browseEndpoint && json.endpoint.browseEndpoint.browseId;
		return id && id.startsWith('UC') ? id : null;
	}

	function channelPath(href) {
		if (!href) return null;
		const path = new URL(href, ORIGIN).pathname;
		const m = path.match(/^\/(channel\/UC[\w-]+|@[^/]+|c\/[^/]+|user\/[^/]+)/);
		return m ? '/' + m[1] : null;
	}

	const pending = new Map();

	async function resolveChannel(href) {
		const path = channelPath(href);
		if (!path) return null;
		if (path.startsWith('/channel/')) return path.slice('/channel/'.length);

		const key = decodeURIComponent(path).toLowerCase();
		const cached = (await read([HANDLES_KEY]))[HANDLES_KEY] || {};
		if (cached[key]) return cached[key];

		if (!pending.has(key)) {
			pending.set(key, resolveHandleOnline(path).then(async id => {
				pending.delete(key);
				if (id) {
					const latest = (await read([HANDLES_KEY]))[HANDLES_KEY] || {};
					latest[key] = id;
					await write({ [HANDLES_KEY]: latest });
				}
				return id;
			}, e => {
				pending.delete(key);
				window.YTaq.warn('folder: resolve', path, e);
				return null;
			}));
		}
		return pending.get(key);
	}

	async function migrate(old) {
		const data = empty();
		let lost = 0;
		for (const list of old) {
			const folder = { id: newId(), name: list.name, channels: [] };
			for (const entry of list.channels || []) {
				const raw = typeof entry === 'string' ? entry : entry.id;
				const name = typeof entry === 'string' ? null : entry.name;
				const id = raw.startsWith('UC') ? raw : await resolveChannel('/' + raw);
				if (!id) { lost++; continue; }
				if (!folder.channels.includes(id)) folder.channels.push(id);
				if (name) data.channels[id] = { name };
			}
			data.folders.push(folder);
		}
		return { data, lost };
	}

	let migrating = null;

	async function get() {
		const got = await read([KEY, OLD_KEY]);
		if (got[KEY]) return got[KEY];
		if (!got[OLD_KEY]) return empty();
		if (!migrating) {
			migrating = migrate(got[OLD_KEY]).then(async ({ data, lost }) => {
				await write({ [KEY]: data });
				if (lost) console.warn('[YTaq] folder migration: unresolved', lost, OLD_KEY);
				else await new Promise(ok => chrome.storage.local.remove(OLD_KEY, ok));
				return data;
			});
		}
		return migrating;
	}

	async function update(fn) {
		const data = await get();
		fn(data);
		await write({ [KEY]: data });
		return data;
	}

	function createFolder(name) {
		const id = newId();
		return update(d => { d.folders.push({ id, name, channels: [] }); }).then(() => id);
	}

	function toggle(folderId, channel) {
		return update(d => {
			const folder = d.folders.find(f => f.id === folderId);
			if (!folder) return;
			const i = folder.channels.indexOf(channel.id);
			if (i >= 0) folder.channels.splice(i, 1);
			else folder.channels.push(channel.id);
			if (channel.name) d.channels[channel.id] = { name: channel.name };
		});
	}

	function foldersOf(data, channelId) {
		return data.folders.filter(f => f.channels.includes(channelId));
	}

	function watch(cb) {
		get().then(cb);
		chrome.storage.onChanged.addListener((changes, area) => {
			if (area === 'local' && changes[KEY]) cb(changes[KEY].newValue || empty());
		});
	}

	waitConfig().then(cfg => {
		if (cfg) write({ ytaq_innertube: cfg });
	});

	window.YTaqFolders = { get, watch, createFolder, toggle, foldersOf, resolveChannel };
})();
