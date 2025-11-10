// YTFrozen: チャンネルごとに再生速度を記憶・自動適用する機能
// データ管理のみ（UI制御はytfrozen-rate-ui.jsに分離）

// チャンネル名を取得（YouTube動画ページ用）
function getChannelName() {
  // 動画ページのチャンネル名要素を取得
  const el = document.querySelector('ytd-channel-name a, #owner-name a, .ytd-channel-name a');
  return el ? el.textContent.trim() : null;
}

// video要素を取得
function getVideoElement() {
  return document.querySelector('video');
}

// 再生速度をストレージから取得
function getStoredRate(channel, cb) {
  if (!channel) return cb(null);
  chrome.storage.local.get(['ytfrozen_playbackrate'], result => {
    const map = result.ytfrozen_playbackrate || {};
    cb(map[channel] || null);
  });
}

// 再生速度をストレージに保存
function setStoredRate(channel, rate) {
  if (!channel) return;
  chrome.storage.local.get(['ytfrozen_playbackrate'], result => {
    const map = result.ytfrozen_playbackrate || {};
    map[channel] = rate;
    chrome.storage.local.set({ ytfrozen_playbackrate: map });
  });
}

// video要素の再生速度を監視し、変更時に保存
function observePlaybackRate(video, channel) {
  if (!video || !channel) return;
  let lastRate = video.playbackRate;
  video.addEventListener('ratechange', () => {
    if (video.playbackRate !== lastRate) {
      lastRate = video.playbackRate;
      setStoredRate(channel, lastRate);
      console.log('[YTFrozen Rate] 再生速度を保存:', channel, lastRate);
    }
  });
}

// メイン処理: チャンネルごとの再生速度を適用
function applyPlaybackRatePerChannel() {
  const channel = getChannelName();
  const video = getVideoElement();
  if (!video || !channel) return;
  getStoredRate(channel, rate => {
    if (rate && video.playbackRate !== rate) {
      video.playbackRate = rate;
      console.log('[YTFrozen Rate] 再生速度を適用:', channel, rate);
    }
    observePlaybackRate(video, channel);
  });
}

// 動画ページの遷移やvideo要素の差し替えにも対応
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(applyPlaybackRatePerChannel, 1000);
  }
}, 1000);

// 初回実行
setTimeout(applyPlaybackRatePerChannel, 1000);
