// 拡張機能のバックグラウンドスクリプト
console.log('YTFrozen background script running');

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
console.log('[YTFrozen] Registering webRequest listener...');

browser.webRequest.onHeadersReceived.addListener(
	(details) => {
		// YouTubeの埋め込みURLのみ処理
		if (!details.url.includes('youtube.com/embed/') && !details.url.includes('youtube-nocookie.com/embed/')) {
			return;
		}

		console.log('[YTFrozen] webRequest triggered for:', details.url);
		console.log('[YTFrozen] Request type:', details.type);

		let modified = false;
		const headers = details.responseHeaders;

		// X-Frame-Options ヘッダーを削除
		let newHeaders = headers.filter(header => {
			const name = header.name.toLowerCase();
			if (name === 'x-frame-options' || name === 'frame-options') {
				console.log('[YTFrozen] Removing header:', header.name, '=', header.value);
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
					console.log('[YTFrozen] Modified CSP:', name);
					console.log('  Original:', original);
					console.log('  Modified:', header.value);
					modified = true;
				}
			}
			return header;
		});

		if (modified) {
			console.log('[YTFrozen] Headers modified successfully');
		} else {
			console.log('[YTFrozen] No headers needed modification');
		}

		return { responseHeaders: newHeaders };
	},
	{
		urls: ['<all_urls>']
	},
	['blocking', 'responseHeaders']
);

console.log('[YTFrozen] webRequest listener registered successfully');

// YouTubeサムネイルを先頭フレーム（hq1.jpg）にリダイレクト
console.log('[YTFrozen] Registering thumbnail redirect listener...');

browser.webRequest.onBeforeRequest.addListener(
	(details) => {
		// YouTubeサムネイルURLをパターンマッチ
		// 例: https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg
		//     https://i9.ytimg.com/vi_webp/VIDEO_ID/sddefault.webp
		const match = details.url.match(/^https:\/\/i9?\.ytimg\.com\/(vi|vi_webp)\/([\w-]+)\/(default|hqdefault|mqdefault|sddefault|maxresdefault|hq720)(_custom_\d+)?\.(jpg|webp)/);

		if (match) {
			const videoId = match[2];
			const extension = match[5]; // jpg or webp

			// hq1.jpg（先頭フレーム）にリダイレクト
			const redirectUrl = `https://i.ytimg.com/vi/${videoId}/hq1.${extension}`;

			console.log('[YTFrozen Thumbnail] Redirecting:', details.url, '→', redirectUrl);

			return { redirectUrl: redirectUrl };
		}
	},
	{
		urls: [
			"*://i.ytimg.com/*",
			"*://i9.ytimg.com/*"
		]
	},
	['blocking']
);

console.log('[YTFrozen] Thumbnail redirect listener registered successfully');
