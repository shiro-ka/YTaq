const THUMB_RE = /^https:\/\/i9?\.ytimg\.com\/(?:vi|vi_webp)\/([\w-]+)\/(?:default|hqdefault|mqdefault|sddefault|maxresdefault|hq720|(oardefault|oar\d))(?:_custom_\d+)?\.(?:jpg|webp)/;

let settings = YTaqSettings.defaults('antibite');
YTaqSettings.watch('antibite', v => { settings = v; });

const noFrames = new Set();
const redirected = new Map();

browser.webRequest.onBeforeRequest.addListener(
	(details) => {
		if (!settings.thumbnailEnabled) return;

		const match = THUMB_RE.exec(details.url);
		if (!match) return;

		const videoId = match[1];
		if (noFrames.has(videoId)) return;

		const frame = settings.shortsVertical && match[2] ? 'oar' + settings.thumbnailFrame.slice(-1) : settings.thumbnailFrame;
		const target = `https://i.ytimg.com/vi/${videoId}/${frame}.jpg`;
		if (details.url === target) return;

		redirected.set(details.requestId, { videoId, original: details.url });
		return { redirectUrl: target };
	},
	{
		urls: ['*://i.ytimg.com/*', '*://i9.ytimg.com/*'],
		types: ['image', 'imageset', 'xmlhttprequest']
	},
	['blocking']
);

browser.webRequest.onHeadersReceived.addListener(
	(details) => {
		const r = redirected.get(details.requestId);
		if (!r || details.url === r.original) return;
		redirected.delete(details.requestId);
		if (details.statusCode < 400) return;

		noFrames.add(r.videoId);
		return { redirectUrl: r.original };
	},
	{
		urls: ['*://i.ytimg.com/vi/*'],
		types: ['image', 'imageset', 'xmlhttprequest']
	},
	['blocking']
);

const forget = (details) => { redirected.delete(details.requestId); };
browser.webRequest.onCompleted.addListener(forget, { urls: ['*://i.ytimg.com/*', '*://i9.ytimg.com/*'] });
browser.webRequest.onErrorOccurred.addListener(forget, { urls: ['*://i.ytimg.com/*', '*://i9.ytimg.com/*'] });
