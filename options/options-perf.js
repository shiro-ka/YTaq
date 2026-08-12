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

// 動画クリック時の挙動。perf とは別キーで持つ（性能設定ではなく挙動設定のため）
const CLICK_STORAGE_KEY = 'ytaq_click';
const DEFAULT_CLICK = 'popup';

// ポップアップの /embed/ に送る Referer。youtube.com のままだと 152 で弾かれる。
const REFERER_STORAGE_KEY = 'ytaq_embed_referer';
const DEFAULT_REFERER = 'https://example.com/';

// ログイン状態で埋め込むか（true = www.youtube.com / false = nocookie）
const LOGIN_STORAGE_KEY = 'ytaq_embed_login';
const DEFAULT_LOGIN = false;

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

  chrome.storage.local.get([CLICK_STORAGE_KEY, REFERER_STORAGE_KEY, LOGIN_STORAGE_KEY], (result) => {
    document.getElementById('perf-embedLogin').checked = !!result[LOGIN_STORAGE_KEY];
    document.getElementById('perf-clickAction').value =
      result[CLICK_STORAGE_KEY] || DEFAULT_CLICK;
    document.getElementById('perf-embedReferer').value =
      result[REFERER_STORAGE_KEY] || DEFAULT_REFERER;
  });
}

function savePerfSettings() {
  const perf = {};
  PERF_FIELDS.forEach(key => {
    const el = perfInput(key);
    perf[key] = el ? el.checked : DEFAULT_PERF[key];
  });

  chrome.storage.local.set({
    [PERF_STORAGE_KEY]: perf,
    [CLICK_STORAGE_KEY]: document.getElementById('perf-clickAction').value,
    [REFERER_STORAGE_KEY]:
      document.getElementById('perf-embedReferer').value.trim() || DEFAULT_REFERER,
    [LOGIN_STORAGE_KEY]: document.getElementById('perf-embedLogin').checked
  }, () => {
    // content script 側は storage.onChanged で即反映するので再読み込み不要
    showPerfMessage('保存しました。開いている YouTube のタブに即反映されます。', 'success');
  });
}

function resetPerfToDefault() {
  if (!confirm('軽量化設定をデフォルトに戻しますか？')) return;

  chrome.storage.local.set({
    [PERF_STORAGE_KEY]: DEFAULT_PERF,
    [CLICK_STORAGE_KEY]: DEFAULT_CLICK,
    [REFERER_STORAGE_KEY]: DEFAULT_REFERER,
    [LOGIN_STORAGE_KEY]: DEFAULT_LOGIN
  }, () => {
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
