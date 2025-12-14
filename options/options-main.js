// YTaq 設定画面 - メインスクリプト
// ナビゲーションと各モジュールの初期化のみを担当

// セクション切り替え
function switchSection(sectionName) {
  // すべてのセクションを非表示
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });

  // すべてのナビゲーションアイテムの active を解除
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // 指定されたセクションを表示
  const targetSection = document.getElementById(`section-${sectionName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // クリックされたナビゲーションアイテムに active を追加
  const targetNav = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
  if (targetNav) {
    targetNav.classList.add('active');
  }

  console.log(`[YTaq] セクション切り替え: ${sectionName}`);
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  // ナビゲーションイベント
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionName = item.getAttribute('data-section');
      switchSection(sectionName);
    });
  });

  // 各モジュールの初期化
  if (window.YTaqTheme) {
    window.YTaqTheme.init();
  }

  if (window.YTaqAntibite) {
    window.YTaqAntibite.init();
  }

  if (window.YTaqPlaybackrate) {
    window.YTaqPlaybackrate.init();
  }

  console.log('[YTaq] 設定画面を初期化しました');
});
