(function () {
	'use strict';

	const YTaq = window.YTaq;

	const SPEED_ICON = 'M12 1c1.44 0 2.87.28 4.21.83';

	function hideNativeSpeedMenu(root) {
		const scope = root && root.querySelectorAll ? root : document;
		const items = scope.querySelectorAll('.ytp-menuitem:not(.ytaq-hide-playback-rate)');
		for (let i = 0; i < items.length; i++) {
			const path = items[i].querySelector('.ytp-menuitem-icon path');
			if (path && (path.getAttribute('d') || '').startsWith(SPEED_ICON)) {
				items[i].classList.add('ytaq-hide-playback-rate');
			}
		}
	}

	function video() {
		return document.querySelector('video');
	}

	async function addSpeedControls() {
		const rightControls = document.querySelector('.ytp-right-controls');
		if (!rightControls) return;
		if (document.querySelector('.ytaq-rate-controls')) return;

		const settings = await YTaqSettings.get('playbackrate');
		const { speedStep, speedPresets } = settings;

		if (document.querySelector('.ytaq-rate-controls')) return;

		const container = document.createElement('div');
		container.className = 'ytaq-rate-controls';

		const display = document.createElement('button');
		display.className = 'ytaq-rate-display ytp-button';
		display.title = '再生速度';

		function updateDisplay() {
			const v = video();
			if (v) display.textContent = v.playbackRate.toFixed(2) + 'x';
		}

		function setRate(fn) {
			const v = video();
			if (!v) return;
			v.playbackRate = fn(v.playbackRate);
			updateDisplay();
		}

		display.addEventListener('click', () => setRate(current => {
			const i = speedPresets.findIndex(s => Math.abs(s - current) < 0.01);
			return speedPresets[(i + 1) % speedPresets.length];
		}));

		const minus = document.createElement('button');
		minus.className = 'ytaq-rate-minus ytp-button';
		minus.textContent = '−';
		minus.title = `再生速度を下げる（-${speedStep}）`;
		minus.addEventListener('click', () => setRate(c => Math.max(0.25, c - speedStep)));

		const plus = document.createElement('button');
		plus.className = 'ytaq-rate-plus ytp-button';
		plus.textContent = '＋';
		plus.title = `再生速度を上げる（+${speedStep}）`;
		plus.addEventListener('click', () => setRate(c => Math.min(16.0, c + speedStep)));

		container.append(minus, display, plus);

		const anchor = document.getElementById('startSegmentButton');
		if (anchor && anchor.parentElement === rightControls) {
			rightControls.insertBefore(container, anchor.nextSibling);
		} else {
			rightControls.insertBefore(container, rightControls.firstChild);
		}

		const v = video();
		if (v) {
			v.addEventListener('ratechange', updateDisplay);
			updateDisplay();
		} else {
			display.textContent = '1.00x';
		}
	}

	function setup() {
		if (!location.pathname.startsWith('/watch')) return;
		YTaq.waitFor('.ytp-right-controls', addSpeedControls);
	}

	YTaq.ready(() => {
		setup();
		hideNativeSpeedMenu(document);

		YTaq.onNavigate(setup);

		YTaq.onMutation(added => {
			for (let i = 0; i < added.length; i++) {
				const n = added[i];
				if (!n.querySelector) continue;
				if ((n.matches && n.matches('.ytp-menuitem, .ytp-panel, .ytp-popup')) ||
					n.querySelector('.ytp-menuitem')) {
					hideNativeSpeedMenu(n.parentElement || document);
					return;
				}
			}
		});
	});
})();
