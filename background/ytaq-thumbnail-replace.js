// YouTubeサムネイルを代替フレームにリダイレクト
console.log('[YTaq] Initializing thumbnail replacement...');

const ANTIBITE_STORAGE_KEY = 'ytaq_antibite';

// デフォルト設定
const DEFAULT_ANTIBITE = {
  thumbnailEnabled: true,
  thumbnailFrame: 'hq1'
};

// 現在の設定を保持
let currentSettings = DEFAULT_ANTIBITE;

// 設定を読み込み
function loadSettings() {
  chrome.storage.local.get([ANTIBITE_STORAGE_KEY], (result) => {
    currentSettings = result[ANTIBITE_STORAGE_KEY] || DEFAULT_ANTIBITE;
    console.log('[YTaq Thumbnail] Settings loaded:', currentSettings);
  });
}

// 初回読み込み
loadSettings();

// 設定変更を監視
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[ANTIBITE_STORAGE_KEY]) {
    currentSettings = changes[ANTIBITE_STORAGE_KEY].newValue || DEFAULT_ANTIBITE;
    console.log('[YTaq Thumbnail] Settings updated:', currentSettings);
  }
});

// webRequestリスナーを登録
browser.webRequest.onBeforeRequest.addListener(
	(details) => {
		// 機能が無効の場合は何もしない
		if (!currentSettings.thumbnailEnabled) {
			return;
		}

		// YouTubeサムネイルURLをパターンマッチ
		// 例: https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg
		//     https://i9.ytimg.com/vi_webp/VIDEO_ID/sddefault.webp
		const match = details.url.match(/^https:\/\/i9?\.ytimg\.com\/(vi|vi_webp)\/([\w-]+)\/(default|hqdefault|mqdefault|sddefault|maxresdefault|hq720)(_custom_\d+)?\.(jpg|webp)/);

		if (match) {
			const videoId = match[2];
			const extension = match[5]; // jpg or webp
			const frame = currentSettings.thumbnailFrame || 'hq1';

			// 指定されたフレームにリダイレクト
			const redirectUrl = `https://i.ytimg.com/vi/${videoId}/${frame}.${extension}`;

			console.log('[YTaq Thumbnail] Redirecting:', details.url, '→', redirectUrl);

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

console.log('[YTaq] Thumbnail redirect listener registered successfully');
