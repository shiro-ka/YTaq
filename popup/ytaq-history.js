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
// 残っているコストは「再生ごとに /watch の HTML を1回取る」こと。
// InnerTube に移せば桁で減らせる。fetchTracking() のコメントを参照。

(function () {
	'use strict';

	const YTaq = window.YTaq;

	// --- 検証用ログ ---------------------------------------------------------
	// 効いたかどうかは履歴ページを見るまで分からず、失敗しても画面には何も出ない。
	// しかも devtools のコンソールはページ側の world なので、ここのグローバルを
	// 触って確かめることもできない（YTaqHistory is not defined になる）。
	// 経路が固まるまでは DEBUG に関係なく結果を吐く。固まったら YTaq.log に戻すこと。
	const note = console.log.bind(console, '[YTaq history]');
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
	 * /watch の HTML から再生ログの送信先を取り出す。
	 *
	 * InnerTube（/youtubei/v1/player）を直接叩けば数十分の一の転送量で済むが、
	 * あちらは SAPISIDHASH ヘッダを自分で組まないとログアウト扱いになり、
	 * 「履歴に載るか」の検証に余計な失敗要因が増える。まず素の HTML で
	 * 成立を確認して、効くと分かってから InnerTube に移す。
	 */
	async function fetchTracking(videoId) {
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
					u => {
						urls = u;
						note('送信先を取得', u.watchtime.slice(0, 80) + '…');
					},
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
