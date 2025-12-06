// YTFrozen: 汎用動画ポップアップ表示機能
// フルページiframe + 代替サムネイルローディング

(function () {
  const ANTIBITE_STORAGE_KEY = 'ytfrozen_antibite';
  const DEFAULT_ANTIBITE = {
    thumbnailEnabled: true,
    thumbnailFrame: 'hq1'
  };

  // 設定をキャッシュ
  let thumbnailSettings = DEFAULT_ANTIBITE;

  // 設定を読み込み
  function loadThumbnailSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([ANTIBITE_STORAGE_KEY], (result) => {
        thumbnailSettings = result[ANTIBITE_STORAGE_KEY] || DEFAULT_ANTIBITE;
        console.log('[YTFrozen Popup] Thumbnail settings loaded:', thumbnailSettings);
      });
    }
  }

  // 初回読み込み
  loadThumbnailSettings();

  // 設定変更を監視
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[ANTIBITE_STORAGE_KEY]) {
        thumbnailSettings = changes[ANTIBITE_STORAGE_KEY].newValue || DEFAULT_ANTIBITE;
        console.log('[YTFrozen Popup] Thumbnail settings updated:', thumbnailSettings);
      }
    });
  }

  // サムネイルURLを取得
  function getThumbnailUrl(videoId) {
    const frame = thumbnailSettings.thumbnailFrame || 'hq1';
    return `https://i.ytimg.com/vi/${videoId}/${frame}.jpg`;
  }

  // ポップアップを表示
  function showVideoPopup(videoId, videoTitle, isShorts = false) {
    if (!videoId) {
      console.error('[YTFrozen Popup] No videoId provided!');
      return;
    }

    console.log('[YTFrozen Popup] Opening video popup:', videoId, 'Title:', videoTitle, 'isShorts:', isShorts);

    // 既存のポップアップがあれば削除
    const existingPopup = document.getElementById('ytfrozen-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // オーバーレイ作成
    const popup = document.createElement('div');
    popup.id = 'ytfrozen-popup';

    // コンテンツコンテナ
    const content = document.createElement('div');
    content.className = 'ytfrozen-popup-content';
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
    if (isShorts) {
      iframeContainer.classList.add('ytfrozen-popup-shorts');
    }

    // ローディングスケルトン（サムネイル + スピナー）
    const loadingSkeleton = document.createElement('div');
    loadingSkeleton.className = 'ytfrozen-popup-loading-skeleton';

    // 代替サムネイル画像
    const thumbnailImg = document.createElement('img');
    thumbnailImg.className = 'ytfrozen-popup-thumbnail';
    thumbnailImg.src = getThumbnailUrl(videoId);
    thumbnailImg.alt = videoTitle || 'Loading...';

    // ローディングスピナー
    const spinner = document.createElement('div');
    spinner.className = 'ytfrozen-popup-spinner';

    loadingSkeleton.appendChild(thumbnailImg);
    loadingSkeleton.appendChild(spinner);

    // iframe作成: YouTube全体ページを読み込む（シアターモード）
    const iframe = document.createElement('iframe');
    iframe.className = 'ytfrozen-popup-iframe';

    // URLパラメータでシアターモード＆自動再生
    const params = new URLSearchParams({
      v: videoId,
      autoplay: '1',
      theater: '1'
    });

    iframe.src = `https://www.youtube.com/watch?${params}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.setAttribute('frameborder', '0');

    console.log('[YTFrozen Popup] Loading YouTube (Theater Mode):', iframe.src);

    // 描画完了後の処理（スケルトンフェードアウト）
    let hasShownIframe = false;
    function showIframe() {
      if (hasShownIframe) return;
      hasShownIframe = true;

      console.log('[YTFrozen Popup] Fading out skeleton...');
      loadingSkeleton.classList.add('fade-out');

      // フェードアウト完了後にスケルトン削除
      setTimeout(() => {
        if (loadingSkeleton.parentNode) {
          loadingSkeleton.remove();
          console.log('[YTFrozen Popup] Skeleton removed');
        }
      }, 500);
    }

    // iframeを即座にDOMに追加してロード開始（スケルトンの裏で読み込ませる）
    console.log('[YTFrozen Popup] Adding iframe to DOM immediately...');
    iframeContainer.appendChild(iframe); // ここが重要：iframeは最初からDOMにいる

    // loadイベント監視
    iframe.addEventListener('load', () => {
      console.log('[YTFrozen Popup] iframe load event fired');
      setTimeout(showIframe, 600); // 描画安定待ち
    });

    // タイムアウト保険（10秒）
    setTimeout(() => {
      console.log('[YTFrozen Popup] Timeout: forcing skeleton fade out');
      showIframe();
    }, 10000);

    // 要素を組み立て
    iframeContainer.appendChild(loadingSkeleton); // iframeの上に重ねる
    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(iframeContainer);
    popup.appendChild(content);

    // イベントリスナー
    popup.addEventListener('click', (e) => {
      if (e.target === popup) hideVideoPopup();
    });

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        hideVideoPopup();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    document.body.appendChild(popup);
    console.log('[YTFrozen Popup] Popup displayed with loading skeleton');
  }

  // ポップアップを非表示
  function hideVideoPopup() {
    const popup = document.getElementById('ytfrozen-popup');
    if (popup) {
      popup.remove();
      console.log('[YTFrozen Popup] Popup closed');
    }
  }

  // グローバル公開
  window.YTFrozenPopup = {
    showVideoPopup,
    hideVideoPopup
  };
})();

// ========================================
// iframe内のページマーキング処理
// ========================================

(function () {
  // iframe内（モーダル内）かどうかを判定
  function isInsideIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  // iframe内であることを示すクラスを<html>に追加
  // CSSの html.ytfrozen-popup-iframe セレクタで使用
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
})();
