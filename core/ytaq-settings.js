(function () {
	'use strict';

	const TABLE = {
		theme: { key: 'ytaq_theme', value: { theme: 'trench', accent: 'blue', primaryHue: 270, accentHue: 255 } },
		customCss: { key: 'ytaq_custom_css', value: '' },
		musicNormalRate: { key: 'ytaq_music_normal_rate', value: true },
		perf: {
			key: 'ytaq_perf',
			value: { hoverPreview: true, lazyOffscreen: false, ambient: true, animations: false, avoid60fps: false, preferH264: false }
		},
		shortsHide: { key: 'ytaq_shorts_hide', value: { home: true, search: false, subs: false, channel: false, related: false, guide: false } },
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
		cardHeader: { key: 'ytaq_card_header', value: true },
		hideCardBadges: { key: 'ytaq_hide_card_badges', value: true },
		compactCards: { key: 'ytaq_compact_cards', value: { home: false, subs: false, channel: false, search: false } },
		watchWide: { key: 'ytaq_watch_wide', value: true },
		watchFitInfo: { key: 'ytaq_watch_fit_info', value: true },
		watchSide: { key: 'ytaq_watch_side', value: true },
		watchRelated: { key: 'ytaq_watch_related', value: false },
		watchDescBelow: { key: 'ytaq_watch_desc_below', value: true },
		watchCloseReplay: { key: 'ytaq_watch_close_replay', value: true },
		feedShorts: { key: 'ytaq_feed_shorts', value: false },
		mute: { key: 'ytaq_mute', value: { words: [], channels: [], commentWords: false } },
		membersOnly: { key: 'ytaq_members_only', value: { hide: true, extra: [] } },
		homeHide: { key: 'ytaq_home_hide', value: { shelves: true, playlists: false } },
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

	function plain(v) {
		return !!v && typeof v === 'object' && !Array.isArray(v);
	}

	function merge(base, stored) {
		for (const k of Object.keys(stored)) base[k] = plain(base[k]) && plain(stored[k]) ? merge(base[k], stored[k]) : stored[k];
		return base;
	}

	function resolve(name, stored) {
		const d = defaults(name);
		if (stored === undefined || stored === null) return d;
		return plain(d) && plain(stored) ? merge(d, stored) : stored;
	}

	function get(name) {
		const key = entry(name).key;
		return new Promise(ok => chrome.storage.local.get([key], r => ok(resolve(name, r[key]))));
	}

	function set(name, value) {
		const key = entry(name).key;
		return new Promise(ok => chrome.storage.local.set({ [key]: value }, ok));
	}

	async function reset(paths) {
		for (const path of paths) {
			const [name, key] = path.split('.');
			if (!key) {
				await set(name, defaults(name));
				continue;
			}
			const value = await get(name);
			value[key] = defaults(name)[key];
			await set(name, value);
		}
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

	const NOT_EXPORTED = new Set(['ytaq_feed', 'ytaq_short_owners', 'ytaq_subs', 'ytaq_channel_handles', 'ytaq_innertube', 'ytaq_channel_lists', 'ytaq_playbackrate', 'ytaq_memberships', 'ytaq_sync_on', 'ytaq_sync_meta', 'ytaq_sync_status']);
	const NOT_SYNCED = new Set(['ytaq_custom_css']);

	function exported(key) {
		return key.startsWith('ytaq_') && !NOT_EXPORTED.has(key);
	}

	function synced(key) {
		return exported(key) && !NOT_SYNCED.has(key);
	}

	globalThis.YTaqSettings = Object.freeze({ defaults, resolve, get, set, reset, onChange, watch, exported, synced });
})();
