// YTaq: チャンネルごとに再生速度を記憶・自動適用する
// データ管理のみ（UI は ytaq-rate-ui.js）
//
// 以前は 1秒ごとに location.href を比較していたが、遷移検知は core に集約した。

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

	// 同じ video 要素に何度も listener を付けないよう印を付ける
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

	// 遷移直後はチャンネル名も video 要素もまだ無いことが多いので、
	// 揃うまで数フレーム粘る（タイマーではなく rAF）。
	function applyWhenReady() {
		if (!location.pathname.startsWith('/watch')) return;
		YTaq.waitFor('ytd-channel-name a, #owner-name a', () => {
			YTaq.waitFor('video', apply);
		});
	}

	YTaq.ready(applyWhenReady);
	YTaq.onNavigate(applyWhenReady);
})();
