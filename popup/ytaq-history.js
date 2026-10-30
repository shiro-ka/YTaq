(function () {
	'use strict';

	const YTaq = window.YTaq;

	const note = YTaq.log;
	const noteWarn = console.warn.bind(console, '[YTaq history]');

	let enabled = false;
	YTaqSettings.watch('watchHistory', v => { enabled = !!v; });

	const MIN_SECONDS = 5;

	const PING_INTERVAL_MS = 30000;

	const CPN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

	function newCpn() {
		const buf = new Uint8Array(16);
		crypto.getRandomValues(buf);
		let out = '';
		for (let i = 0; i < buf.length; i++) out += CPN_CHARS[buf[i] & 63];
		return out;
	}

	function unescapeUrl(s) {
		return s.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
	}

	function pickBaseUrl(html, name) {
		const m = html.match(new RegExp('"' + name + '":\\s*\\{\\s*"baseUrl"\\s*:\\s*"(.*?)"'));
		return m ? unescapeUrl(m[1]) : null;
	}

	async function fetchTrackingFromWatchPage(videoId) {
		const res = await fetch('https://www.youtube.com/watch?v=' + encodeURIComponent(videoId), {
			credentials: 'include',
			cache: 'no-store'
		});
		if (!res.ok) throw new Error('watch ' + res.status);

		const html = await res.text();
		const playback = pickBaseUrl(html, 'videostatsPlaybackUrl');
		const watchtime = pickBaseUrl(html, 'videostatsWatchtimeUrl');
		const loggedIn = /"LOGGED_IN"\s*:\s*true/.test(html);

		if (!playback || !watchtime) throw new Error('playbackTracking が見つからない');
		if (!loggedIn) throw new Error('取得した /watch がログアウト状態');

		return { playback, watchtime };
	}

	const ORIGIN = 'https://www.youtube.com';

	let cfgCache = null;

	function readCookie(name) {
		const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
		return m ? m[1] : null;
	}

	async function sha1Hex(text) {
		const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
		const bytes = new Uint8Array(buf);
		let hex = '';
		for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
		return hex;
	}

	async function sapisidHash() {
		const sapisid = readCookie('SAPISID') || readCookie('__Secure-3PAPISID') || readCookie('__Secure-1PAPISID');
		if (!sapisid) return null;
		const ts = Math.floor(Date.now() / 1000);
		return 'SAPISIDHASH ' + ts + '_' + await sha1Hex(ts + ' ' + sapisid + ' ' + ORIGIN);
	}

	function readConfig() {
		if (cfgCache) return cfgCache;
		cfgCache = fromYtcfg() || fromInlineScripts();
		return cfgCache;
	}

	function fromYtcfg() {
		try {
			const page = window.wrappedJSObject;
			if (!page || !page.ytcfg || typeof page.ytcfg.get !== 'function') return null;
			const get = k => {
				const v = page.ytcfg.get(k);
				return (v === undefined || v === null) ? null : String(v);
			};
			const clientVersion = get('INNERTUBE_CLIENT_VERSION');
			if (!clientVersion) return null;
			return {
				apiKey: get('INNERTUBE_API_KEY'),
				clientVersion: clientVersion,
				visitorData: get('VISITOR_DATA'),
				sessionIndex: get('SESSION_INDEX') || '0',
				pageId: get('DELEGATED_SESSION_ID'),
				hl: get('HL') || 'ja',
				gl: get('GL') || 'JP'
			};
		} catch (e) {
			return null;
		}
	}

	function fromInlineScripts() {
		const scripts = document.querySelectorAll('script:not([src])');
		for (let i = 0; i < scripts.length; i++) {
			const text = scripts[i].textContent;
			if (!text || text.indexOf('INNERTUBE_CLIENT_VERSION') < 0) continue;
			const pick = k => {
				const m = text.match(new RegExp('"' + k + '"\\s*:\\s*"(.*?)"'));
				return m ? m[1] : null;
			};
			const clientVersion = pick('INNERTUBE_CLIENT_VERSION');
			if (!clientVersion) continue;
			return {
				apiKey: pick('INNERTUBE_API_KEY'),
				clientVersion: clientVersion,
				visitorData: pick('VISITOR_DATA'),
				sessionIndex: pick('SESSION_INDEX') || '0',
				pageId: pick('DELEGATED_SESSION_ID'),
				hl: pick('HL') || 'ja',
				gl: pick('GL') || 'JP'
			};
		}
		return null;
	}

	async function fetchTrackingFromInnertube(videoId) {
		const cfg = readConfig();
		if (!cfg) throw new Error('ytcfg が読めない');

		const auth = await sapisidHash();
		if (!auth) throw new Error('SAPISID cookie が無い');

		const headers = {
			'Content-Type': 'application/json',
			'Authorization': auth,
			'X-Origin': ORIGIN,
			'X-Goog-AuthUser': cfg.sessionIndex,
			'X-Youtube-Client-Name': '1',
			'X-Youtube-Client-Version': cfg.clientVersion
		};
		if (cfg.pageId) headers['X-Goog-PageId'] = cfg.pageId;
		if (cfg.visitorData) headers['X-Goog-Visitor-Id'] = cfg.visitorData;

		const url = ORIGIN + '/youtubei/v1/player?prettyPrint=false' +
			(cfg.apiKey ? '&key=' + encodeURIComponent(cfg.apiKey) : '');

		const res = await fetch(url, {
			method: 'POST',
			credentials: 'include',
			cache: 'no-store',
			headers: headers,
			body: JSON.stringify({
				videoId: videoId,
				contentCheckOk: true,
				racyCheckOk: true,
				context: {
					client: {
						clientName: 'WEB',
						clientVersion: cfg.clientVersion,
						hl: cfg.hl,
						gl: cfg.gl,
						visitorData: cfg.visitorData || undefined
					}
				}
			})
		});
		if (!res.ok) throw new Error('player ' + res.status);

		const json = await res.json();
		const ctx = json.responseContext && json.responseContext.mainAppWebResponseContext;
		if (ctx && ctx.loggedOut) throw new Error('ログアウト扱いで返ってきた');

		const tracking = json.playbackTracking || {};
		const playback = tracking.videostatsPlaybackUrl && tracking.videostatsPlaybackUrl.baseUrl;
		const watchtime = tracking.videostatsWatchtimeUrl && tracking.videostatsWatchtimeUrl.baseUrl;
		if (!playback || !watchtime) throw new Error('playbackTracking が無い');

		if (/[?&]el=embedded/.test(watchtime)) throw new Error('el=embedded が返ってきた');

		return { playback: playback, watchtime: watchtime };
	}

	async function fetchTracking(videoId) {
		try {
			const urls = await fetchTrackingFromInnertube(videoId);
			note('送信先を取得（InnerTube）');
			return urls;
		} catch (e) {
			noteWarn('InnerTube が使えないので /watch に落ちる:', e.message);
			const urls = await fetchTrackingFromWatchPage(videoId);
			note('送信先を取得（/watch）');
			return urls;
		}
	}

	function ping(baseUrl, params) {
		const url = new URL(baseUrl);
		Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
		return fetch(url.toString(), {
			credentials: 'include',
			cache: 'no-store'
		}).then(res => {
			note(url.pathname.replace('/api/stats/', ''), res.status, params.cmt !== undefined ? params.cmt + 's' : '');
			return res.ok;
		}).catch(e => {
			noteWarn('ping 失敗', url.pathname, e);
			return false;
		});
	}

	function begin(videoId) {
		const cpn = newCpn();
		const startedAt = performance.now();

		let urls = null;
		let pending = null;
		let sentPlayback = false;
		let lastEnd = 0;

		function elapsed() {
			return ((performance.now() - startedAt) / 1000).toFixed(1);
		}

		function ensureUrls() {
			if (!pending) {
				note('セッション開始', videoId, 'cpn=' + cpn);
				pending = fetchTracking(videoId).then(
					u => { urls = u; },
					e => { noteWarn('送信先の取得に失敗', videoId, e.message); }
				);
			}
			return pending;
		}

		async function report(seconds, final) {
			if (!(seconds >= MIN_SECONDS)) return false;
			await ensureUrls();
			if (!urls) return false;

			const t = Math.round(seconds * 1000) / 1000;

			if (!sentPlayback) {
				sentPlayback = true;
				await ping(urls.playback, { ver: 2, cpn: cpn, rt: elapsed() });
			}

			const st = Math.min(lastEnd, t);
			if (!final && t - lastEnd < 1) return true;
			lastEnd = t;

			const params = {
				ver: 2,
				cpn: cpn,
				cmt: t,
				st: st,
				et: t,
				rt: elapsed(),
				state: final ? 'paused' : 'playing'
			};
			if (final) params.final = 1;

			return ping(urls.watchtime, params);
		}

		return { videoId: videoId, cpn: cpn, report: report };
	}

	window.YTaqHistory = {
		get enabled() { return enabled; },
		begin: begin,

		mark(videoId, seconds) {
			return begin(videoId).report(seconds || 60, true);
		}
	};
})();
