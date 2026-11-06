(function () {
	'use strict';

	function apply(t) {
		document.documentElement.setAttribute('data-suisou-theme', t.theme + ' ' + t.accent);
	}

	const DARK = 0x400;
	const LIGHT = 0x80000;
	const RELOADED = 'ytaq-dark-reload';

	function forceDark() {
		const m = /(?:^|;\s*)PREF=([^;]*)/.exec(document.cookie);
		const pref = m ? m[1] : '';
		const f6m = /(?:^|&)f6=([0-9a-fA-F]+)/.exec(pref);
		const f6 = f6m ? parseInt(f6m[1], 16) : 0;
		const next = (f6 | DARK) & ~LIGHT;
		if (next === f6) return;
		const hex = next.toString(16);
		const value = f6m ? pref.replace(/(^|&)f6=[0-9a-fA-F]+/, '$1f6=' + hex) : (pref ? pref + '&' : '') + 'f6=' + hex;
		document.cookie = 'PREF=' + value + '; domain=.youtube.com; path=/; max-age=63072000; secure';
		try {
			if (sessionStorage.getItem(RELOADED)) return;
			sessionStorage.setItem(RELOADED, '1');
		} catch {
			return;
		}
		location.reload();
	}

	forceDark();
	apply(YTaqSettings.defaults('theme'));
	YTaqSettings.watch('theme', apply);

	function grid(on) {
		document.documentElement.classList.toggle('ytaq-search-grid', !!on);
	}

	grid(YTaqSettings.defaults('searchGrid'));
	YTaqSettings.watch('searchGrid', grid);
})();
