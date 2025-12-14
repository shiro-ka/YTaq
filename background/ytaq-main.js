// 拡張機能のバックグラウンドスクリプト
console.log('YTaq background script running');

// Manifest V2ではbrowser_actionを使用
if (chrome.browserAction) {
	chrome.browserAction.onClicked.addListener(() => {
		chrome.runtime.openOptionsPage();
	});
} else if (chrome.action) {
	// Manifest V3用（念のため）
	chrome.action.onClicked.addListener(() => {
		chrome.runtime.openOptionsPage();
	});
}

// YouTubeの埋め込み制限を回避: X-Frame-OptionsヘッダーとCSPのframe-ancestorsを削除
console.log('[YTaq] Registering webRequest listener...');

browser.webRequest.onHeadersReceived.addListener(
	(details) => {
		// YouTubeの埋め込みURLのみ処理
		if (!details.url.includes('youtube.com/embed/') && !details.url.includes('youtube-nocookie.com/embed/')) {
			return;
		}

		console.log('[YTaq] webRequest triggered for:', details.url);
		console.log('[YTaq] Request type:', details.type);

		let modified = false;
		const headers = details.responseHeaders;

		// X-Frame-Options ヘッダーを削除
		let newHeaders = headers.filter(header => {
			const name = header.name.toLowerCase();
			if (name === 'x-frame-options' || name === 'frame-options') {
				console.log('[YTaq] Removing header:', header.name, '=', header.value);
				modified = true;
				return false;
			}
			return true;
		});

		// Content-Security-Policy の frame-ancestors を削除/変更
		newHeaders = newHeaders.map(header => {
			const name = header.name.toLowerCase();
			if (name === 'content-security-policy' || name === 'content-security-policy-report-only') {
				const original = header.value;
				// frame-ancestors ディレクティブを削除
				header.value = header.value.replace(/frame-ancestors[^;]*(;|$)/gi, '');
				if (original !== header.value) {
					console.log('[YTaq] Modified CSP:', name);
					console.log('  Original:', original);
					console.log('  Modified:', header.value);
					modified = true;
				}
			}
			return header;
		});

		if (modified) {
			console.log('[YTaq] Headers modified successfully');
		} else {
			console.log('[YTaq] No headers needed modification');
		}

		return { responseHeaders: newHeaders };
	},
	{
		urls: ['<all_urls>']
	},
	['blocking', 'responseHeaders']
);

console.log('[YTaq] webRequest listener registered successfully');
