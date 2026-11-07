(function () {
	'use strict';

	const YTaq = window.YTaq;
	const CLASS = 'ytaq-watch-wide';
	const POLL_MS = 700;
	const MAX_CLICKS = 3;
	const MAX_POLLS = 30;

	let wide = YTaqSettings.defaults('watchWide');
	let loaded = false;

	function flexy() {
		return document.querySelector('ytd-watch-flexy');
	}

	function setTheater(on) {
		const page = flexy();
		if (!page || page.hasAttribute('theater') === on) return;
		const button = document.querySelector('.ytp-size-button');
		if (button) button.click();
	}

	function refit() {
		window.dispatchEvent(new Event('resize'));
	}

	for (const name of ['thumb_up', 'thumb_up_fill', 'thumb_down', 'thumb_down_fill', 'share', 'playlist_add', 'more_horiz']) {
		document.documentElement.style.setProperty('--watch-icon-' + name, YTaqIcons.url(name));
	}

	const PIP_CLASS = 'ytaq-watch-pip';
	const DESC_CLASS = 'ytaq-watch-desc-open';
	const DESC_GAP = 4;
	const PIP_VISIBLE_RATIO = 0.5;
	const HOLD_CLASS = 'ytaq-watch-hold';
	const HOLD_MS = 15000;
	const HOLD_SETTLE_MS = 1000;
	let hold = null;
	const pipObserver = new IntersectionObserver(entries => {
		if (hold) return;
		const on = entries[entries.length - 1].intersectionRatio < PIP_VISIBLE_RATIO;
		document.documentElement.classList.toggle(PIP_CLASS, on);
		document.documentElement.classList.remove(DESC_CLASS);
		refit();
	}, { rootMargin: '-56px 0px 0px 0px', threshold: [PIP_VISIBLE_RATIO] });

	const observer = new ResizeObserver(measure);
	const observed = new Set();

	const descButton = document.createElement('button');
	descButton.type = 'button';
	descButton.className = 'ytaq-watch-desc-btn';
	descButton.title = '概要';
	descButton.setAttribute('aria-label', '概要');
	descButton.append(YTaqIcons.create('notes'));
	descButton.addEventListener('click', () => {
		const open = document.documentElement.classList.toggle(DESC_CLASS);
		if (!open) return;
		placeDesc();
		expandDesc();
	});

	function expandDesc() {
		const expander = document.querySelector('ytd-watch-metadata #description-inline-expander');
		if (expander && !expander.hasAttribute('is-expanded')) expander.querySelector('#expand')?.click();
	}

	function placeDesc() {
		if (!document.documentElement.classList.contains(DESC_CLASS)) return;
		const row = document.querySelector('ytd-watch-metadata #bottom-row');
		if (!row) return;
		const button = descButton.getBoundingClientRect();
		const parent = row.offsetParent;
		const box = parent ? parent.getBoundingClientRect() : null;
		const right = box ? box.right - parent.clientLeft : document.documentElement.clientWidth;
		const bottom = box ? box.bottom - parent.clientTop : document.documentElement.clientHeight;
		const style = document.documentElement.style;
		style.setProperty('--watch-desc-right', (right - button.right) + 'px');
		style.setProperty('--watch-desc-bottom', (bottom - button.top + DESC_GAP) + 'px');
		style.setProperty('--watch-desc-room', (button.right - DESC_GAP) + 'px');
	}

	const chatButton = document.createElement('button');
	chatButton.type = 'button';
	chatButton.className = 'ytaq-watch-chat-btn';
	chatButton.title = 'チャットのリプレイ';
	chatButton.setAttribute('aria-label', 'チャットのリプレイ');
	chatButton.append(YTaqIcons.create('chat'));
	chatButton.addEventListener('click', () => {
		replayRun++;
		showReplayChat();
		const page = flexy();
		const selector = page && page.hasAttribute('fixed-panels') ? '#chat #show-hide-button button' : 'ytd-watch-metadata #teaser-carousel button';
		document.querySelector(selector)?.click();
	});

	function placeDescButton() {
		const actions = document.querySelector('ytd-watch-metadata #actions');
		if (actions && descButton.parentElement !== actions) actions.prepend(descButton, chatButton);
	}

	document.addEventListener('pointerdown', e => {
		if (!document.documentElement.classList.contains(DESC_CLASS) || !e.target.closest) return;
		if (e.target.closest('.ytaq-watch-desc-btn, ytd-watch-metadata #bottom-row')) return;
		document.documentElement.classList.remove(DESC_CLASS);
	}, true);

	function measure() {
		placeDesc();
		const classes = document.documentElement.classList;
		if (classes.contains(PIP_CLASS) && classes.contains('ytaq-watch-desc-below') && !classes.contains('ytaq-watch-related')) expandDesc();
		const player = document.querySelector('#full-bleed-container');
		const primary = document.querySelector('ytd-watch-flexy #primary');
		const title = document.querySelector('ytd-watch-metadata #title-row');
		const row = document.querySelector('ytd-watch-metadata #top-row');
		if (!player || !primary || !title || !row) return;
		const flexyEl = flexy();
		if (flexyEl && !observed.has(flexyEl)) {
			observed.add(flexyEl);
			new MutationObserver(measure).observe(flexyEl, { attributes: true, attributeFilter: ['fixed-panels', 'panel-expanded', 'live-chat-present-and-expanded'] });
		}
		if (!observed.has(pipObserver)) {
			observed.add(pipObserver);
			pipObserver.observe(player);
		}
		for (const el of [player, primary, title, row]) {
			if (!observed.has(el)) {
				observed.add(el);
				observer.observe(el);
			}
		}
		const root = document.documentElement.style;
		root.setProperty('--watch-card-width', player.getBoundingClientRect().width + 'px');
		root.setProperty('--watch-title-height', title.getBoundingClientRect().height + 'px');
		root.setProperty('--watch-row-height', row.getBoundingClientRect().height + 'px');
		placeDescButton();
		if (!document.documentElement.classList.contains(PIP_CLASS)) {
			root.setProperty('--watch-card-height', title.getBoundingClientRect().height + row.getBoundingClientRect().height + 'px');
		}
		const primaryStyle = getComputedStyle(primary);
		root.setProperty('--watch-primary-width', primary.clientWidth - parseFloat(primaryStyle.paddingLeft) - parseFloat(primaryStyle.paddingRight) + 'px');
		const secondary = document.querySelector('ytd-watch-flexy #secondary');
		if (secondary) {
			const r = secondary.getBoundingClientRect();
			root.setProperty('--watch-pip-left', r.left + 'px');
			root.setProperty('--watch-pip-width', r.width + 'px');
			if (!observed.has(secondary)) {
				observed.add(secondary);
				observer.observe(secondary);
			}
		}
		const chat = flexyEl && flexyEl.hasAttribute('fixed-panels') && !document.documentElement.classList.contains('ytaq-replay-hide') && document.querySelector('ytd-watch-flexy #chat');
		root.setProperty('--watch-panel-width', chat ? chat.getBoundingClientRect().width + 'px' : '0px');
	}

	let run = 0;

	function apply() {
		const current = ++run;
		let clicks = 0;
		let polls = 0;
		const step = () => {
			if (current !== run || !wide || !location.pathname.startsWith('/watch')) return;
			const page = flexy();
			if (page && page.hasAttribute('theater')) {
				refit();
				measure();
				if (!document.querySelector('ytd-watch-metadata #top-row') && ++polls < MAX_POLLS) setTimeout(step, POLL_MS);
				return;
			}
			const button = document.querySelector('.ytp-size-button');
			if (page && button && clicks < MAX_CLICKS) {
				clicks++;
				button.click();
			}
			if (clicks < MAX_CLICKS && ++polls < MAX_POLLS) setTimeout(step, POLL_MS);
		};
		step();
	}

	YTaqSettings.watch('watchWide', v => {
		const turnedOff = loaded && wide && !v;
		loaded = true;
		wide = !!v;
		document.documentElement.classList.toggle(CLASS, wide);
		if (wide) document.cookie = 'wide=1; domain=.youtube.com; path=/; max-age=31536000; secure';
		if (turnedOff) setTheater(false);
		apply();
	});

	YTaqSettings.watch('watchSide', v => {
		document.documentElement.classList.toggle('ytaq-watch-side', !!v);
		refit();
	});

	YTaqSettings.watch('watchCloseReplay', v => {
		closeReplay = !!v;
		if (closeReplay) closeReplayChat();
		else {
			replayRun++;
			showReplayChat();
		}
	});

	YTaqSettings.watch('watchDescBelow', v => {
		document.documentElement.classList.toggle('ytaq-watch-desc-below', !!v);
		measure();
	});

	YTaqSettings.watch('watchRelated', v => {
		document.documentElement.classList.toggle('ytaq-watch-related', !!v);
	});

	YTaqSettings.watch('watchFitInfo', v => {
		document.documentElement.classList.toggle('ytaq-watch-fit', !!v);
		refit();
	});

	function parseTime(text) {
		const m = text && text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
		if (!m || !text) return null;
		return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
	}

	document.addEventListener('click', e => {
		if (!document.documentElement.classList.contains(PIP_CLASS) || !document.documentElement.classList.contains('ytaq-watch-side')) return;
		if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
		const page = flexy();
		if (!page || !page.matches('[theater][is-two-columns_]:not([fixed-panels]):not([fullscreen])')) return;
		const a = e.target.closest && e.target.closest('ytd-comments a[href], ytd-watch-metadata a[href]');
		if (!a) return;
		const url = new URL(a.href);
		if (url.searchParams.get('v') !== new URLSearchParams(location.search).get('v')) return;
		const time = parseTime(url.searchParams.get('t'));
		const video = document.querySelector('video');
		if (time === null || !video) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		video.currentTime = time;
	}, true);

	let closeReplay = false;
	let replayRun = 0;

	const REPLAY_POLL_MS = 50;
	const REPLAY_MAX_POLLS = 400;
	const REPLAY_RECLICK_POLLS = 20;
	const REPLAY_HIDE_CLASS = 'ytaq-replay-hide';

	function showReplayChat() {
		if (!document.documentElement.classList.contains(REPLAY_HIDE_CLASS)) return;
		document.documentElement.classList.remove(REPLAY_HIDE_CLASS);
		measure();
	}

	function replayFromPlayer() {
		try {
			const player = document.querySelector('#movie_player');
			const response = player && player.wrappedJSObject && player.wrappedJSObject.getPlayerResponse();
			const details = response && response.videoDetails;
			if (!details || details.videoId !== new URLSearchParams(location.search).get('v')) return null;
			return !!details.isLiveContent && !details.isLive;
		} catch {
			return null;
		}
	}

	function chatIsReplay() {
		try {
			return document.querySelector('#chat iframe#chatframe').contentWindow.location.pathname === '/live_chat_replay';
		} catch {
			return false;
		}
	}

	function closeReplayChat() {
		const current = ++replayRun;
		showReplayChat();
		let polls = 0;
		let replay = null;
		let clickedAt = -1;
		const step = () => {
			if (current !== replayRun || !closeReplay || !location.pathname.startsWith('/watch')) return;
			if (replay === null) replay = replayFromPlayer();
			if (replay === false) return showReplayChat();
			if (replay) document.documentElement.classList.add(REPLAY_HIDE_CLASS);
			const page = flexy();
			const open = page && page.hasAttribute('fixed-panels');
			if (clickedAt >= 0 && !open) return showReplayChat();
			if (open && (replay || chatIsReplay()) && (clickedAt < 0 || polls - clickedAt >= REPLAY_RECLICK_POLLS)) {
				const button = document.querySelector('#chat #show-hide-button button');
				if (button) {
					button.click();
					clickedAt = polls;
				}
			}
			if (++polls < REPLAY_MAX_POLLS) setTimeout(step, REPLAY_POLL_MS);
			else showReplayChat();
		};
		step();
	}

	function playlistId() {
		return new URLSearchParams(location.search).get('list');
	}

	function endHold() {
		if (!hold) return;
		hold = null;
		document.documentElement.classList.remove(HOLD_CLASS);
		const player = document.querySelector('#full-bleed-container');
		if (player) {
			pipObserver.unobserve(player);
			pipObserver.observe(player);
		}
	}

	function keepPosition(current) {
		if (hold !== current) return;
		if (performance.now() > current.until) return endHold();
		window.scrollTo({ top: current.top, behavior: 'instant' });
		requestAnimationFrame(() => keepPosition(current));
	}

	window.addEventListener('yt-navigate-start', () => {
		const page = flexy();
		if (hold || !page || !page.hasAttribute('show-playlist')) return;
		if (!document.documentElement.classList.contains(PIP_CLASS)) return;
		hold = { top: window.scrollY, list: playlistId(), until: performance.now() + HOLD_MS };
		document.documentElement.style.setProperty('--watch-hold-height', document.documentElement.scrollHeight + 'px');
		document.documentElement.classList.add(HOLD_CLASS);
		keepPosition(hold);
	}, true);

	window.addEventListener('yt-navigate-finish', () => {
		if (!hold) return;
		if (location.pathname.startsWith('/watch') && playlistId() === hold.list) {
			hold.until = performance.now() + HOLD_SETTLE_MS;
			return;
		}
		endHold();
		window.scrollTo({ top: 0, behavior: 'instant' });
	}, true);

	for (const type of ['wheel', 'touchstart', 'keydown']) {
		window.addEventListener(type, endHold, { capture: true, passive: true });
	}

	YTaq.ready(apply);
	YTaq.onNavigate(() => {
		document.documentElement.classList.remove(DESC_CLASS);
		apply();
		closeReplayChat();
	});
})();
