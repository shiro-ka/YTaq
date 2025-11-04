// YTFrozen: ポップアップ内のYouTubeページを改変して余計なUIを削除

(function() {
  // ポップアップ内のiframeかどうか判定
  function isInPopupIframe() {
    try {
      // iframe内かつ、親ウィンドウに ytfrozen-subs-popup が存在するか確認
      if (window.self !== window.top) {
        // 親ウィンドウのDOMにアクセスできないが、URLで判定
        return document.referrer.includes('youtube.com');
      }
    } catch (e) {
      // クロスオリジンエラーは無視
    }
    return false;
  }

  // YouTubeページの余計なUI要素を非表示にする
  function cleanYouTubeUI() {
    // スタイルが既に注入されていたらスキップ
    if (document.getElementById('ytfrozen-popup-cleaner')) {
      return;
    }

    // 動画プレイヤー以外の要素を非表示にするCSSを注入
    const style = document.createElement('style');
    style.id = 'ytfrozen-popup-cleaner';
    style.textContent = `
      /* ヘッダーを非表示 */
      #masthead-container,
      ytd-masthead,
      #masthead {
        display: none !important;
      }

      /* サイドバー（関連動画）を非表示 */
      #secondary,
      #related,
      ytd-watch-next-secondary-results-renderer {
        display: none !important;
      }

      /* コメント欄を非表示 */
      #comments,
      ytd-comments,
      ytd-item-section-renderer#comments {
        display: none !important;
      }

      /* 動画説明欄を非表示 */
      #description,
      ytd-watch-metadata,
      ytd-video-secondary-info-renderer {
        display: none !important;
      }

      /* チャンネル情報を非表示 */
      #owner,
      ytd-video-owner-renderer {
        display: none !important;
      }

      /* メインコンテンツ部分を最大化 */
      #primary,
      ytd-watch-flexy {
        max-width: 100% !important;
        margin: 0 !important;
      }

      /* プレイヤーを最大化 */
      #player,
      #movie_player,
      .html5-video-player {
        width: 100% !important;
        height: 100vh !important;
      }

      /* 背景を黒に */
      body,
      ytd-app {
        background: #000 !important;
        overflow: hidden !important;
      }

      /* ページ全体のパディング・マージンを削除 */
      ytd-page-manager {
        margin-top: 0 !important;
      }

      #page-manager {
        margin-top: 0 !important;
      }

      /* 読み込み中の画面もクリーンに */
      ytd-app {
        background: #000 !important;
      }

      /* スケルトンスクリーン（読み込み中のプレースホルダー）も非表示 */
      ytd-skeleton,
      .skeleton-bg-color {
        display: none !important;
      }
    `;

    // 可能な限り早く注入（headがなければbodyに）
    if (document.head) {
      document.head.appendChild(style);
    } else if (document.documentElement) {
      document.documentElement.appendChild(style);
    }

    console.log('[YTFrozen Popup Cleaner] YouTube UI cleaned');
  }

  // YouTubeページが完全に読み込まれるまで待機
  function waitAndClean() {
    // 即座に実行（可能な限り早く）
    cleanYouTubeUI();

    // DOMが準備できたらクリーニング実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cleanYouTubeUI);
    }

    // 遅延読み込みされる要素にも対応（回数を減らして最適化）
    setTimeout(cleanYouTubeUI, 100);
    setTimeout(cleanYouTubeUI, 500);
  }

  // 実行
  if (window.location.href.includes('youtube.com/watch')) {
    // ポップアップ用かどうかを判定
    // URLにカスタムパラメータを追加して判定
    const url = new URL(window.location.href);
    if (url.searchParams.get('ytfrozen_popup') === '1') {
      console.log('[YTFrozen Popup Cleaner] Detected popup iframe, cleaning UI...');
      waitAndClean();
    }
  }
})();
