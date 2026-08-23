// YTaq: ポップアップ再生を視聴履歴に載せる
//
// 埋め込みプレイヤー（/embed/）からの再生は、ログインしていても watch history に
// 載らない（2026-08-15 実測）。再生ログの送り先そのものが違うため。
//
//     /watch  のプレイヤー → s.youtube.com/api/stats/watchtime?...&el=detailpage
//     /embed/ のプレイヤー → 同じエンドポイントに &el=embedded
//
// 履歴に反映されるのは el=detailpage の方だけ。埋め込み側は再生回数にしか効かない。
// iframe の URL やパラメータをいじっても el は変えられない（プレイヤー側が
// 自分の playerResponse に入っている baseUrl をそのまま使うため）。
//
// そこで、/watch 用の playerResponse を自分で取得して、その中の
// videostatsPlaybackUrl / videostatsWatchtimeUrl を自前で叩く。
// 送る秒数は iframe の <video>.currentTime から取った実値なので、
// 「見ていないものを見たことにする」わけではなく、実際の視聴を
// 埋め込み経路の代わりに報告しているだけ。
//
// 注意: YouTube の内部エンドポイントなので、Referer 差し替えと同じく
// 黙って効かなくなる類。壊れても再生自体には影響しない（iframe とは独立で、
// 失敗しても /watch の取得1回分を捨てるだけ）ので、既定 ON で持っている。
//
// 送信先の取得は InnerTube（/youtubei/v1/player）から。/watch の HTML でも
// 取れるが 1MB 級あるので、そちらは InnerTube が使えないときのフォールバック。
// 詳細は fetchTrackingFromInnertube() のコメント。

