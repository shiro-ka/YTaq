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

	YTaq.ready(apply);
	YTaq.onNavigate(apply);
})();
