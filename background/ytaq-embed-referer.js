const REFERER_KEY = 'ytaq_embed_referer';

const DEFAULT_REFERER = 'https://example.com/';

let embedReferer = DEFAULT_REFERER;

chrome.storage.local.get([REFERER_KEY], (result) => {
	embedReferer = result[REFERER_KEY] || DEFAULT_REFERER;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === 'local' && changes[REFERER_KEY]) {
		embedReferer = changes[REFERER_KEY].newValue || DEFAULT_REFERER;
	}
});

browser.webRequest.onBeforeSendHeaders.addListener(
	(details) => {
		if (!embedReferer) return;

		const headers = details.requestHeaders.filter(
			h => h.name.toLowerCase() !== 'referer'
		);
		headers.push({ name: 'Referer', value: embedReferer });

		return { requestHeaders: headers };
	},
	{
		urls: [
			'*://www.youtube-nocookie.com/embed/*',
			'*://www.youtube.com/embed/*'
		],
		types: ['sub_frame']
	},
	['blocking', 'requestHeaders']
);
