function switchSection(sectionName) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  const targetSection = document.getElementById(`section-${sectionName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  const targetNav = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
  if (targetNav) {
    targetNav.classList.add('active');
  }

  console.log(`[YTaq] セクション切り替え: ${sectionName}`);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionName = item.getAttribute('data-section');
      switchSection(sectionName);
    });
  });

  if (window.YTaqTheme) {
    window.YTaqTheme.init();
  }

  if (window.YTaqPerf) {
    window.YTaqPerf.init();
  }

  if (window.YTaqAntibite) {
    window.YTaqAntibite.init();
  }

  if (window.YTaqPlaybackrate) {
    window.YTaqPlaybackrate.init();
  }

  console.log('[YTaq] 設定画面を初期化しました');
});
