// YTFrozen 設定画面 - Antibite設定モジュール

const ANTIBITE_STORAGE_KEY = 'ytfrozen_antibite';

// デフォルトのAntibite設定
const DEFAULT_ANTIBITE = {
  thumbnailEnabled: true,
  thumbnailFrame: 'hq1'
};

// Antibite設定を読み込み
function loadAntibiteSettings() {
  chrome.storage.local.get([ANTIBITE_STORAGE_KEY], (result) => {
    const antibite = result[ANTIBITE_STORAGE_KEY] || DEFAULT_ANTIBITE;

    document.getElementById('thumbnail-enabled').checked = antibite.thumbnailEnabled;
    document.getElementById('thumbnail-frame').value = antibite.thumbnailFrame;

    // チェックボックスの状態に応じてフレーム選択を有効/無効化
    updateThumbnailFrameSetting();
  });
}

// Antibite設定を保存
function saveAntibiteSettings() {
  const antibite = {
    thumbnailEnabled: document.getElementById('thumbnail-enabled').checked,
    thumbnailFrame: document.getElementById('thumbnail-frame').value
  };

  chrome.storage.local.set({ [ANTIBITE_STORAGE_KEY]: antibite }, () => {
    showAntibiteMessage('設定を保存しました！拡張機能を再読み込みしてください。', 'success');
    console.log('[YTFrozen Antibite] 設定を保存:', antibite);
  });
}

// Antibite設定をデフォルトに戻す
function resetAntibiteToDefault() {
  if (!confirm('Antibite設定をデフォルトに戻しますか？')) {
    return;
  }

  chrome.storage.local.set({ [ANTIBITE_STORAGE_KEY]: DEFAULT_ANTIBITE }, () => {
    loadAntibiteSettings();
    showAntibiteMessage('デフォルト設定に戻しました。', 'success');
    console.log('[YTFrozen Antibite] デフォルト設定に戻しました');
  });
}

// サムネイルフレーム設定の有効/無効化
function updateThumbnailFrameSetting() {
  const enabled = document.getElementById('thumbnail-enabled').checked;
  const frameSelect = document.getElementById('thumbnail-frame');
  const frameSetting = document.getElementById('thumbnail-frame-setting');

  if (enabled) {
    frameSelect.disabled = false;
    frameSetting.style.opacity = '1';
  } else {
    frameSelect.disabled = true;
    frameSetting.style.opacity = '0.5';
  }
}

// メッセージ表示
function showAntibiteMessage(text, type = 'success') {
  const messageEl = document.getElementById('antibite-message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

// 初期化関数（options-main.jsから呼び出される）
function initAntibiteSettings() {
  // 保存された設定を読み込み
  loadAntibiteSettings();

  // ボタンイベント
  document.getElementById('antibite-save-btn').addEventListener('click', saveAntibiteSettings);
  document.getElementById('antibite-reset-btn').addEventListener('click', resetAntibiteToDefault);

  // サムネイル有効/無効チェックボックスの変更イベント
  document.getElementById('thumbnail-enabled').addEventListener('change', updateThumbnailFrameSetting);

  console.log('[YTFrozen Antibite] Antibite設定を初期化しました');
}

// グローバルに公開
window.YTFrozenAntibite = {
  init: initAntibiteSettings
};
