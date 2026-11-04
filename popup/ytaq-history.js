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

	async function fetchTrackingFromInnertube(videoId) {
		const json = await window.YTaqInnertube.call('player', { videoId, contentCheckOk: true, racyCheckOk: true });
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
