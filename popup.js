// popup.html用スクリプト
// URLパラメータから動画IDを取得し、YouTube埋め込みと情報表示
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

const videoId = getQueryParam('v');
if (videoId) {
  document.getElementById('player').innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;
}

// 動画情報取得（YouTube Data APIが必要。ここでは仮のデータを表示）
const title = '動画タイトル（仮）';
const meta = '概要（仮）';
document.getElementById('title').textContent = title;
document.getElementById('meta').textContent = meta;

// アクションボタンのイベント（実装例）
document.getElementById('like').onclick = () => alert('高評価！');
document.getElementById('dislike').onclick = () => alert('低評価…');
document.getElementById('subscribe').onclick = () => alert('チャンネル登録！');
