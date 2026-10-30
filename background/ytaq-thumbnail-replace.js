const THUMB_RE = /^https:\/\/i9?\.ytimg\.com\/(vi|vi_webp)\/([\w-]+)\/(default|hqdefault|mqdefault|sddefault|maxresdefault|hq720)(_custom_\d+)?\.(jpg|webp)/;

let settings = YTaqSettings.defaults('antibite');
YTaqSettings.watch('antibite', v => { settings = v; });

browser.webRequest.onBeforeRequest.addListener(
	(details) => {
		if (!settings.thumbnailEnabled) return;

		const match = THUMB_RE.exec(details.url);
		if (!match) return;

		const videoId = match[2];
		const frame = settings.thumbnailFrame;

		const extension = /^hq[123]$/.test(frame) ? 'jpg' : match[5];

		return { redirectUrl: `https://i.ytimg.com/vi/${videoId}/${frame}.${extension}` };
	},
	{
		urls: ['*://i.ytimg.com/*', '*://i9.ytimg.com/*'],
		types: ['image', 'imageset', 'xmlhttprequest']
	},
	['blocking']
);