(function () {
	'use strict';

	const YTaq = window.YTaq;

	// --- ログ ---------------------------------------------------------------
	// 成功時は DEBUG 任せでいい（2026-08-23 に経路が通ることを確認済み）。
	// ただし失敗だけは DEBUG に関係なく出す。この機能は壊れても再生に影響しないので、
	// 黙って効かなくなると「最近おすすめが変わらないな」まで誰も気付けない。
	// YouTube 側の仕様変更で死ぬ前提の回避策なので、死ぬときは声を上げさせる。
	//
	// なお devtools のコンソールはページ側の world なので、ここのグローバルは
	// 触れない（YTaqHistory is not defined になる）。確認はこのログでやること。
	const note = YTaq.log;
	const noteWarn = console.warn.bind(console, '[YTaq history]');

	const HISTORY_KEY = 'ytaq_watch_history';
	let enabled = false;

	YTaq.getStorage(HISTORY_KEY, true).then(v => { enabled = !!v; });
	YTaq.onStorageChange(HISTORY_KEY, v => { enabled = !!v; });

	// 一瞬開いて閉じただけのものを履歴に積まない。ここを過ぎてから初めて
	// /watch の取得（重い）に入るので、誤爆のコストもゼロになる。
	const MIN_SECONDS = 5;

	// 再生中の定期報告の間隔。本家プレイヤーも同程度の間隔で送っている。
	const PING_INTERVAL_MS = 30000;

	// cpn（client playback nonce）は1回の再生を識別する 16 文字。
	// playback ping と watchtime ping で同じ値を使わないと繋がらない。
	const CPN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

	function newCpn() {
		const buf = new Uint8Array(16);
		crypto.getRandomValues(buf);
		let out = '';
		for (let i = 0; i < buf.length; i++) out += CPN_CHARS[buf[i] & 63];
		return out;
	}

	// HTML に埋まっている JSON 内の URL は & や \/ でエスケープされている
	function unescapeUrl(s) {
		return s.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
	}

	function pickBaseUrl(html, name) {
		const m = html.match(new RegExp('"' + name + '":\\s*\\{\\s*"baseUrl"\\s*:\\s*"(.*?)"'));
		return m ? unescapeUrl(m[1]) : null;
	}

	/**
	 * /watch の HTML から再生ログの送信先を取り出す（フォールバック経路）。
	 *
	 * 確実だが 1MB 級を1本取る。InnerTube が使えるならそちらを先に試し、
	 * 失敗したときだけここへ落ちる。ページの HTML は SAPISIDHASH のような
	 * 追加の仕掛けが要らず document GET の Cookie だけで通るので、
	 * 「重いが壊れにくい」側として残す価値がある。
	 */
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
		// ログアウト状態で取った URL では当然どのアカウントにも紐づかない
		if (!loggedIn) throw new Error('取得した /watch がログアウト状態');

		return { playback, watchtime };
	}

	// --- InnerTube 経路 ------------------------------------------------------
	// /watch の HTML は 1MB 級あるのに、要るのは playbackTracking の2本の URL だけ。
	// /youtubei/v1/player なら同じものが数十 KB で返る。軽量化が看板の拡張で
	// 再生のたびに1MB 引くのは筋が通らないので、こちらを既定の経路にする。
	//
	// 代償は認証を自分で組む必要があること。Cookie を送るだけではログアウト扱いになり、
	// 返ってくる URL がどのアカウントにも紐づかない（ping は 204 で通るのに履歴に
	// 載らない、という一番気付きにくい壊れ方をする）。Google の web クライアントは
	//     Authorization: SAPISIDHASH <ts>_<sha1(ts + " " + SAPISID + " " + origin)>
	// を付けており、SAPISID は JS から読める Cookie なので同じものを組める。
	//
	// ここが壊れたら /watch の HTML に落ちる。重いが動く方を残しておく。

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
		// 通常セッションは SAPISID、3rd-party cookie 制限下だと __Secure-3PAPISID になる
		const sapisid = readCookie('SAPISID') || readCookie('__Secure-3PAPISID') || readCookie('__Secure-1PAPISID');
		if (!sapisid) return null;
		const ts = Math.floor(Date.now() / 1000);
		return 'SAPISIDHASH ' + ts + '_' + await sha1Hex(ts + ' ' + sapisid + ' ' + ORIGIN);
	}

	/**
	 * InnerTube に必要な諸元（API キー・クライアント版・visitor 等）を集める。
	 *
	 * ページ側の ytcfg から読むのが正確。content script は isolated world なので
	 * そのままでは見えないが、Firefox なら wrappedJSObject で辿れる。
	 * それも駄目なら ytcfg.set(...) を吐いているインラインスクリプトから拾う。
	 */
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
		// 複数アカウント時、これが無いと別のアカウントの履歴に積まれる
		if (cfg.pageId) headers['X-Goog-PageId'] = cfg.pageId;
		if (cfg.visitorData) headers['X-Goog-Visitor-Id'] = cfg.visitorData;

		// 絶対 URL で組むこと。content script の fetch は相対 URL をドキュメントの
		// ベース URI で解決しないので、'/youtubei/...' だと URL として弾かれる。
		const url = ORIGIN + '/youtubei/v1/player?prettyPrint=false' +
			(cfg.apiKey ? '&key=' + encodeURIComponent(cfg.apiKey) : '');

		const res = await fetch(url, {
			method: 'POST',
			credentials: 'include',
			cache: 'no-store',
			headers: headers,
			body: JSON.stringify({
				videoId: videoId,
				// 年齢制限つきでも playbackTracking を返させる
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
		// ここを見落とすと「ping は 204 なのに履歴に載らない」で延々悩むことになる
		if (ctx && ctx.loggedOut) throw new Error('ログアウト扱いで返ってきた');

		const tracking = json.playbackTracking || {};
		const playback = tracking.videostatsPlaybackUrl && tracking.videostatsPlaybackUrl.baseUrl;
		const watchtime = tracking.videostatsWatchtimeUrl && tracking.videostatsWatchtimeUrl.baseUrl;
		if (!playback || !watchtime) throw new Error('playbackTracking が無い');

		// 履歴に効くのは el=detailpage だけ。WEB クライアントで頼んでいるのに
		// embedded が返ってきたら、この経路を使う意味そのものが無い。
		if (/[?&]el=embedded/.test(watchtime)) throw new Error('el=embedded が返ってきた');

		return { playback: playback, watchtime: watchtime };
	}

	async function fetchTracking(videoId) {
		try {
			const urls = await fetchTrackingFromInnertube(videoId);
			note('送信先を取得（InnerTube）');
			return urls;
		} catch (e) {
			// 黙って重い方に落ちると、劣化に気付けないまま毎回 1MB 引き続ける
			noteWarn('InnerTube が使えないので /watch に落ちる:', e.message);
			const urls = await fetchTrackingFromWatchPage(videoId);
			note('送信先を取得（/watch）');
			return urls;
		}
	}

	function ping(baseUrl, params) {
		const url = new URL(baseUrl);
		Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
		// keepalive は付けないこと。content script のサンドボックスから投げると
		// InvalidStateError（"no longer usable"）で即死する（2026-08-23 実測）。
		// ポップアップを閉じてもページ自体はアンロードされないので、最後の ping も
		// 普通の fetch でそのまま飛ぶ。keepalive が要る場面はここには無い。
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

	/**
	 * 1本の視聴セッション。report() を何度呼んでもよく、
	 * 初回で playback ping、以降は前回からの区間を watchtime ping で送る。
	 */
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

			// 前回報告からの区間だけを送る。シークで巻き戻っていたら潰す。
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

		/**
		 * 検証用。コンソールから
		 *     await YTaqHistory.mark('VIDEO_ID', 60)
		 * で「60 秒見た」を1回だけ送る。true が返って履歴に出れば経路として成立。
		 * DEBUG=false でも結果が分かるよう、戻り値で判定できるようにしてある。
		 */
		mark(videoId, seconds) {
			return begin(videoId).report(seconds || 60, true);
		}
	};
})();
