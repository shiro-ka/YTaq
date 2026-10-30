(function () {
	'use strict';

	if (globalThis.YTaqSettings) return;

	const TABLE = {
		theme: { key: 'ytaq_theme', value: { theme: 'trench', accent: 'blue' } },
		perf: {
			key: 'ytaq_perf',
			value: { hoverPreview: true, lazyOffscreen: false, ambient: true, animations: false, hideShorts: false }
		},
		click: { key: 'ytaq_click', value: 'popup' },
		embedReferer: { key: 'ytaq_embed_referer', value: 'https://example.com/' },
		embedLogin: { key: 'ytaq_embed_login', value: true },
		watchHistory: { key: 'ytaq_watch_history', value: true },
		antibite: { key: 'ytaq_antibite', value: { thumbnailEnabled: true, thumbnailFrame: 'hq1' } },
		playbackrate: {
			key: 'ytaq_playbackrate_settings',
			value: { speedStep: 0.25, speedPresets: [1.0, 1.25, 1.5, 1.75, 2.0, 4.0] }
		}
	};

	function entry(name) {
		const e = TABLE[name];
		if (!e) throw new Error('unknown setting: ' + name);
		return e;
	}

	function copy(v) {
		return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
	}

	function defaults(name) {
		return copy(entry(name).value);
	}

	function resolve(name, stored) {
		const d = defaults(name);
		if (stored === undefined || stored === null) return d;
		if (d && typeof d === 'object' && !Array.isArray(d)) return Object.assign(d, stored);
		return stored;
	}

	function get(name) {
		const key = entry(name).key;
		return new Promise(ok => chrome.storage.local.get([key], r => ok(resolve(name, r[key]))));
	}

	function set(name, value) {
		const key = entry(name).key;
		return new Promise(ok => chrome.storage.local.set({ [key]: value }, ok));
	}

	function reset(names) {
		const values = {};
		for (const n of names) values[entry(n).key] = defaults(n);
		return new Promise(ok => chrome.storage.local.set(values, ok));
	}

	function onChange(name, cb) {
		const key = entry(name).key;
		chrome.storage.onChanged.addListener((changes, area) => {
			if (area === 'local' && changes[key]) cb(resolve(name, changes[key].newValue));
		});
	}

	function watch(name, cb) {
		get(name).then(cb);
		onChange(name, cb);
	}

	globalThis.YTaqSettings = Object.freeze({ defaults, resolve, get, set, reset, onChange, watch });
})();
