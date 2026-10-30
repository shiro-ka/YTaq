const THEME_STORAGE_KEY = 'ytaq_theme';
const DEFAULT_THEME = globalThis.YTaqDefaults.theme;

const THEME_BLOCK = /^\[data-suisou-theme~="([a-z]+)"\] \{/gm;
const ACCENT_BLOCK = /^\[data-suisou-theme~="([a-z]+)"\]\[data-suisou-theme~="([a-z]+)"\] \{/gm;

let themeAccents = new Map();

async function loadPalette() {
  const res = await fetch(chrome.runtime.getURL('suisou-palette.css'));
  const css = await res.text();
  const map = new Map();
  for (const m of css.matchAll(THEME_BLOCK)) map.set(m[1], []);
  for (const m of css.matchAll(ACCENT_BLOCK)) {
    if (map.has(m[1])) map.get(m[1]).push(m[2]);
  }
  return map;
}

function themeSelect() {
  return document.querySelector('.ytaq-theme-name');
}

function accentSelect() {
  return document.querySelector('.ytaq-theme-accent');
}

function fillSelect(select, values, selected) {
  select.replaceChildren(...values.map(v => {
    const option = document.createElement('option');
    option.value = v;
    option.textContent = v;
    return option;
  }));
  select.value = values.includes(selected) ? selected : values[0];
}

function renderTheme(value) {
  const t = Object.assign({}, DEFAULT_THEME, value || {});
  fillSelect(themeSelect(), [...themeAccents.keys()], t.theme);
  fillSelect(accentSelect(), themeAccents.get(themeSelect().value) || [], t.accent);
}

function loadThemeSettings() {
  chrome.storage.local.get([THEME_STORAGE_KEY], result => renderTheme(result[THEME_STORAGE_KEY]));
}

function saveThemeSettings() {
  const value = { theme: themeSelect().value, accent: accentSelect().value };
  chrome.storage.local.set({ [THEME_STORAGE_KEY]: value }, () => {
    showThemeMessage('設定を保存しました。', 'success');
  });
}

function resetThemeToDefault() {
  if (!confirm('デフォルト設定に戻しますか？')) return;
  chrome.storage.local.set({ [THEME_STORAGE_KEY]: DEFAULT_THEME }, () => {
    renderTheme(DEFAULT_THEME);
    showThemeMessage('デフォルト設定に戻しました。', 'success');
  });
}

function showThemeMessage(text, type = 'success') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

async function initThemeSettings() {
  themeAccents = await loadPalette();
  loadThemeSettings();

  themeSelect().addEventListener('change', () => {
    fillSelect(accentSelect(), themeAccents.get(themeSelect().value) || [], accentSelect().value);
  });

  document.getElementById('save-btn').addEventListener('click', saveThemeSettings);
  document.getElementById('reset-btn').addEventListener('click', resetThemeToDefault);
}

window.YTaqTheme = {
  init: initThemeSettings
};
