(function () {
	'use strict';

	if (window.__ytaqThemeLoaded) return;
	window.__ytaqThemeLoaded = true;

	function apply(t) {
		document.documentElement.setAttribute('data-suisou-theme', t.theme + ' ' + t.accent);
	}

	apply(YTaqSettings.defaults('theme'));
	YTaqSettings.watch('theme', apply);
})();
