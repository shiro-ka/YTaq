// YTaq: ホーム画面での動画クリック時にポップアップ表示

(function() {
  // 動画IDをURLから抽出（通常動画とShorts両対応）
  function getVideoIdFromUrl(url) {
    // パターン1: 通常動画 /watch?v=VIDEO_ID
    let m = url.match(/[?&]v=([\w-]{11})/);
    if (m) return m[1];

    // パターン2: Shorts /shorts/VIDEO_ID
    m = url.match(/\/shorts\/([\w-]{11})/);
    if (m) return m[1];

    // パターン3: 埋め込み /embed/VIDEO_ID
    m = url.match(/\/embed\/([\w-]{11})/);
    if (m) return m[1];

    return null;
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
      console.warn('[YTaq Home] Could not extract video ID from:', a.href);
      return false;
    }

    // 動画タイトルを取得
    // title属性を優先（最もクリーンなタイトル）
    let videoTitle = a.getAttribute('title') || a.getAttribute('aria-label') || '';

    // title属性がない場合、親要素や兄弟要素から#video-titleを探す
    if (!videoTitle) {
      // パターン1: 親要素から探す（ytd-video-renderer, ytd-rich-item-renderer など）
      const parentRenderers = [
        'ytd-video-renderer',
        'ytd-rich-item-renderer',
        'ytd-grid-video-renderer',
        'ytd-compact-video-renderer'
      ];

      let titleEl = null;

      // タイトル要素のセレクタ（複数パターン対応）
      const titleSelectors = [
        '#video-title',                              // 旧UI
        '.yt-lockup-metadata-view-model__title',     // 新UI
        'h3 a',                                       // 汎用
        'yt-formatted-string'                         // フォーマット済み文字列
      ];

      for (const rendererType of parentRenderers) {
        const parent = a.closest(rendererType);
        if (parent) {
          for (const selector of titleSelectors) {
            titleEl = parent.querySelector(selector);
            if (titleEl) break;
          }
          if (titleEl) break;
        }
      }

      // パターン2: 直接探す
      if (!titleEl) {
        for (const selector of titleSelectors) {
          titleEl = a.querySelector(selector) || document.querySelector(selector);
          if (titleEl) break;
        }
      }

      // タイトル要素が見つかった場合、title属性 > textContent の順で取得
      if (titleEl) {
        videoTitle = titleEl.getAttribute('title') ||
                     titleEl.getAttribute('aria-label') ||
                     titleEl.textContent?.trim() || '';
      }
    }

    // それでもない場合は空文字列
    videoTitle = videoTitle || '';

    console.log('[YTaq Home] Title extraction:', {
      'from a.title': a.getAttribute('title'),
      'from a.aria-label': a.getAttribute('aria-label'),
      'final': videoTitle
    });

    // タイトルが取得できなかった場合、デバッグ情報を出力
    if (!videoTitle) {
      console.warn('[YTaq Home] Failed to extract title. Debugging info:');
      console.log('- Clicked element:', a);
      console.log('- Element HTML:', a.outerHTML.substring(0, 200));
      console.log('- Parent ytd-video-renderer:', a.closest('ytd-video-renderer'));
      console.log('- Parent ytd-rich-item-renderer:', a.closest('ytd-rich-item-renderer'));

      // 親要素から #video-title を探して出力
      const parent = a.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer');
      if (parent) {
        const titleEl = parent.querySelector('#video-title, h3 a, yt-formatted-string');
        console.log('- Found title element in parent:', titleEl);
        if (titleEl) {
          console.log('  - title attr:', titleEl.getAttribute('title'));
          console.log('  - aria-label:', titleEl.getAttribute('aria-label'));
          console.log('  - textContent:', titleEl.textContent?.trim());
        }
      }
    }

    // デバッグ: 削除前のタイトル
    const originalTitle = videoTitle;

    // 動画の尺（「42 分」「1:23:45」など）を除去
    // パターン: 末尾の「数字 + 分/秒/時間」または「HH:MM:SS」形式
    videoTitle = videoTitle
      .replace(/\s+\d+\s*(分|秒|時間)$/g, '')           // 「42 分」「30 秒」などを削除
      .replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*$/g, '')  // 「1:23:45」「12:34」を削除
      .trim();

    // デバッグ: 削除処理で変化があった場合のみログ出力
    if (originalTitle !== videoTitle) {
      console.log('[YTaq Home] Title cleaned:', originalTitle, '→', videoTitle);
    }

    // タイトルが空になってしまった場合は元に戻す
    if (!videoTitle && originalTitle) {
      console.warn('[YTaq Home] Title became empty after cleaning, reverting:', originalTitle);
      videoTitle = originalTitle;
    }

    // Shortsかどうかを判定
    const isShorts = a.href.includes('/shorts/');

    console.log('[YTaq Home] Video clicked:', videoId, videoTitle, 'isShorts:', isShorts);

    // 汎用ポップアップを使用
    if (window.YTaqPopup) {
      window.YTaqPopup.showVideoPopup(videoId, videoTitle, isShorts);
    } else {
      console.error('[YTaq Home] YTaqPopup not available');
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
      if (!a.dataset.ytaqHome) {
        // キャプチャフェーズで最優先で実行（YouTubeのハンドラより先）
        // 第3引数にtrueを指定（オブジェクト形式だと古いブラウザで効かない可能性）
        a.addEventListener('click', onVideoClick, true);
        a.dataset.ytaqHome = '1';
      }
    });

    // 注: サムネイル差し替えはbackground.jsのwebRequestで自動的に行われます
  }

  // 初期化関数
  function initialize() {
    // 動的に追加される動画にも対応（MutationObserver）
    const observer = new MutationObserver(observeVideoLinks);
    observer.observe(document.body, { childList: true, subtree: true });

    // 初回実行
    observeVideoLinks();

    console.log('[YTaq Home] Video link observer initialized');
    console.log('[YTaq Home] YTaqPopup available?', !!window.YTaqPopup);
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
