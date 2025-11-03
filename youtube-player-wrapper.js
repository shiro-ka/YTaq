// YTFrozen: YouTube埋め込みプレイヤーのラッパースクリプト

// URLの#の後ろから動画IDを取得
// 例: wrapper.html#wqLp5Y61ohI → videoId = "wqLp5Y61ohI"
const videoId = location.hash.slice(1); // #を除去
const iframe = document.getElementById('player');

console.log('[YTFrozen Wrapper] Video ID:', videoId);
console.log('[YTFrozen Wrapper] Origin:', location.origin);

if (videoId) {
  // YouTube埋め込みURLのパラメータ
  // 注意: originパラメータは削除（moz-extension://はYouTubeが受け付けない）
  const params = new URLSearchParams({
    autoplay: '1',           // 自動再生
    playsinline: '1',        // インライン再生
    enablejsapi: '1'         // JavaScript API有効化
  });

  // iframeのsrcを設定
  // youtube-nocookie.comを使用してプライバシー強化モードで埋め込み
  // これによりCookie制限が緩和される可能性がある
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';

  // sandboxを設定してより柔軟な実行環境を提供
  iframe.sandbox = 'allow-scripts allow-same-origin allow-presentation allow-forms';

  console.log('[YTFrozen Wrapper] Loading video:', iframe.src);
} else {
  console.error('[YTFrozen Wrapper] No video ID provided!');
}

// --- postMessageの転送処理 ---
// YouTubeからのメッセージを親ウィンドウに転送
window.addEventListener('message', (e) => {
  // YouTubeからのメッセージのみ転送
  if (e.origin === 'https://www.youtube.com' && window.parent !== window) {
    window.parent.postMessage(e.data, '*');
  }
});

// 親ウィンドウからのメッセージをYouTubeに転送
window.addEventListener('message', (e) => {
  // 親からのメッセージをYouTubeのiframeに転送
  if (e.source === window.parent && iframe.contentWindow) {
    iframe.contentWindow.postMessage(e.data, 'https://www.youtube.com');
  }
});

console.log('[YTFrozen Wrapper] Ready');
