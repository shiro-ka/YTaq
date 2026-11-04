(function () {
	'use strict';

	const ORIGIN = 'https://www.youtube.com';
	const CLIENT_KEY = 'ytaq_innertube';

	let cached = null;

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
				clientVersion,
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
				clientVersion,
				visitorData: pick('VISITOR_DATA'),
				sessionIndex: pick('SESSION_INDEX') || '0',
				pageId: pick('DELEGATED_SESSION_ID'),
				hl: pick('HL') || 'ja',
				gl: pick('GL') || 'JP'
			};
		}
		return null;
	}

	function config() {
		if (!cached) cached = fromYtcfg() || fromInlineScripts();
		return cached;
	}

	function waitConfig() {
		return new Promise(ok => {
			const until = Date.now() + 15000;
			(function poll() {
				const cfg = config();
				if (cfg) return ok(cfg);
				if (Date.now() > until) return ok(null);
				setTimeout(poll, 200);
			})();
		});
	}

	function readCookie(name) {
		const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
		return m ? m[1] : null;
	}

	async function sapisidHash() {
		const sapisid = readCookie('SAPISID') || readCookie('__Secure-3PAPISID') || readCookie('__Secure-1PAPISID');
		if (!sapisid) return null;
		const ts = Math.floor(Date.now() / 1000);
		const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(ts + ' ' + sapisid + ' ' + ORIGIN));
		let hex = '';
		for (const b of new Uint8Array(buf)) hex += b.toString(16).padStart(2, '0');
		return 'SAPISIDHASH ' + ts + '_' + hex;
	}

	async function call(path, body, options) {
		const cfg = await waitConfig();
		if (!cfg) throw new Error('no ytcfg');
		const headers = {
			'Content-Type': 'application/json',
			'X-Origin': ORIGIN,
			'X-Goog-AuthUser': cfg.sessionIndex,
			'X-Youtube-Client-Name': '1',
			'X-Youtube-Client-Version': cfg.clientVersion
		};
		if (!options || options.auth !== false) {
			const auth = await sapisidHash();
			if (!auth) throw new Error('no SAPISID');
			headers.Authorization = auth;
		}
		if (cfg.pageId) headers['X-Goog-PageId'] = cfg.pageId;
		if (cfg.visitorData) headers['X-Goog-Visitor-Id'] = cfg.visitorData;

		const url = ORIGIN + '/youtubei/v1/' + path + '?prettyPrint=false' +
			(cfg.apiKey ? '&key=' + encodeURIComponent(cfg.apiKey) : '');
		const res = await fetch(url, {
			method: 'POST',
			credentials: 'include',
			cache: 'no-store',
			headers,
			body: JSON.stringify(Object.assign({
				context: {
					client: {
						clientName: 'WEB',
						clientVersion: cfg.clientVersion,
						hl: cfg.hl,
						gl: cfg.gl,
						visitorData: cfg.visitorData || undefined
					}
				}
			}, body))
		});
		if (!res.ok) throw new Error(path + ' ' + res.status);
		return res.json();
	}

	waitConfig().then(cfg => {
		if (cfg) chrome.storage.local.set({ [CLIENT_KEY]: { clientVersion: cfg.clientVersion, hl: cfg.hl, gl: cfg.gl } });
	});

	window.YTaqInnertube = { config, waitConfig, call };
})();
