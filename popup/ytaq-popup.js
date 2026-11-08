(function () {
	'use strict';

	const YTaq = window.YTaq;

	function thumbnailUrl(videoId) {
		return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
	}

	let useLoggedInEmbed = YTaqSettings.defaults('embedLogin');
	YTaqSettings.watch('embedLogin', v => { useLoggedInEmbed = !!v; });

	function embedHost() {
		return useLoggedInEmbed ? 'https://www.youtube.com' : 'https://www.youtube-nocookie.com';
	}

	function embedUrl(videoId, start) {
		const params = new URLSearchParams({
			autoplay: '1',
			playsinline: '1',
			rel: '0',
			enablejsapi: '1',
			origin: location.origin
		});
		if (start > 0) params.set('start', String(start));
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

	let closers = [];

	function hideVideoPopup() {
		for (const f of closers) f();
		closers = [];
		if (historyStop) {
			historyStop();
			historyStop = null;
		}
		const popup = document.getElementById('ytaq-popup');
		if (popup) popup.remove();
		if (escHandler) {
			document.removeEventListener('keydown', escHandler, true);
			escHandler = null;
		}
		if (messageHandler) {
			window.removeEventListener('message', messageHandler);
			messageHandler = null;
		}
	}

	function showVideoPopup(videoId, videoTitle, isShorts = false, start = 0) {
		if (!videoId) return;
		hideVideoPopup();

		const popup = document.createElement('div');
		popup.id = 'ytaq-popup';

		const content = document.createElement('div');
		content.className = 'ytaq-popup-content';
		if (isShorts) content.classList.add('ytaq-popup-shorts');

		const closeBtn = document.createElement('button');
		closeBtn.className = 'ytaq-popup-close';
		closeBtn.append(YTaqIcons.create('close'));
		closeBtn.title = '閉じる';
		closeBtn.setAttribute('aria-label', '閉じる');
		closeBtn.addEventListener('click', hideVideoPopup);

		const meta = document.createElement('div');
		meta.className = 'ytaq-popup-meta';

		const title = document.createElement('div');
		title.className = 'ytaq-popup-title';
		const titleText = document.createElement('span');
		titleText.className = 'ytaq-popup-title-text';
		titleText.textContent = videoTitle || '';
		title.appendChild(titleText);

		const head = document.createElement('div');
		head.className = 'ytaq-popup-head';
		head.append(title);

		const bar = document.createElement('div');
		bar.className = 'ytaq-popup-bar';

		const channelName = document.createElement('span');
		channelName.className = 'ytaq-popup-channel';

		const actions = document.createElement('div');
		actions.className = 'ytaq-popup-actions';

		const openLink = document.createElement('a');
		openLink.className = 'ytaq-popup-open-original';
		openLink.append(YTaqIcons.create('open_in_new'));
		openLink.title = 'YouTubeで開く';
		openLink.setAttribute('aria-label', 'YouTubeで開く');
		openLink.href = `https://www.youtube.com/watch?v=${videoId}`;
		openLink.target = '_blank';
		openLink.rel = 'noopener';
		const openAtNow = e => {
			if (e.type === 'auxclick' && e.button !== 1) return;
			const t = Math.floor(playedSeconds());
			openLink.href = `https://www.youtube.com/watch?v=${videoId}` + (t > 0 ? `&t=${t}s` : '');
			command(iframe, 'pauseVideo');
		};
		openLink.addEventListener('click', openAtNow);
		openLink.addEventListener('auxclick', openAtNow);

		const rateBox = document.createElement('div');
		rateBox.className = 'ytaq-popup-rate';

		const channelRow = document.createElement('div');
		channelRow.className = 'ytaq-popup-channel-row';
		channelRow.append(channelName);

		const tools = document.createElement('div');
		tools.className = 'ytaq-popup-tools';
		tools.append(openLink, closeBtn);

		let comments = null;
		if (!isShorts && window.YTaqPopupComments) {
			const commentBtn = document.createElement('button');
			commentBtn.className = 'ytaq-popup-comment-btn';
			commentBtn.append(YTaqIcons.create('chat'));
			commentBtn.title = 'コメント';
			commentBtn.setAttribute('aria-label', 'コメント');
			commentBtn.addEventListener('click', () => {
				if (!comments) {
					comments = window.YTaqPopupComments.create(videoId, {
						seek: seconds => {
							command(iframe, 'seekTo', [seconds, true]);
							command(iframe, 'playVideo');
						},
						onClose: f => closers.push(f)
					});
					content.append(comments.el);
				}
				const open = content.classList.toggle('ytaq-popup-with-comments');
				commentBtn.classList.toggle('ytaq-popup-comment-btn-on', open);
				if (open) comments.start();
			});
			tools.prepend(commentBtn);
		}

		actions.append(rateBox, tools);
		bar.append(channelRow, actions);
		meta.append(head, bar);
		if (window.YTaqPopupInfo) window.YTaqPopupInfo.build(videoId, { head, channelRow, shorts: isShorts, onClose: f => closers.push(f), onChannel: c => onChannel(c), onTitle: t => { if (!titleText.textContent) titleText.textContent = t; }, seek: seconds => { command(iframe, 'seekTo', [seconds, true]); command(iframe, 'playVideo'); } });

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
		iframe.src = embedUrl(videoId, start);
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
		let musicVideo = false;

		const rateDisplay = document.createElement('button');
		rateDisplay.className = 'ytaq-popup-rate-display';
		rateDisplay.textContent = '1.00x';
		rateDisplay.title = '再生速度（クリックでプリセット循環）';

		const rateMinus = document.createElement('button');
		rateMinus.className = 'ytaq-popup-rate-btn';
		rateMinus.append(YTaqIcons.create('remove'));
		rateMinus.title = '遅くする';
		rateMinus.setAttribute('aria-label', '遅くする');

		const ratePlus = document.createElement('button');
		ratePlus.className = 'ytaq-popup-rate-btn';
		ratePlus.append(YTaqIcons.create('add'));
		ratePlus.title = '速くする';
		ratePlus.setAttribute('aria-label', '速くする');

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
			if (musicVideo) return;
			window.YTaqChannels.setRate(ch.id, ch.name, rate);
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
			if (appliedStoredRate || !channel) return;
			appliedStoredRate = true;
			musicVideo = !!window.YTaqMusic && window.YTaqMusic.isMusic(videoId, channel.category);
			const stored = musicVideo ? 1 : await window.YTaqChannels.getRate(channel.id, channel.name);
			if (!stored || Math.abs(stored - currentRate) < 0.01) return;
			suppressSaveUntil = performance.now() + 1500;
			applyRate(iframe, stored);
			currentRate = stored;
			renderRate();
			YTaq.log('popup: rate applied', channel.name, stored);
		}

		function syncRate(v) {
			if (Math.abs(v.playbackRate - currentRate) < 0.01) return;
			suppressSaveUntil = performance.now() + 1500;
			v.playbackRate = currentRate;
		}

		function onReportedRate(rate) {
			if (!(rate > 0) || Math.abs(rate - currentRate) < 0.01) return;
			currentRate = rate;
			renderRate();
			if (performance.now() < suppressSaveUntil) return;
			if (channel) YTaqRateSave(channel, rate);
		}

		function onChannel(c) {
			channel = c;
			channelName.textContent = c.name;
			applyStoredRateOnce();
		}

		messageHandler = e => {
			if (e.source !== iframe.contentWindow) return;
			let data = e.data;
			if (typeof data === 'string') {
				try { data = JSON.parse(data); } catch (_) { return; }
			}
			if (!data) return;

			if (data.event === 'onError') return showEmbedError(Number(data.info));

			if (data.event === 'onPlaybackRateChange') return embeddedVideo(iframe) ? undefined : onReportedRate(Number(data.info));

			if (data.event === 'infoDelivery' && data.info) {
				const author = data.info.videoData && data.info.videoData.author;
				if (author && !channelName.textContent) channelName.textContent = author;
				if (typeof data.info.playbackRate === 'number' && !embeddedVideo(iframe)) onReportedRate(data.info.playbackRate);
				if (typeof data.info.currentTime === 'number') lastTime = data.info.currentTime;
				if (typeof data.info.playerState === 'number') lastState = data.info.playerState;
				if (typeof data.info.muted === 'boolean') lastMuted = data.info.muted;
			}
		};
		window.addEventListener('message', messageHandler);

		const HISTORY_MIN_SECONDS = 5;
		let lastTime = 0;
		let lastState = -1;
		let lastMuted = false;
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
				v.addEventListener('playing', () => syncRate(v));
				syncRate(v);
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
		content.append(iframeContainer, meta);
		popup.appendChild(content);

		popup.addEventListener('click', e => {
			if (e.target === popup) hideVideoPopup();
		});

		const PLAYING = 1;
		const SEEK_SECONDS = 5;

		function togglePlay() {
			const v = embeddedVideo(iframe);
			if (v) return v.paused ? v.play() : v.pause();
			command(iframe, lastState === PLAYING ? 'pauseVideo' : 'playVideo');
		}

		function seekBy(delta) {
			const v = embeddedVideo(iframe);
			if (v) {
				v.currentTime = Math.max(0, v.currentTime + delta);
				return;
			}
			command(iframe, 'seekTo', [Math.max(0, lastTime + delta), true]);
		}

		function toggleMute() {
			const v = embeddedVideo(iframe);
			if (v) {
				v.muted = !v.muted;
				return;
			}
			command(iframe, lastMuted ? 'unMute' : 'mute');
		}

		const KEYS = {
			k: togglePlay,
			ArrowLeft: () => seekBy(-SEEK_SECONDS),
			ArrowRight: () => seekBy(SEEK_SECONDS),
			'>': () => changeRate(currentRate + rateSettings.speedStep),
			'<': () => changeRate(currentRate - rateSettings.speedStep),
			m: toggleMute,
			f: () => {
				if (document.fullscreenElement) document.exitFullscreen();
				else iframe.requestFullscreen().catch(() => {});
			},
			c: () => {
				const b = content.querySelector('.ytaq-popup-comment-btn');
				if (b) b.click();
			}
		};

		escHandler = e => {
			if (e.key === 'Escape') return hideVideoPopup();
			if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
			const t = e.target;
			if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
			const fn = KEYS[e.key] || (e.key.length === 1 ? KEYS[e.key.toLowerCase()] : null);
			if (!fn) return;
			e.preventDefault();
			e.stopPropagation();
			fn();
		};
		document.addEventListener('keydown', escHandler, true);

		document.body.appendChild(popup);
	}

	window.YTaqPopup = { showVideoPopup, hideVideoPopup };
})();
