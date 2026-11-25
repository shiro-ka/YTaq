(function () {
	'use strict';

	const page = window.wrappedJSObject;
	if (!page) return;

	let settings = YTaqSettings.defaults('perf');

	function blocked(type) {
		if (settings.preferH264 && /vp0?[89]|av01/i.test(type)) return true;
		if (settings.avoid60fps) {
			const m = /framerate=(\d+)/.exec(type);
			if (m && Number(m[1]) > 30) return true;
		}
		return false;
	}

	for (const name of ['MediaSource', 'ManagedMediaSource']) {
		const target = page[name];
		if (!target || typeof target.isTypeSupported !== 'function') continue;
		const original = target.isTypeSupported;
		exportFunction(function (type) {
			const t = String(type);
			if (blocked(t)) return false;
			return original.call(target, type);
		}, target, { defineAs: 'isTypeSupported' });
	}

	YTaqSettings.watch('perf', v => { settings = v; });
})();
