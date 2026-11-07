(function () {
	'use strict';

	const NOTE_ICON = 'M5.5 1.383V6.88';
	const CARDS = 'ytd-rich-item-renderer, yt-lockup-view-model, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer';
	const hints = new Map();
	let enabled = YTaqSettings.defaults('musicNormalRate');
	YTaqSettings.watch('musicNormalRate', v => { enabled = !!v; });

	function videoIdOf(link) {
		const m = /[?&]v=([\w-]{11})/.exec(link.getAttribute('href') || '');
		return m ? m[1] : null;
	}

	function hasNote(card) {
		return [...card.querySelectorAll('yt-thumbnail-badge-view-model path')].some(p => (p.getAttribute('d') || '').startsWith(NOTE_ICON));
	}

	function remember(e) {
		const card = e.target.closest && e.target.closest(CARDS);
		if (!card) return;
		const link = card.querySelector('a[href*="/watch?v="]');
		const id = link && videoIdOf(link);
		if (id) hints.set(id, hasNote(card));
	}

	window.addEventListener('click', remember, true);

	function isMusic(videoId, category) {
		if (!enabled) return false;
		if (hints.has(videoId)) return hints.get(videoId);
		return category === 'Music';
	}

	window.YTaqMusic = { isMusic };
})();
