// YTFrozen: リスト内動画のポップアップ表示機能
// content.jsとytfrozen-iframe-api.jsを参考にした動画ポップアップ

(function() {
  let popupContainer = null;
  let currentIframe = null;
  
  // ポップアップを表示
  function showVideoPopup(videoId, videoTitle) {
    if (!videoId) return;
    
    // 既存のポップアップがあれば削除
    hideVideoPopup();
    
    // ポップアップコンテナを作成
    popupContainer = document.createElement('div');
    popupContainer.id = 'ytfrozen-subs-popup';
    
    // ポップアップ内容
    const popupContent = document.createElement('div');
    popupContent.className = 'ytfrozen-subs-popup-content';
    
    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.className = 'ytfrozen-subs-popup-close';
    closeButton.addEventListener('click', hideVideoPopup);
    
    // タイトル
    const titleElement = document.createElement('div');
    titleElement.textContent = videoTitle || '動画';
    titleElement.className = 'ytfrozen-subs-popup-title';
    
    // iframeコンテナ
    const iframeContainer = document.createElement('div');
    iframeContainer.className = 'ytfrozen-subs-popup-iframe-container';
    
    // iframe作成
    currentIframe = document.createElement('iframe');
    currentIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    // スタイルはCSSクラスで統一
    currentIframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    currentIframe.allowFullscreen = true;
    
    // 要素を組み立て
    iframeContainer.appendChild(currentIframe);
    popupContent.appendChild(closeButton);
    popupContent.appendChild(titleElement);
    popupContent.appendChild(iframeContainer);
    popupContainer.appendChild(popupContent);
    
    // DOMに追加
    document.body.appendChild(popupContainer);
    
    // ESCキーで閉じる
    document.addEventListener('keydown', handleKeydown);
    
    // 背景クリックで閉じる
    popupContainer.addEventListener('click', (e) => {
      if (e.target === popupContainer) {
        hideVideoPopup();
      }
    });
  }
  
  // ポップアップを非表示
  function hideVideoPopup() {
    if (popupContainer) {
      document.removeEventListener('keydown', handleKeydown);
      popupContainer.remove();
      popupContainer = null;
      currentIframe = null;
    }
  }
  
  // キーボードイベント処理
  function handleKeydown(e) {
    if (e.key === 'Escape') {
      hideVideoPopup();
    }
  }
  
  // グローバル公開
  window.YTFrozenSubsPopup = {
    showVideoPopup,
    hideVideoPopup
  };
})();