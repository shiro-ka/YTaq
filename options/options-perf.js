// YTaq 設定画面 - 軽量化(Perf)設定モジュール
// 保存先のキーと既定値は perf/ytaq-perf.js と一致させること。

const PERF_STORAGE_KEY = 'ytaq_perf';

const DEFAULT_PERF = {
  hoverPreview: true,
  lazyOffscreen: true,
  ambient: true,
  animations: true,
  hideShorts: false
};

const PERF_FIELDS = Object.keys(DEFAULT_PERF);

function perfInput(key) {
  return document.getElementById(`perf-${key}`);
}

function loadPerfSettings() {
  chrome.storage.local.get([PERF_STORAGE_KEY], (result) => {
    const perf = Object.assign({}, DEFAULT_PERF, result[PERF_STORAGE_KEY]);
    PERF_FIELDS.forEach(key => {
      const el = perfInput(key);
      if (el) el.checked = !!perf[key];
    });
  });
}

function savePerfSettings() {
  const perf = {};
  PERF_FIELDS.forEach(key => {
    const el = perfInput(key);
    perf[key] = el ? el.checked : DEFAULT_PERF[key];
  });

  chrome.storage.local.set({ [PERF_STORAGE_KEY]: perf }, () => {
    // content script 側は storage.onChanged で即反映するので再読み込み不要
    showPerfMessage('保存しました。開いている YouTube のタブに即反映されます。', 'success');
  });
}

function resetPerfToDefault() {
  if (!confirm('軽量化設定をデフォルトに戻しますか？')) return;

  chrome.storage.local.set({ [PERF_STORAGE_KEY]: DEFAULT_PERF }, () => {
    loadPerfSettings();
    showPerfMessage('デフォルト設定に戻しました。', 'success');
  });
}

function showPerfMessage(text, type = 'success') {
  const el = document.getElementById('perf-message');
  el.textContent = text;
  el.className = `message ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function initPerfSettings() {
  loadPerfSettings();
  document.getElementById('perf-save-btn').addEventListener('click', savePerfSettings);
  document.getElementById('perf-reset-btn').addEventListener('click', resetPerfToDefault);
}

window.YTaqPerf = { init: initPerfSettings };
