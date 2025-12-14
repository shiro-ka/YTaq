// YTaq: 保存された色設定をページに適用

(function() {
  const STORAGE_KEY = 'ytaq_colors';

  // デフォルトの色設定（ytaq-variables.cssと同じ）
  const DEFAULT_COLORS = {
    bg: '#4c566a',
    sd: '#434c5e',
    fg: '#3b4252',
    ub: '#2e3440',
    bd: 'rgba(255,255,255,0.2)'
  };

  // 色設定を適用
  function applyColors(colors) {
    // CSS変数を動的に設定
    const root = document.documentElement;
    root.style.setProperty('--ytaq-bg', colors.bg);
    root.style.setProperty('--ytaq-sd', colors.sd);
    root.style.setProperty('--ytaq-fg', colors.fg);
    root.style.setProperty('--ytaq-ub', colors.ub);
    root.style.setProperty('--ytaq-bd', colors.bd);

    console.log('[YTaq] 色設定を適用しました:', colors);
  }

  // 保存された設定を読み込んで適用
  function loadAndApplyColors() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const colors = result[STORAGE_KEY] || DEFAULT_COLORS;
      applyColors(colors);
    });
  }

  // ページ読み込み時に適用
  loadAndApplyColors();

  // 設定変更時にも適用（他のタブで設定を変更した場合）
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      const newColors = changes[STORAGE_KEY].newValue || DEFAULT_COLORS;
      applyColors(newColors);
    }
  });
})();
