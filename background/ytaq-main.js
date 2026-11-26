chrome.browserAction.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.storage.local.get(['ytaq_shorts_hide', 'ytaq_perf'], r => {
	const perf = r.ytaq_perf;
	if (r.ytaq_shorts_hide || !perf || !('hideShorts' in perf || 'hideHomeShorts' in perf)) return;
	const all = !!perf.hideShorts;
	const places = YTaqSettings.defaults('shortsHide');
	for (const k in places) places[k] = all;
	places.home = all || perf.hideHomeShorts !== false;
	chrome.storage.local.set({ ytaq_shorts_hide: places });
});
