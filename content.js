(function () {
	'use strict';

	const YTaq = window.YTaq;

	function iconType(entry) {
		const page = entry.wrappedJSObject || entry;
		const icon = page.data && page.data.icon;
		return (icon && icon.iconType) || '';
	}

	function markGuideEntries() {
		const entries = document.querySelectorAll('ytd-guide-entry-renderer');
		for (let i = 0; i < entries.length; i++) {
			entries[i].classList.toggle('ytaq-guide-shorts', iconType(entries[i]).startsWith('TAB_SHORTS'));
		}
	}

	YTaq.ready(() => {
		markGuideEntries();

		YTaq.onMutation(added => {
			for (let i = 0; i < added.length; i++) {
				const n = added[i];
				if (!n.querySelector && !n.matches) continue;
				if ((n.matches && n.matches('ytd-guide-entry-renderer, #items, tp-yt-app-drawer')) ||
					(n.querySelector && n.querySelector('ytd-guide-entry-renderer'))) {
					markGuideEntries();
					return;
				}
			}
		});
	});
})();
