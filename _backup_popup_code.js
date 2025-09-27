// YouTube動画サムネイルやタイトルクリック時にポップアップで動画本体・タイトル・チャンネル名のみ表示
console.log('YTFrozen overlay script loaded');

function getVideoIdFromUrl(url) {
	const m = url.match(/[?&]v=([\w-]{11})/);
	return m ? m[1] : null;
}

async function openOverlayForVideo(videoId, clickedElement) {
	if (!videoId) return;

	// 既存オーバーレイがあれば削除
	const old = document.getElementById('ytfrozen-overlay');
	if (old) old.remove();

	// オーバーレイ要素作成
	const overlay = document.createElement('div');
	overlay.id = 'ytfrozen-overlay';
	overlay.style.position = 'fixed';
	overlay.style.top = '0';
	overlay.style.left = '0';
	overlay.style.width = '100vw';
	overlay.style.height = '100vh';
	overlay.style.background = 'rgba(0,0,0,0.7)';
	overlay.style.zIndex = '99999';
	overlay.style.display = 'flex';
	overlay.style.alignItems = 'center';
	overlay.style.justifyContent = 'center';

	// ダイアログ本体
	const dialog = document.createElement('div');
	dialog.style.background = '#222';
	dialog.style.borderRadius = '16px';
	dialog.style.boxShadow = '0 4px 32px #0008';
	dialog.style.width = '80vw';
	dialog.style.maxWidth = '80vw';
	dialog.style.height = '80vh';
	dialog.style.maxHeight = '80vh';
	dialog.style.padding = '0';
	dialog.style.color = '#fff';
	dialog.style.overflow = 'hidden';
	dialog.style.position = 'relative';
	dialog.style.display = 'flex';
	dialog.style.flexDirection = 'column';

	// 情報（タイトル・チャンネル名）
	const info = document.createElement('div');
	info.style.padding = '16px';
	info.style.flex = 'none';
	info.style.background = '#222';
	info.style.borderTop = '1px solid #333';
	info.innerHTML = `<div style="font-size:1.1em;font-weight:bold;">動画情報取得中...</div>`;

	// 動画部分
	const player = document.createElement('div');
	player.style.flex = '1 1 0%';
	player.style.display = 'flex';
	player.style.alignItems = 'center';
	player.style.justifyContent = 'center';
	player.style.background = '#111';
	player.innerHTML = `<iframe style="width:100%;height:100%;min-height:240px;min-width:320px;max-width:100vw;max-height:100vh;aspect-ratio:16/9;" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;

	dialog.appendChild(player);
	dialog.appendChild(info);
	overlay.appendChild(dialog);

	// ダイアログの外側クリックで閉じる
	overlay.addEventListener('click', e => {
		if (e.target === overlay) overlay.remove();
	});

	document.body.appendChild(overlay);

	// oEmbed APIで動画情報取得
	try {
		const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
		const res = await fetch(oembedUrl);
		if (!res.ok) throw new Error('oEmbed fetch failed');
		const data = await res.json();
		info.innerHTML = `
			<div style="font-size:1.2em;font-weight:bold;">${data.title}</div>
			<div style="font-size:0.95em;opacity:0.8;margin-bottom:8px;">${data.author_name}</div>
		`;
	} catch (e) {
		info.innerHTML = '<div style="color:#faa">動画情報の取得に失敗しました</div>';
	}
}

function onVideoClick(e) {
	// サムネイルやタイトルのaタグ
	const a = e.currentTarget;
	e.preventDefault();
	e.stopPropagation();
	const videoId = getVideoIdFromUrl(a.href);
	openOverlayForVideo(videoId, a);
	return false;
}

function observeVideoLinks() {
	// サムネイルやタイトルのaタグを検出
	const selector = [
		'a#video-title',
		'a.ytd-thumbnail',
		'a[href^="/watch?v="]',
		'a.yt-lockup-view-model__content-image'
	].join(',');
	document.querySelectorAll(selector).forEach(a => {
		if (!a.dataset.ytfrozen) {
			a.addEventListener('click', onVideoClick, true);
			a.dataset.ytfrozen = '1';
		}
	});
}

// 動的追加にも対応
const observer = new MutationObserver(observeVideoLinks);
observer.observe(document.body, { childList: true, subtree: true });
observeVideoLinks();
