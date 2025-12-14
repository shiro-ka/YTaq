// YTaq 設定画面 - Playbackrate設定モジュール

const PLAYBACKRATE_STORAGE_KEY = 'ytaq_playbackrate_settings';

// デフォルトのPlaybackrate設定
const DEFAULT_PLAYBACKRATE = {
  speedStep: 0.25,
  speedPresets: [1.0, 1.25, 1.5, 1.75, 2.0, 4.0]
};

// Playbackrate設定を読み込み
function loadPlaybackrateSettings() {
  chrome.storage.local.get([PLAYBACKRATE_STORAGE_KEY], (result) => {
    const settings = result[PLAYBACKRATE_STORAGE_KEY] || DEFAULT_PLAYBACKRATE;

    document.getElementById('speed-step').value = settings.speedStep;
    document.getElementById('speed-presets').value = settings.speedPresets.join(', ');
  });
}

// Playbackrate設定を保存
function savePlaybackrateSettings() {
  const speedStep = parseFloat(document.getElementById('speed-step').value);
  const presetsInput = document.getElementById('speed-presets').value;

  // プリセット速度をパース
  const speedPresets = presetsInput
    .split(',')
    .map(s => parseFloat(s.trim()))
    .filter(n => !isNaN(n) && n > 0 && n <= 16); // 0より大きく16以下の有効な数値のみ

  // バリデーション
  if (isNaN(speedStep) || speedStep < 0.05 || speedStep > 1.0) {
    showPlaybackrateMessage('増減量は0.05〜1.0の範囲で入力してください。', 'error');
    return;
  }

  if (speedPresets.length === 0) {
    showPlaybackrateMessage('プリセット速度を最低1つ入力してください。', 'error');
    return;
  }

  const settings = {
    speedStep,
    speedPresets
  };

  chrome.storage.local.set({ [PLAYBACKRATE_STORAGE_KEY]: settings }, () => {
    showPlaybackrateMessage('設定を保存しました！拡張機能を再読み込みしてください。', 'success');
    console.log('[YTaq Playbackrate] 設定を保存:', settings);
  });
}

// Playbackrate設定をデフォルトに戻す
function resetPlaybackrateToDefault() {
  if (!confirm('Playbackrate設定をデフォルトに戻しますか？')) {
    return;
  }

  chrome.storage.local.set({ [PLAYBACKRATE_STORAGE_KEY]: DEFAULT_PLAYBACKRATE }, () => {
    loadPlaybackrateSettings();
    showPlaybackrateMessage('デフォルト設定に戻しました。', 'success');
    console.log('[YTaq Playbackrate] デフォルト設定に戻しました');
  });
}

// メッセージ表示
function showPlaybackrateMessage(text, type = 'success') {
  const messageEl = document.getElementById('playbackrate-message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

// 初期化関数（options-main.jsから呼び出される）
function initPlaybackrateSettings() {
  // 保存された設定を読み込み
  loadPlaybackrateSettings();

  // ボタンイベント
  document.getElementById('playbackrate-save-btn').addEventListener('click', savePlaybackrateSettings);
  document.getElementById('playbackrate-reset-btn').addEventListener('click', resetPlaybackrateToDefault);

  console.log('[YTaq Playbackrate] Playbackrate設定を初期化しました');
}

// グローバルに公開
window.YTaqPlaybackrate = {
  init: initPlaybackrateSettings
};
