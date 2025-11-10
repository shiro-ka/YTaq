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
