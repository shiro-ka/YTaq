// YTaq バックグラウンド
//
// 重要: onHeadersReceived は blocking なので、マッチしたリクエストの
// レスポンスを同期的に止めて処理する。以前は urls:['<all_urls>'] だったため
// YouTube に限らず全サイトの全レスポンスを毎回この関数に通していた
// （しかも1件ごとに console.log を4〜5行出していた）。
// ブラウジング全体が遅くなるので、YouTube の sub_frame だけに絞ってある。

const DEBUG = false;
const log = DEBUG ? console.log.bind(console, '[YTaq BG]') : function () {};

if (chrome.browserAction) {
	chrome.browserAction.onClicked.addListener(() => chrome.runtime.openOptionsPage());
} else if (chrome.action) {
	chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
}

// ポップアップ内 iframe の埋め込み制限を外す。
// /embed/ は本来埋め込み可能なので通常は不要だが、埋め込み無効設定の動画で
// /watch にフォールバックした場合に必要になる。
browser.webRequest.onHeadersReceived.addListener(
	(details) => {
		let modified = false;

		const headers = details.responseHeaders.filter(h => {
			const name = h.name.toLowerCase();
			if (name === 'x-frame-options' || name === 'frame-options') {
				modified = true;
				return false;
			}
			return true;
		});

		for (const h of headers) {
			const name = h.name.toLowerCase();
			if (name !== 'content-security-policy' && name !== 'content-security-policy-report-only') continue;
			const original = h.value;
			h.value = h.value.replace(/frame-ancestors[^;]*(;|$)/gi, '');
			if (original !== h.value) modified = true;
		}

		if (!modified) return;
		log('headers relaxed for', details.url);
		return { responseHeaders: headers };
	},
	{
		// 対象を絞ることが軽量化の本体。ここを広げてはいけない。
		urls: [
			'*://www.youtube.com/embed/*',
			'*://www.youtube-nocookie.com/embed/*',
			'*://www.youtube.com/watch*'
		],
		types: ['sub_frame']
	},
	['blocking', 'responseHeaders']
);
