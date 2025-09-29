// 拡張機能のバックグラウンドスクリプト
console.log('YTFrozen background script running');

chrome.action.onClicked.addListener(() => {
	chrome.runtime.openOptionsPage();
});
