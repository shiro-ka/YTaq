const ANTIBITE_STORAGE_KEY = 'ytaq_antibite';

const DEFAULT_ANTIBITE = {
	thumbnailEnabled: true,
	thumbnailFrame: 'hq1'
};

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

		const extension = /^hq[123]$/.test(frame) ? 'jpg' : match[5];

		return { redirectUrl: `https://i.ytimg.com/vi/${videoId}/${frame}.${extension}` };
	},
	{
		urls: ['*://i.ytimg.com/*', '*://i9.ytimg.com/*'],
		types: ['image', 'imageset', 'xmlhttprequest']
	},
	['blocking']
);
