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
	const PIP_VISIBLE_RATIO = 0.5;
	const pipObserver = new IntersectionObserver(entries => {
		const on = entries[entries.length - 1].intersectionRatio < PIP_VISIBLE_RATIO;
		document.documentElement.classList.toggle(PIP_CLASS, on);
		refit();
	}, { rootMargin: '-56px 0px 0px 0px', threshold: [PIP_VISIBLE_RATIO] });

	const observer = new ResizeObserver(measure);
	const observed = new Set();

	function measure() {
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
		const chat = flexyEl && flexyEl.hasAttribute('fixed-panels') && document.querySelector('ytd-watch-flexy #chat');
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

	YTaq.ready(apply);
	YTaq.onNavigate(apply);
})();
