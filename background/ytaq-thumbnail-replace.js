// YTaq: サムネイルを別フレームの静止画にリダイレクトする
//
// このリスナーは blocking で、ホーム1画面あたり数百回呼ばれる。
// 以前は1リクエストごとに console.log を出していて、それ自体が無視できない
// コストになっていた（DevTools を開いていると特に）。ログは DEBUG 時のみ。

const ANTIBITE_STORAGE_KEY = 'ytaq_antibite';

const DEFAULT_ANTIBITE = {
	thumbnailEnabled: true,
	thumbnailFrame: 'hq1'
};

// URL パターンはリスナーの外で1回だけ作る
const THUMB_RE = /^https:\/\/i9?\.ytimg\.com\/(vi|vi_webp)\/([\w-]+)\/(default|hqdefault|mqdefault|sddefault|maxresdefault|hq720)(_custom_\d+)?\.(jpg|webp)/;

let settings = DEFAULT_ANTIBITE;

chrome.storage.local.get([ANTIBITE_STORAGE_KEY], (result) => {
	settings = Object.assign({}, DEFAULT_ANTIBITE, result[ANTIBITE_STORAGE_KEY]);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === 'local' && changes[ANTIBITE_STORAGE_KEY]) {
		settings = Object.assign({}, DEFAULT_ANTIBITE, changes[ANTIBITE_STORAGE_KEY].newValue);
	}
});

browser.webRequest.onBeforeRequest.addListener(
	(details) => {
		if (!settings.thumbnailEnabled) return;

		const match = THUMB_RE.exec(details.url);
		if (!match) return;

		const videoId = match[2];
		const frame = settings.thumbnailFrame || 'hq1';

		// 拡張子は元リクエストから引き継がない。hq1〜hq3 は動画から切り出した
		// フレームで、/vi/ の jpg にしか存在しない（/vi_webp/ にあるのは
		// default 系だけ）。webp のまま飛ばすと全部 404 になる。
		const extension = /^hq[123]$/.test(frame) ? 'jpg' : match[5];

		return { redirectUrl: `https://i.ytimg.com/vi/${videoId}/${frame}.${extension}` };
	},
	{
		urls: ['*://i.ytimg.com/*', '*://i9.ytimg.com/*'],
		types: ['image', 'imageset', 'xmlhttprequest']
	},
	['blocking']
);
