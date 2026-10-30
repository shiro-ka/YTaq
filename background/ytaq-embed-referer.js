let embedReferer = YTaqSettings.defaults('embedReferer');
YTaqSettings.watch('embedReferer', v => { embedReferer = v; });

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
