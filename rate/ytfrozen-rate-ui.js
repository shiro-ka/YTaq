// YTFrozen: 再生速度メニュー項目を非表示にするUI制御
// YouTubeネイティブの「再生速度」メニューを隠して、独自の再生速度管理を使用

// === YouTubeの再生速度メニュー項目を非表示にする ===
function hidePlaybackSpeedMenuItem() {
  const menuItems = document.querySelectorAll('.ytp-menuitem');
  menuItems.forEach(item => {
    const label = item.querySelector('.ytp-menuitem-label');
    if (label && label.textContent.trim() === '再生速度') {
      item.classList.add('ytfrozen-hide-playback-rate');
      console.log('[YTFrozen Rate UI] 再生速度メニュー項目を非表示にしました');
    }
  });
}

// 動画プレイヤーが読み込まれるまで待機してメニュー項目を非表示
function waitAndHideMenuItem() {
  hidePlaybackSpeedMenuItem();

  // MutationObserverでメニューの動的追加を監視
  const observer = new MutationObserver(() => {
    hidePlaybackSpeedMenuItem();
  });

  const playerElement = document.querySelector('.html5-video-player');
  if (playerElement) {
    observer.observe(playerElement, {
      childList: true,
      subtree: true
    });
  }
}

// 初回実行と定期チェック
setTimeout(waitAndHideMenuItem, 1000);
setInterval(hidePlaybackSpeedMenuItem, 2000);

// === 再生速度コントロールボタンを追加 ===
const PLAYBACKRATE_STORAGE_KEY = 'ytfrozen_playbackrate_settings';
const DEFAULT_PLAYBACKRATE = {
  speedStep: 0.25,
  speedPresets: [1.0, 1.25, 1.5, 1.75, 2.0, 4.0]
};

function addPlaybackSpeedControls() {
  const rightControls = document.querySelector('.ytp-right-controls');
  if (!rightControls) return;

  // 既に追加済みの場合はスキップ
  if (document.querySelector('.ytfrozen-rate-controls')) return;

  // 設定を読み込んでからボタンを作成
  chrome.storage.local.get([PLAYBACKRATE_STORAGE_KEY], (result) => {
    const settings = result[PLAYBACKRATE_STORAGE_KEY] || DEFAULT_PLAYBACKRATE;
    const speedStep = settings.speedStep;
    const speeds = settings.speedPresets;

    // ボタンコンテナ作成
    const container = document.createElement('div');
    container.className = 'ytfrozen-rate-controls';

    // 現在の速度表示
    const speedDisplay = document.createElement('button');
    speedDisplay.className = 'ytfrozen-rate-display ytp-button';
    speedDisplay.textContent = '1.0x';
    speedDisplay.title = '再生速度';

    // 速度を更新する関数
    function updateSpeedDisplay() {
      const video = document.querySelector('video');
      if (video) {
        speedDisplay.textContent = video.playbackRate.toFixed(2) + 'x';
      }
    }

    // クリックで速度変更（プリセット循環）
    speedDisplay.addEventListener('click', () => {
      const video = document.querySelector('video');
      if (!video) return;

      const currentSpeed = video.playbackRate;
      const currentIndex = speeds.findIndex(s => Math.abs(s - currentSpeed) < 0.01);
      const nextIndex = (currentIndex + 1) % speeds.length;

      video.playbackRate = speeds[nextIndex];
      updateSpeedDisplay();
    });

    // マイナスボタン
    const minusBtn = document.createElement('button');
    minusBtn.className = 'ytfrozen-rate-minus ytp-button';
    minusBtn.textContent = '−';
    minusBtn.title = `再生速度を下げる（-${speedStep}）`;
    minusBtn.addEventListener('click', () => {
      const video = document.querySelector('video');
      if (!video) return;

      const newSpeed = Math.max(0.25, video.playbackRate - speedStep);
      video.playbackRate = newSpeed;
      updateSpeedDisplay();
    });

    // プラスボタン
    const plusBtn = document.createElement('button');
    plusBtn.className = 'ytfrozen-rate-plus ytp-button';
    plusBtn.textContent = '＋';
    plusBtn.title = `再生速度を上げる（+${speedStep}）`;
    plusBtn.addEventListener('click', () => {
      const video = document.querySelector('video');
      if (!video) return;

      const newSpeed = Math.min(16.0, video.playbackRate + speedStep);
      video.playbackRate = newSpeed;
      updateSpeedDisplay();
    });

    // ボタンをコンテナに追加
    container.appendChild(minusBtn);
    container.appendChild(speedDisplay);
    container.appendChild(plusBtn);

    // #startSegmentButtonがあればその次に、なければ先頭に追加
    const startSegmentButton = document.getElementById('startSegmentButton');
    if (startSegmentButton && startSegmentButton.parentElement === rightControls) {
      // startSegmentButtonの次に挿入
      rightControls.insertBefore(container, startSegmentButton.nextSibling);
    } else {
      // 先頭に追加
      rightControls.insertBefore(container, rightControls.firstChild);
    }

    // video要素の速度変更を監視して表示を更新
    const video = document.querySelector('video');
    if (video) {
      video.addEventListener('ratechange', updateSpeedDisplay);
      updateSpeedDisplay();
    }

    console.log('[YTFrozen Rate UI] 再生速度コントロールボタンを追加しました');
  });
}

// ボタン追加の初回実行と定期チェック（SPA対応）
let lastVideoUrl = location.href;
function checkAndAddControls() {
  // URL変化を検知
  if (location.href !== lastVideoUrl) {
    lastVideoUrl = location.href;
  }

  // 動画ページでのみボタンを追加
  if (location.pathname.includes('/watch')) {
    addPlaybackSpeedControls();
  }
}

setTimeout(checkAndAddControls, 1000);
setInterval(checkAndAddControls, 2000);

// pushState/replaceStateフック（SPA対応）
const origPushState = history.pushState;
const origReplaceState = history.replaceState;

history.pushState = function() {
  origPushState.apply(this, arguments);
  setTimeout(checkAndAddControls, 500);
};

history.replaceState = function() {
  origReplaceState.apply(this, arguments);
  setTimeout(checkAndAddControls, 500);
};

window.addEventListener('popstate', () => {
  setTimeout(checkAndAddControls, 500);
});
