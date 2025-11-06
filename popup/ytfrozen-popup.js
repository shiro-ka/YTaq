// YTFrozen: 汎用動画ポップアップ表示機能
// iframe埋め込みでオーバーレイ表示

(function() {
  // ポップアップを表示
  function showVideoPopup(videoId, videoTitle, isShorts = false) {
    if (!videoId) {
      console.error('[YTFrozen Popup] No videoId provided!');
      return;
    }

    console.log('[YTFrozen Popup] Opening video:', videoId, 'Title:', videoTitle, 'isShorts:', isShorts);

    // 既存のポップアップがあれば削除
    const existingPopup = document.getElementById('ytfrozen-popup');
    if (existingPopup) existingPopup.remove();

    // オーバーレイ作成
    const popup = document.createElement('div');
    popup.id = 'ytfrozen-popup';

    // コンテンツコンテナ
    const content = document.createElement('div');
    content.className = 'ytfrozen-popup-content';

    // Shortsの場合は縦長クラスを追加
    if (isShorts) {
      content.classList.add('ytfrozen-popup-shorts');
    }

    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ytfrozen-popup-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', hideVideoPopup);

    // タイトル
    const title = document.createElement('div');
    title.className = 'ytfrozen-popup-title';
    title.textContent = videoTitle || '動画を読み込み中...';

    // iframeコンテナ
    const iframeContainer = document.createElement('div');
    iframeContainer.className = 'ytfrozen-popup-iframe-container';

    // Shortsの場合は縦長クラスを追加
    if (isShorts) {
      iframeContainer.classList.add('ytfrozen-popup-shorts');
    }

    // iframe作成: YouTube全体ページを読み込む（UI最小化）
    // 注意: 埋め込みプレイヤーは拡張機能からのアクセスをYouTubeが完全にブロックしているため、
    // 通常のYouTubeページを使用しつつ、パラメータで余計なUIを非表示にする
    const iframe = document.createElement('iframe');

    // URLパラメータで余計なUIを最小化
    const params = new URLSearchParams({
      v: videoId,
      autoplay: '1',
      // 以下のパラメータでUI要素を制御
      modestbranding: '1',  // YouTubeロゴを最小化
      rel: '0',             // 関連動画を減らす
      fs: '1',              // フルスクリーンボタンを表示
      iv_load_policy: '3',  // アノテーションを非表示
      // カスタムパラメータ: Content Scriptで検出用
      ytfrozen_popup: '1',  // ポップアップ用のフラグ
    });

    iframe.src = `https://www.youtube.com/watch?${params}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.setAttribute('frameborder', '0');

    console.log('[YTFrozen Popup] Loading YouTube page (minimal UI):', iframe.src);

    // 要素を組み立て
    iframeContainer.appendChild(iframe);
    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(iframeContainer);
    popup.appendChild(content);

    // オーバーレイクリックで閉じる
    popup.addEventListener('click', (e) => {
      if (e.target === popup) hideVideoPopup();
    });

    // ESCキーで閉じる
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        hideVideoPopup();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // DOMに追加
    document.body.appendChild(popup);

    console.log('[YTFrozen Popup] Popup displayed with iframe');
  }

  // ポップアップを非表示
  function hideVideoPopup() {
    const popup = document.getElementById('ytfrozen-popup');
    if (popup) {
      popup.remove();
      console.log('[YTFrozen Popup] Popup closed');
    }
  }

  // グローバル公開（汎用的な名前に変更）
  window.YTFrozenPopup = {
    showVideoPopup,
    hideVideoPopup
  };
})();
