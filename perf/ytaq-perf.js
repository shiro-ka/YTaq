(function () {
	'use strict';

	if (window.__ytaqPerfLoaded) return;
	window.__ytaqPerfLoaded = true;

	const CLASS_MAP = {
		hoverPreview: 'ytaq-no-hover-preview',
		lazyOffscreen: 'ytaq-lazy-offscreen',
		ambient: 'ytaq-no-ambient',
		animations: 'ytaq-no-anim',
		hideShorts: 'ytaq-no-shorts'
	};

	let settings = YTaqSettings.defaults('perf');

	function applyClasses() {
		const root = document.documentElement;
		if (!root) return;
		for (const key in CLASS_MAP) {
			root.classList.toggle(CLASS_MAP[key], !!settings[key]);
		}
	}

	const HOVER_TARGETS = 'ytd-thumbnail,yt-lockup-view-model';

	function blockHoverEvent(e) {
		if (!settings.hoverPreview) return;
		const t = e.target;
		if (!t || !t.closest) return;
		if (!t.closest(HOVER_TARGETS)) return;
		e.stopPropagation();
	}

	const PREVIEW_VIDEO = '#video-preview video, ytd-video-preview video, #inline-preview-player video';

	function killLivePreviews(root) {
		const scope = root && root.querySelectorAll ? root : document;
		const vids = scope.querySelectorAll(PREVIEW_VIDEO);
		for (let i = 0; i < vids.length; i++) {
			const v = vids[i];
			if (v.paused && !v.src) continue;
			try {
				v.pause();
				v.removeAttribute('src');
				v.load();
			} catch (e) {
				window.YTaq.warn('preview stop failed:', e);
			}
		}
	}

	function killAmbientCanvas(root) {
		if (!settings.ambient) return;
		const scope = root && root.querySelectorAll ? root : document;
		const canvases = scope.querySelectorAll('#cinematics canvas, yt-cinematic-container-view-model canvas');
		for (let i = 0; i < canvases.length; i++) canvases[i].remove();
	}

	function sweep(root) {
		if (settings.hoverPreview) killLivePreviews(root);
		killAmbientCanvas(root);
	}

	function start() {
		applyClasses();

		document.addEventListener('mouseover', blockHoverEvent, true);
		document.addEventListener('mouseenter', blockHoverEvent, true);

		window.YTaq.ready(() => {
			sweep(document);

			window.YTaq.onMutation(added => {
				for (let i = 0; i < added.length; i++) sweep(added[i]);
			});

			window.YTaq.onNavigate(() => sweep(document));
		});
	}

	applyClasses();

	YTaqSettings.get('perf').then(v => {
		settings = v;
		start();
	});

	YTaqSettings.onChange('perf', v => {
		settings = v;
		applyClasses();
		sweep(document);
	});
})();
