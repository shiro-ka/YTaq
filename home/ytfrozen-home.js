// YTFrozen: ホーム画面での動画クリック時にポップアップ表示

(function() {
  // 動画IDをURLから抽出
  function getVideoIdFromUrl(url) {
    const m = url.match(/[?&]v=([\w-]{11})/);
    return m ? m[1] : null;
  }

  // 動画クリック時の処理
  function onVideoClick(e) {
    // イベントをより強力にブロック
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // サムネイルやタイトルのaタグ
    const a = e.currentTarget;

    const videoId = getVideoIdFromUrl(a.href);
    if (!videoId) {
      console.warn('[YTFrozen Home] Could not extract video ID from:', a.href);
      return false;
    }

    // 動画タイトルを取得
    // title属性を優先（最もクリーンなタイトル）
    let videoTitle = a.getAttribute('title') || a.getAttribute('aria-label') || '';

    // title属性がない場合、#video-titleの中身を取得
    if (!videoTitle) {
      const titleEl = a.querySelector('#video-title') || a.closest('ytd-video-renderer')?.querySelector('#video-title');
      if (titleEl) {
        videoTitle = titleEl.getAttribute('title') || titleEl.textContent?.trim() || '';
      }
    }

    // それでもない場合は空文字列
    videoTitle = videoTitle || '';

    console.log('[YTFrozen Home] Video clicked:', videoId, videoTitle);

    // 汎用ポップアップを使用
    if (window.YTFrozenPopup) {
      window.YTFrozenPopup.showVideoPopup(videoId, videoTitle);
    } else {
      console.error('[YTFrozen Home] YTFrozenPopup not available');
      // フォールバック: 通常通り動画ページに遷移
      window.location.href = a.href;
    }

    return false;
  }

  // 動画リンクを監視してクリックイベントを追加
  function observeVideoLinks() {
    // ホーム画面の動画リンクセレクタ
    const selector = [
      'a#video-title',                          // タイトルリンク
      'a.ytd-thumbnail',                        // サムネイルリンク
      'a[href^="/watch?v="]',                   // 動画URLリンク全般
      'a.yt-lockup-view-model__content-image'  // 新UIのサムネイル
    ].join(',');

    document.querySelectorAll(selector).forEach(a => {
      // 既に処理済みかチェック
      if (!a.dataset.ytfrozenHome) {
        // キャプチャフェーズで最優先で実行（YouTubeのハンドラより先）
        // 第3引数にtrueを指定（オブジェクト形式だと古いブラウザで効かない可能性）
        a.addEventListener('click', onVideoClick, true);
        a.dataset.ytfrozenHome = '1';
      }
    });
  }

  // 初期化関数
  function initialize() {
    // 動的に追加される動画にも対応（MutationObserver）
    const observer = new MutationObserver(observeVideoLinks);
    observer.observe(document.body, { childList: true, subtree: true });

    // 初回実行
    observeVideoLinks();

    console.log('[YTFrozen Home] Video link observer initialized');
    console.log('[YTFrozen Home] YTFrozenPopup available?', !!window.YTFrozenPopup);
  }

  // document.bodyが存在するまで待機
  if (document.body) {
    initialize();
  } else {
    // DOMContentLoadedまたはloadイベントで初期化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      // 既に読み込み完了している場合
      initialize();
    }
  }
})();
