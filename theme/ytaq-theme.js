(function () {
	'use strict';

	function apply(t) {
		document.documentElement.setAttribute('data-suisou-theme', t.theme + ' ' + t.accent);
	}

	apply(YTaqSettings.defaults('theme'));
	YTaqSettings.watch('theme', apply);

	function grid(on) {
		document.documentElement.classList.toggle('ytaq-search-grid', !!on);
	}

	grid(YTaqSettings.defaults('searchGrid'));
	YTaqSettings.watch('searchGrid', grid);
})();
