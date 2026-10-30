const ANTIBITE_STORAGE_KEY = 'ytaq_antibite';

const DEFAULT_ANTIBITE = {
  thumbnailEnabled: true,
  thumbnailFrame: 'hq1'
};

function loadAntibiteSettings() {
  chrome.storage.local.get([ANTIBITE_STORAGE_KEY], (result) => {
    const antibite = result[ANTIBITE_STORAGE_KEY] || DEFAULT_ANTIBITE;

    document.getElementById('thumbnail-enabled').checked = antibite.thumbnailEnabled;
    document.getElementById('thumbnail-frame').value = antibite.thumbnailFrame;

    updateThumbnailFrameSetting();
  });
}

function saveAntibiteSettings() {
  const antibite = {
    thumbnailEnabled: document.getElementById('thumbnail-enabled').checked,
    thumbnailFrame: document.getElementById('thumbnail-frame').value
  };

  chrome.storage.local.set({ [ANTIBITE_STORAGE_KEY]: antibite }, () => {
    showAntibiteMessage('設定を保存しました！拡張機能を再読み込みしてください。', 'success');
    console.log('[YTaq Antibite] 設定を保存:', antibite);
  });
}

function resetAntibiteToDefault() {
  if (!confirm('Antibite設定をデフォルトに戻しますか？')) {
    return;
  }

  chrome.storage.local.set({ [ANTIBITE_STORAGE_KEY]: DEFAULT_ANTIBITE }, () => {
    loadAntibiteSettings();
    showAntibiteMessage('デフォルト設定に戻しました。', 'success');
    console.log('[YTaq Antibite] デフォルト設定に戻しました');
  });
}

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

function showAntibiteMessage(text, type = 'success') {
  const messageEl = document.getElementById('antibite-message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

function initAntibiteSettings() {
  loadAntibiteSettings();

  document.getElementById('antibite-save-btn').addEventListener('click', saveAntibiteSettings);
  document.getElementById('antibite-reset-btn').addEventListener('click', resetAntibiteToDefault);

  document.getElementById('thumbnail-enabled').addEventListener('change', updateThumbnailFrameSetting);

  console.log('[YTaq Antibite] Antibite設定を初期化しました');
}

window.YTaqAntibite = {
  init: initAntibiteSettings
};
