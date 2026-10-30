(function () {
	'use strict';

	if (window.__ytaqThemeLoaded) return;
	window.__ytaqThemeLoaded = true;

	const KEY = 'ytaq_theme';
	const DEFAULT = globalThis.YTaqDefaults.theme;

	function apply(value) {
		const t = Object.assign({}, DEFAULT, value || {});
		document.documentElement.setAttribute('data-suisou-theme', t.theme + ' ' + t.accent);
	}

	apply(null);

	chrome.storage.local.get([KEY], result => apply(result[KEY]));

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area === 'local' && changes[KEY]) apply(changes[KEY].newValue);
	});
})();
