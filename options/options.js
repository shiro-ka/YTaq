// YTFrozen 設定画面スクリプト

const STORAGE_KEY = 'ytfrozen_colors';

// デフォルトの色設定
const DEFAULT_COLORS = {
  bg: '#4c566a',
  sd: '#434c5e',
  fg: '#3b4252',
  ub: '#2e3440',
  bd: 'rgba(255,255,255,0.2)'
};

// カラーピッカーとテキスト入力を同期
function setupColorInputSync(colorId, textId) {
  const colorInput = document.getElementById(colorId);
  const textInput = document.getElementById(textId);

  // カラーピッカー変更時
  colorInput.addEventListener('input', () => {
    textInput.value = colorInput.value;
  });

  // テキスト入力変更時
  textInput.addEventListener('input', () => {
    const value = textInput.value.trim();
    // HEXカラーの場合のみカラーピッカーに反映
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      colorInput.value = value;
    }
  });
}

// 保存された設定を読み込み
function loadSettings() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const colors = result[STORAGE_KEY] || DEFAULT_COLORS;

    document.getElementById('color-bg').value = hexOnly(colors.bg);
    document.getElementById('text-bg').value = colors.bg;

    document.getElementById('color-sd').value = hexOnly(colors.sd);
    document.getElementById('text-sd').value = colors.sd;

    document.getElementById('color-fg').value = hexOnly(colors.fg);
    document.getElementById('text-fg').value = colors.fg;

    document.getElementById('color-ub').value = hexOnly(colors.ub);
    document.getElementById('text-ub').value = colors.ub;

    document.getElementById('color-bd').value = hexOnly(colors.bd);
    document.getElementById('text-bd').value = colors.bd;
  });
}

// HEX形式のみ抽出（カラーピッカー用）
function hexOnly(colorValue) {
  // rgba()などの場合はデフォルトの#ffffffを返す
  if (colorValue.startsWith('#')) {
    return colorValue;
  }
  return '#ffffff';
}

// 設定を保存
function saveSettings() {
  const colors = {
    bg: document.getElementById('text-bg').value.trim() || DEFAULT_COLORS.bg,
    sd: document.getElementById('text-sd').value.trim() || DEFAULT_COLORS.sd,
    fg: document.getElementById('text-fg').value.trim() || DEFAULT_COLORS.fg,
    ub: document.getElementById('text-ub').value.trim() || DEFAULT_COLORS.ub,
    bd: document.getElementById('text-bd').value.trim() || DEFAULT_COLORS.bd
  };

  chrome.storage.local.set({ [STORAGE_KEY]: colors }, () => {
    showMessage('設定を保存しました！YouTubeページを再読み込みしてください。', 'success');
    console.log('[YTFrozen] 色設定を保存:', colors);
  });
}

// デフォルトに戻す
function resetToDefault() {
  if (!confirm('デフォルト設定に戻しますか？')) {
    return;
  }

  chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_COLORS }, () => {
    loadSettings();
    showMessage('デフォルト設定に戻しました。', 'success');
    console.log('[YTFrozen] デフォルト設定に戻しました');
  });
}

// メッセージ表示
function showMessage(text, type = 'success') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

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

  console.log(`[YTFrozen] セクション切り替え: ${sectionName}`);
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

  // 色入力の同期設定
  setupColorInputSync('color-bg', 'text-bg');
  setupColorInputSync('color-sd', 'text-sd');
  setupColorInputSync('color-fg', 'text-fg');
  setupColorInputSync('color-ub', 'text-ub');
  setupColorInputSync('color-bd', 'text-bd');

  // 保存された設定を読み込み
  loadSettings();

  // ボタンイベント
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('reset-btn').addEventListener('click', resetToDefault);

  console.log('[YTFrozen] 設定画面を初期化しました');
});
