// YTFrozen: リスト内動画のポップアップ表示機能
// iframe埋め込みでオーバーレイ表示

(function() {
  // ポップアップを表示
  function showVideoPopup(videoId, videoTitle) {
    if (!videoId) return;

    console.log('[YTFrozen Popup] Opening video:', videoId);

    // 既存のポップアップがあれば削除
    const existingPopup = document.getElementById('ytfrozen-subs-popup');
    if (existingPopup) existingPopup.remove();

    // オーバーレイ作成
    const popup = document.createElement('div');
    popup.id = 'ytfrozen-subs-popup';

    // コンテンツコンテナ
    const content = document.createElement('div');
    content.className = 'ytfrozen-subs-popup-content';

    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ytfrozen-subs-popup-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', hideVideoPopup);

    // タイトル
    const title = document.createElement('div');
    title.className = 'ytfrozen-subs-popup-title';
    title.textContent = videoTitle || '動画を読み込み中...';

    // iframeコンテナ
    const iframeContainer = document.createElement('div');
    iframeContainer.className = 'ytfrozen-subs-popup-iframe-container';

    // iframe作成: 通常のYouTubeページを直接表示
    // embed APIではなく、watch?v= の通常ページを使用することで
    // すべての制限を回避し、YouTube本来の機能をフルに使える
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/watch?v=${videoId}&autoplay=1`;
    iframe.allowFullscreen = true;

    console.log('[YTFrozen Popup] Loading YouTube page:', iframe.src);

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
    const popup = document.getElementById('ytfrozen-subs-popup');
    if (popup) {
      popup.remove();
      console.log('[YTFrozen Popup] Popup closed');
    }
  }

  // グローバル公開
  window.YTFrozenSubsPopup = {
    showVideoPopup,
    hideVideoPopup
  };
})();
