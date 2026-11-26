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
			if (!current || current.music || current.videoId !== videoIdOfPage()) return;
			window.YTaqChannels.setRate(current.id, current.name, video.playbackRate);
			YTaq.log('rate saved:', current.name, video.playbackRate);
		});
	}

	function fromPage(videoId) {
		try {
			const player = document.querySelector('#movie_player');
			const r = player && player.wrappedJSObject && player.wrappedJSObject.getPlayerResponse();
			const d = r && r.videoDetails;
			if (!d || d.videoId !== videoId || !d.channelId) return null;
			const mf = r.microformat && r.microformat.playerMicroformatRenderer;
			return { videoDetails: { videoId: d.videoId, channelId: d.channelId, author: d.author }, microformat: { playerMicroformatRenderer: { category: mf && mf.category } } };
		} catch {
			return null;
		}
	}

	async function applyWhenReady() {
		const token = ++seq;
		current = null;
		const videoId = videoIdOfPage();
		if (!videoId) return;

		let json = fromPage(videoId);
		if (!json) {
			try {
				json = await window.YTaqInnertube.call('player', { videoId, contentCheckOk: true, racyCheckOk: true });
			} catch (e) {
				YTaq.warn('rate: player', e.message);
				return;
			}
		}
		if (token !== seq) return;
		const details = json.videoDetails || {};
		if (!details.channelId) return;

		const category = json.microformat && json.microformat.playerMicroformatRenderer && json.microformat.playerMicroformatRenderer.category;
		const music = !!window.YTaqMusic && window.YTaqMusic.isMusic(videoId, category);
		const rate = music ? 1 : await window.YTaqChannels.getRate(details.channelId, details.author);
		if (token !== seq) return;
		YTaq.waitFor('video', () => {
			if (token !== seq) return;
			const video = document.querySelector('video');
			if (!video) return;
			if (rate && video.playbackRate !== rate) {
				video.playbackRate = rate;
				YTaq.log('rate applied:', details.author, rate);
			}
			current = { id: details.channelId, name: details.author, videoId, music };
			observeRateChanges(video);
		});
	}

	YTaq.ready(applyWhenReady);
	YTaq.onNavigate(applyWhenReady);
})();
