// YTaq バックグラウンド
//
// かつてここには X-Frame-Options と CSP frame-ancestors を剥がす
// onHeadersReceived リスナーがあった（ポップアップの iframe に /watch を
// 読ませるため）。以下の理由で削除した:
//
//   1. ポップアップは /embed/ を使うようになった。embed は元々埋め込み可能な
//      ページなのでヘッダを触る必要がない。
//   2. 埋め込み制限(onError 101/150)はヘッダでは絶対に外せない。プレイヤーが
//      ロード後に自分で判定するサーバ側ポリシーなので層が違う。剥がしても無駄。
//      制限に当たった動画はトップレベルで /watch に遷移させる方針にした。
//   3. onHeadersReceived の blocking リスナーはマッチしたレスポンスを同期的に
//      止める。常駐させないに越したことはない。
//
// 結果、このファイルに残るのはツールバーボタンだけになった。

if (chrome.browserAction) {
	chrome.browserAction.onClicked.addListener(() => chrome.runtime.openOptionsPage());
} else if (chrome.action) {
	chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
}
