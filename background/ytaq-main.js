if (chrome.browserAction) {
	chrome.browserAction.onClicked.addListener(() => chrome.runtime.openOptionsPage());
} else if (chrome.action) {
	chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
}
