// YTFrozen Player: 軽量な埋め込みプレイヤー
// player.html から読み込まれ、動画を表示する

// URLパラメータから動画情報を取得
const params = new URLSearchParams(window.location.search);
const videoId = params.get('v');
const isShorts = params.get('shorts') === 'true';

console.log('[YTFrozen Player] Loading video:', videoId, 'isShorts:', isShorts);

if (videoId) {
  // YouTube埋め込みプレイヤーを作成
  const iframe = document.createElement('iframe');

  // Shortsの場合は通常の/watch URLを使用（/embed/はShortsに対応していない）
  if (isShorts) {
    // Shorts用: 通常のwatch URLを使用（UI最小化パラメータ付き）
    const watchParams = new URLSearchParams({
      v: videoId,
      autoplay: 1,
      modestbranding: 1
    });
    iframe.src = `https://www.youtube.com/watch?${watchParams.toString()}`;
  } else {
    // 通常動画: 埋め込みプレイヤーを使用
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1`;
  }

  // iframe属性設定
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  iframe.setAttribute('allowfullscreen', '');

  // bodyに追加
  document.body.appendChild(iframe);

  console.log('[YTFrozen Player] Player loaded successfully');
} else {
  console.error('[YTFrozen Player] No video ID provided');
  document.body.innerHTML = '<div style="color: white; padding: 20px; text-align: center;">動画IDが指定されていません</div>';
}