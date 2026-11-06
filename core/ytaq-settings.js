(function () {
	'use strict';

	const TABLE = {
		theme: { key: 'ytaq_theme', value: { theme: 'trench', accent: 'blue', primaryHue: 270, accentHue: 255 } },
		customCss: { key: 'ytaq_custom_css', value: '' },
		perf: {
			key: 'ytaq_perf',
			value: { hoverPreview: true, lazyOffscreen: false, ambient: true, animations: false, hideShorts: false }
		},
		click: { key: 'ytaq_click', value: 'popup' },
		embedReferer: { key: 'ytaq_embed_referer', value: 'https://example.com/' },
		embedLogin: { key: 'ytaq_embed_login', value: true },
		watchHistory: { key: 'ytaq_watch_history', value: true },
		popupResume: { key: 'ytaq_popup_resume', value: true },
		antibite: { key: 'ytaq_antibite', value: { thumbnailEnabled: true, thumbnailFrame: 'hq1', shortsVertical: false } },
		popupInfo: {
			key: 'ytaq_popup_info',
			value: { avatar: true, description: true, shortsDescInline: false, date: true, like: true, save: true, subscribe: true, folder: true, views: false, likeCount: false, dislike: false, commentReplies: false, commentWrite: false }
		},
		searchGrid: { key: 'ytaq_search_grid', value: true },
		watchWide: { key: 'ytaq_watch_wide', value: true },
		watchFitInfo: { key: 'ytaq_watch_fit_info', value: true },
		watchSide: { key: 'ytaq_watch_side', value: true },
		watchRelated: { key: 'ytaq_watch_related', value: false },
		watchDescBelow: { key: 'ytaq_watch_desc_below', value: true },
		watchCloseReplay: { key: 'ytaq_watch_close_replay', value: true },
		feedShorts: { key: 'ytaq_feed_shorts', value: false },
		mute: { key: 'ytaq_mute', value: { words: [], channels: [], commentWords: false } },
		hideWatched: {
			key: 'ytaq_hide_watched',
			value: { percent: 90, places: { home: true, search: false, related: false, feed: false, subs: false, channel: false, explore: false } }
		},
		titleClean: {
			key: 'ytaq_title_clean',
			value: {
				places: { list: true, feed: true, popup: true, watch: false },
				rules: [
					{ pattern: '【(?![^】]*[#＃])[^】]*】', replace: '', on: true },
					{ pattern: '\\[(?![^\\]]*[#＃])[^\\]]*\\]', replace: '', on: true },
					{ pattern: '［(?![^］]*[#＃])[^］]*］', replace: '', on: true }
				]
			}
		},
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
