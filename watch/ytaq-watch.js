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

	const observer = new ResizeObserver(measure);
	const observed = new Set();

	function measure() {
		const player = document.querySelector('#full-bleed-container');
		const primary = document.querySelector('ytd-watch-flexy #primary');
		const title = document.querySelector('ytd-watch-metadata #title-row');
		const row = document.querySelector('ytd-watch-metadata #top-row');
		if (!player || !primary || !title || !row) return;
		for (const el of [player, primary, title, row]) {
			if (!observed.has(el)) {
				observed.add(el);
				observer.observe(el);
			}
		}
		const root = document.documentElement.style;
		root.setProperty('--watch-card-width', player.getBoundingClientRect().width + 'px');
		root.setProperty('--watch-card-height', title.getBoundingClientRect().height + row.getBoundingClientRect().height + 'px');
		root.setProperty('--watch-primary-width', primary.clientWidth - parseFloat(getComputedStyle(primary).paddingRight) + 'px');
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

	YTaqSettings.watch('watchFitInfo', v => {
		document.documentElement.classList.toggle('ytaq-watch-fit', !!v);
		refit();
	});

	YTaq.ready(apply);
	YTaq.onNavigate(apply);
})();
