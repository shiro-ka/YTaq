(function () {
	'use strict';

	const YTaq = window.YTaq;

	let thumbSettings = YTaqSettings.defaults('antibite');
	YTaqSettings.watch('antibite', v => { thumbSettings = v; });

	function thumbnailUrl(videoId) {
		return `https://i.ytimg.com/vi/${videoId}/${thumbSettings.thumbnailFrame}.jpg`;
	}

	let useLoggedInEmbed = YTaqSettings.defaults('embedLogin');
	YTaqSettings.watch('embedLogin', v => { useLoggedInEmbed = !!v; });

	function embedHost() {
		return useLoggedInEmbed ? 'https://www.youtube.com' : 'https://www.youtube-nocookie.com';
	}

	function embedUrl(videoId) {
		const params = new URLSearchParams({
			autoplay: '1',
			playsinline: '1',
			rel: '0',
			enablejsapi: '1',
			origin: location.origin
		});
		return `${embedHost()}/embed/${videoId}?${params}`;
	}

	function watchUrl(videoId) {
		return `https://www.youtube.com/watch?v=${videoId}`;
	}

	const RATE_MIN = 0.25;
	const RATE_MAX = 16.0;

	function command(iframe, func, args) {
		try {
			iframe.contentWindow.postMessage(
				JSON.stringify({ event: 'command', func, args: args || [], id: 1, channel: 'widget' }),
				embedHost()
			);
		} catch (e) {
			YTaq.warn('popup: command failed:', func, e);
		}
	}

	function embeddedVideo(iframe) {
		try {
			const doc = iframe.contentDocument;
			return (doc && doc.querySelector('video')) || null;
		} catch (e) {
			return null;
		}
	}

	function applyRate(iframe, rate) {
		const v = embeddedVideo(iframe);
		if (v) {
			v.playbackRate = rate;
			return true;
		}
		command(iframe, 'setPlaybackRate', [rate]);
		return false;
	}

	let escHandler = null;
	let messageHandler = null;
	let historyStop = null;

	function hideVideoPopup() {
		if (historyStop) {
			historyStop();
			historyStop = null;
		}
		const popup = document.getElementById('ytaq-popup');
		if (popup) popup.remove();
		if (escHandler) {
			document.removeEventListener('keydown', escHandler);
			escHandler = null;
		}
		if (messageHandler) {
			window.removeEventListener('message', messageHandler);
			messageHandler = null;
		}
	}

	function showVideoPopup(videoId, videoTitle, isShorts = false) {
		if (!videoId) return;
		hideVideoPopup();

		const popup = document.createElement('div');
		popup.id = 'ytaq-popup';

		const content = document.createElement('div');
		content.className = 'ytaq-popup-content';
		if (isShorts) content.classList.add('ytaq-popup-shorts');

		const closeBtn = document.createElement('button');
		closeBtn.className = 'ytaq-popup-close';
		closeBtn.textContent = '×';
		closeBtn.addEventListener('click', hideVideoPopup);

		const title = document.createElement('div');
		title.className = 'ytaq-popup-title';
		title.textContent = videoTitle || '';

		const openLink = document.createElement('a');
		openLink.className = 'ytaq-popup-open-original';
		openLink.textContent = 'YouTubeで開く';
		openLink.href = `https://www.youtube.com/watch?v=${videoId}`;
		openLink.target = '_blank';
		openLink.rel = 'noopener';
		title.appendChild(openLink);

		const rateBox = document.createElement('div');
		rateBox.className = 'ytaq-popup-rate';
		title.appendChild(rateBox);

		const iframeContainer = document.createElement('div');
		iframeContainer.className = 'ytaq-popup-iframe-container';
		if (isShorts) iframeContainer.classList.add('ytaq-popup-shorts');

		const skeleton = document.createElement('div');
		skeleton.className = 'ytaq-popup-loading-skeleton';

		const thumb = document.createElement('img');
		thumb.className = 'ytaq-popup-thumbnail';
		thumb.src = thumbnailUrl(videoId);
		thumb.alt = '';

		const spinner = document.createElement('div');
		spinner.className = 'ytaq-popup-spinner';
		skeleton.append(thumb, spinner);

		const iframe = document.createElement('iframe');
		iframe.className = 'ytaq-popup-iframe';
		iframe.src = embedUrl(videoId);
		iframe.allow = 'fullscreen';
		iframe.allowFullscreen = true;
		iframe.setAttribute('frameborder', '0');

		let skeletonGone = false;
		function dropSkeleton() {
			if (skeletonGone) return;
			skeletonGone = true;
			skeleton.classList.add('fade-out');
			skeleton.addEventListener('transitionend', () => skeleton.remove(), { once: true });
			setTimeout(() => skeleton.remove(), 600);
		}

		let failed = false;

		function showEmbedError(code) {
			if (failed) return;
			failed = true;
			skeleton.remove();
			iframe.src = 'about:blank';

			const box = document.createElement('div');
			box.className = 'ytaq-popup-error';

			const msg = document.createElement('p');
			msg.textContent = `埋め込み再生に失敗しました（コード: ${code}）`;
			box.appendChild(msg);

			const btn = document.createElement('button');
			btn.className = 'ytaq-popup-error-btn';
			btn.textContent = '新しいタブで開く';
			btn.addEventListener('click', () => {
				window.open(watchUrl(videoId), '_blank', 'noopener');
				hideVideoPopup();
			});
			box.appendChild(btn);

			iframeContainer.appendChild(box);
		}

		let rateSettings = YTaqSettings.defaults('playbackrate');
		let channel = null;
		let currentRate = 1;
		let appliedStoredRate = false;
		let suppressSaveUntil = 0;

		const rateDisplay = document.createElement('button');
		rateDisplay.className = 'ytaq-popup-rate-display';
		rateDisplay.textContent = '1.00x';
		rateDisplay.title = '再生速度（クリックでプリセット循環）';

		const rateMinus = document.createElement('button');
		rateMinus.className = 'ytaq-popup-rate-btn';
		rateMinus.textContent = '−';

		const ratePlus = document.createElement('button');
		ratePlus.className = 'ytaq-popup-rate-btn';
		ratePlus.textContent = '＋';

		rateBox.append(rateMinus, rateDisplay, ratePlus);

		function renderRate() {
			rateDisplay.textContent = currentRate.toFixed(2) + 'x';
		}

		function changeRate(next) {
			const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, next));
			const direct = applyRate(iframe, rate);
			currentRate = rate;
			renderRate();
			if (channel) YTaqRateSave(channel, rate);
			suppressSaveUntil = performance.now() + 1500;
			if (!direct) YTaq.log('popup: API 経由のため 2.0 に丸められる可能性あり');
		}

		function YTaqRateSave(ch, rate) {
			if (window.YTaqRate) window.YTaqRate.setStoredRate(ch, rate);
		}

		rateMinus.addEventListener('click', () => changeRate(currentRate - rateSettings.speedStep));
		ratePlus.addEventListener('click', () => changeRate(currentRate + rateSettings.speedStep));
		rateDisplay.addEventListener('click', () => {
			const presets = rateSettings.speedPresets;
			const i = presets.findIndex(s => Math.abs(s - currentRate) < 0.01);
			changeRate(presets[(i + 1) % presets.length]);
		});

		YTaqSettings.get('playbackrate').then(v => {
			rateSettings = v;
			rateMinus.title = `再生速度を下げる（-${rateSettings.speedStep}）`;
			ratePlus.title = `再生速度を上げる（+${rateSettings.speedStep}）`;
		});

		async function applyStoredRateOnce() {
			if (appliedStoredRate || !channel || !window.YTaqRate) return;
			appliedStoredRate = true;
			const stored = await window.YTaqRate.getStoredRate(channel);
			if (!stored || Math.abs(stored - currentRate) < 0.01) return;
			suppressSaveUntil = performance.now() + 1500;
			applyRate(iframe, stored);
			currentRate = stored;
			renderRate();
			YTaq.log('popup: rate applied', channel, stored);
		}

		function onReportedRate(rate) {
			if (!(rate > 0) || Math.abs(rate - currentRate) < 0.01) return;
			currentRate = rate;
			renderRate();
			if (performance.now() < suppressSaveUntil) return;
			if (channel) YTaqRateSave(channel, rate);
		}

		messageHandler = e => {
			if (e.source !== iframe.contentWindow) return;
			let data = e.data;
			if (typeof data === 'string') {
				try { data = JSON.parse(data); } catch (_) { return; }
			}
			if (!data) return;

			if (data.event === 'onError') return showEmbedError(Number(data.info));

			if (data.event === 'onPlaybackRateChange') return onReportedRate(Number(data.info));

			if (data.event === 'infoDelivery' && data.info) {
				const author = data.info.videoData && data.info.videoData.author;
				if (author && author !== channel) {
					channel = author;
					applyStoredRateOnce();
				}
				if (typeof data.info.playbackRate === 'number') onReportedRate(data.info.playbackRate);
				if (typeof data.info.currentTime === 'number') lastTime = data.info.currentTime;
			}
		};
		window.addEventListener('message', messageHandler);

		const HISTORY_MIN_SECONDS = 5;
		let lastTime = 0;
		let historySession = null;
		let historyTimer = null;

		function playedSeconds() {
			const v = embeddedVideo(iframe);
			if (v && v.currentTime > 0) return v.currentTime;
			return lastTime;
		}

		function reportHistory(final) {
			if (historySession) historySession.report(playedSeconds(), final);
		}

		function tickHistory() {
			if (historySession) return reportHistory(false);
			if (failed || playedSeconds() < HISTORY_MIN_SECONDS) return;
			if (!window.YTaqHistory || !window.YTaqHistory.enabled) return;

			historySession = window.YTaqHistory.begin(videoId);
			reportHistory(false);
			clearInterval(historyTimer);
			historyTimer = setInterval(() => reportHistory(false), 30000);
		}

		historyStop = () => {
			clearInterval(historyTimer);
			historyTimer = null;
			reportHistory(true);
			historySession = null;
		};

		iframe.addEventListener('load', () => {
			setTimeout(dropSkeleton, 150);
			if (failed) return;

			historyTimer = setInterval(tickHistory, 5000);

			const v = embeddedVideo(iframe);
			if (v) {
				v.addEventListener('ratechange', () => onReportedRate(v.playbackRate));
			}

			try {
				iframe.contentWindow.postMessage(
					JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
					embedHost()
				);
			} catch (err) {
				YTaq.warn('popup: listening handshake failed:', err);
			}
		});
		setTimeout(dropSkeleton, 5000);

		iframeContainer.append(iframe, skeleton);
		content.append(closeBtn, title, iframeContainer);
		popup.appendChild(content);

		popup.addEventListener('click', e => {
			if (e.target === popup) hideVideoPopup();
		});

		escHandler = e => {
			if (e.key === 'Escape') hideVideoPopup();
		};
		document.addEventListener('keydown', escHandler);

		document.body.appendChild(popup);
	}

	window.YTaqPopup = { showVideoPopup, hideVideoPopup };
})();
