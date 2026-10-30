(function () {
	'use strict';

	const YTaq = window.YTaq;
	const KEY = 'ytaq_playbackrate';

	function getChannelName() {
		const el = document.querySelector('ytd-channel-name a, #owner-name a, .ytd-channel-name a');
		return el ? el.textContent.trim() : null;
	}

	async function getStoredRate(channel) {
		const map = await YTaq.getStorage(KEY, {});
		return map[channel] || null;
	}

	async function setStoredRate(channel, rate) {
		const map = await YTaq.getStorage(KEY, {});
		map[channel] = rate;
		await YTaq.setStorage(KEY, map);
	}

	function observeRateChanges(video, channel) {
		if (video.dataset.ytaqRateWatched === channel) return;
		video.dataset.ytaqRateWatched = channel;

		video.addEventListener('ratechange', () => {
			setStoredRate(channel, video.playbackRate);
			YTaq.log('rate saved:', channel, video.playbackRate);
		});
	}

	async function apply() {
		if (!location.pathname.startsWith('/watch')) return;

		const channel = getChannelName();
		const video = document.querySelector('video');
		if (!channel || !video) return;

		const rate = await getStoredRate(channel);
		if (rate && video.playbackRate !== rate) {
			video.playbackRate = rate;
			YTaq.log('rate applied:', channel, rate);
		}
		observeRateChanges(video, channel);
	}

	function applyWhenReady() {
		if (!location.pathname.startsWith('/watch')) return;
		YTaq.waitFor('ytd-channel-name a, #owner-name a', () => {
			YTaq.waitFor('video', apply);
		});
	}

	YTaq.ready(applyWhenReady);
	YTaq.onNavigate(applyWhenReady);

	window.YTaqRate = { getStoredRate, setStoredRate };
})();
