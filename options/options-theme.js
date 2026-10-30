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

function renderTheme(t) {
  fillSelect(themeSelect(), [...themeAccents.keys()], t.theme);
  fillSelect(accentSelect(), themeAccents.get(themeSelect().value) || [], t.accent);
}

function loadThemeSettings() {
  YTaqSettings.get('theme').then(renderTheme);
}

function saveThemeSettings() {
  const value = { theme: themeSelect().value, accent: accentSelect().value };
  YTaqSettings.set('theme', value).then(() => showThemeMessage('設定を保存しました。', 'success'));
}

function resetThemeToDefault() {
  if (!confirm('デフォルト設定に戻しますか？')) return;
  YTaqSettings.reset(['theme']).then(() => {
    renderTheme(YTaqSettings.defaults('theme'));
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
