// YTFrozen: 汎用動画ポップアップ表示機能
// iframe埋め込みでオーバーレイ表示

(function() {
  // iframe内（モーダル内）かどうかを判定
  function isInsideIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  // iframe内であることを示すクラスを<html>に追加
  // 本体CSSの:not(.ytfrozen-popup-iframe)セレクタで除外するため
  function markAsPopupIframe() {
    if (isInsideIframe() && window.location.href.includes('youtube.com/watch')) {
      if (document.documentElement) {
        document.documentElement.classList.add('ytfrozen-popup-iframe');
        console.log('[YTFrozen Popup] Marked as popup iframe');
      }
    }
  }

  // ページ読み込み時にマーキング実行
  markAsPopupIframe();

  // ポップアップを表示（iframe内の場合は通常のページ遷移）
  function showVideoPopup(videoId, videoTitle, isShorts = false) {
    if (!videoId) {
      console.error('[YTFrozen Popup] No videoId provided!');
      return;
    }

    // iframe内（モーダル内）の場合は通常のページ遷移
    if (isInsideIframe()) {
      console.log('[YTFrozen Popup] Inside iframe, navigating to:', videoId);
      const params = new URLSearchParams({
        v: videoId,
        autoplay: '1',
        theater: '1'
      });
      window.location.href = `https://www.youtube.com/watch?${params}`;
      return;
    }

    console.log('[YTFrozen Popup] Opening video popup:', videoId, 'Title:', videoTitle, 'isShorts:', isShorts);

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

    // iframe作成: YouTube全体ページを読み込む（シアターモード＆CSS無効化で軽量化）
    const iframe = document.createElement('iframe');

    // URLパラメータでシアターモード＆自動再生
    const params = new URLSearchParams({
      v: videoId,
      autoplay: '1',
      // シアターモード強制
      theater: '1'
    });

    iframe.src = `https://www.youtube.com/watch?${params}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.setAttribute('frameborder', '0');

    console.log('[YTFrozen Popup] Loading YouTube (Theater Mode):', iframe.src);

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
