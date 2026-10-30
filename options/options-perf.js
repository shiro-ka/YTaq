const PERF_STORAGE_KEY = 'ytaq_perf';

const DEFAULT_PERF = {
  hoverPreview: true,
  lazyOffscreen: false,
  ambient: true,
  animations: false,
  hideShorts: false
};

const PERF_FIELDS = Object.keys(DEFAULT_PERF);

const CLICK_STORAGE_KEY = 'ytaq_click';
const DEFAULT_CLICK = 'popup';

const REFERER_STORAGE_KEY = 'ytaq_embed_referer';
const DEFAULT_REFERER = 'https://example.com/';

const LOGIN_STORAGE_KEY = 'ytaq_embed_login';
const DEFAULT_LOGIN = true;

const HISTORY_STORAGE_KEY = 'ytaq_watch_history';
const DEFAULT_HISTORY = true;

function checkedOr(value, fallback) {
  return value === undefined ? fallback : !!value;
}

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

  chrome.storage.local.get([
    CLICK_STORAGE_KEY, REFERER_STORAGE_KEY, LOGIN_STORAGE_KEY, HISTORY_STORAGE_KEY
  ], (result) => {
    document.getElementById('perf-embedLogin').checked = checkedOr(result[LOGIN_STORAGE_KEY], DEFAULT_LOGIN);
    document.getElementById('perf-watchHistory').checked = checkedOr(result[HISTORY_STORAGE_KEY], DEFAULT_HISTORY);
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
    [LOGIN_STORAGE_KEY]: document.getElementById('perf-embedLogin').checked,
    [HISTORY_STORAGE_KEY]: document.getElementById('perf-watchHistory').checked
  }, () => {
    showPerfMessage('保存しました。開いている YouTube のタブに即反映されます。', 'success');
  });
}

function resetPerfToDefault() {
  if (!confirm('軽量化設定をデフォルトに戻しますか？')) return;

  chrome.storage.local.set({
    [PERF_STORAGE_KEY]: DEFAULT_PERF,
    [CLICK_STORAGE_KEY]: DEFAULT_CLICK,
    [REFERER_STORAGE_KEY]: DEFAULT_REFERER,
    [LOGIN_STORAGE_KEY]: DEFAULT_LOGIN,
    [HISTORY_STORAGE_KEY]: DEFAULT_HISTORY
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
