(function () {
	'use strict';

	const YTaq = window.YTaq;

	const watched = new WeakSet();
	let current = null;
	let seq = 0;

	function videoIdOfPage() {
		return location.pathname.startsWith('/watch') ? new URLSearchParams(location.search).get('v') : null;
	}

	function observeRateChanges(video) {
		if (watched.has(video)) return;
		watched.add(video);
		video.addEventListener('ratechange', () => {
			if (!current || current.videoId !== videoIdOfPage()) return;
			window.YTaqChannels.setRate(current.id, current.name, video.playbackRate);
			YTaq.log('rate saved:', current.name, video.playbackRate);
		});
	}

	async function applyWhenReady() {
		const token = ++seq;
		current = null;
		const videoId = videoIdOfPage();
		if (!videoId) return;

		let json;
		try {
			json = await window.YTaqInnertube.call('player', { videoId, contentCheckOk: true, racyCheckOk: true });
		} catch (e) {
			YTaq.warn('rate: player', e.message);
			return;
		}
		if (token !== seq) return;
		const details = json.videoDetails || {};
		if (!details.channelId) return;

		const rate = await window.YTaqChannels.getRate(details.channelId, details.author);
		if (token !== seq) return;
		YTaq.waitFor('video', () => {
			if (token !== seq) return;
			const video = document.querySelector('video');
			if (!video) return;
			if (rate && video.playbackRate !== rate) {
				video.playbackRate = rate;
				YTaq.log('rate applied:', details.author, rate);
			}
			current = { id: details.channelId, name: details.author, videoId };
			observeRateChanges(video);
		});
	}

	YTaq.ready(applyWhenReady);
	YTaq.onNavigate(applyWhenReady);
})();
