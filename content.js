
// YouTube動画サムネイルやタイトルクリック時にポップアップで動画本体・概要・アクションのみ表示
console.log('YTFrozen content script loaded');
// YTFrozen: サイドバーに独自遷移ボタンを追加

function addYTFrozenSidebarButton() {
	// サイドバーのitems内のytd-guide-entry-rendererを取得
	const items = document.querySelector('#items');
	if (!items) {
		console.log('[YTFrozen] #items not found');
		return;
	}
	const entries = items.querySelectorAll('ytd-guide-entry-renderer');
	console.log(`[YTFrozen] ytd-guide-entry-renderer count: ${entries.length}`);
	// 「登録チャンネル」ボタン（title属性が"登録チャンネル"のaタグ）を探す
	let targetEntry = null;
	for (const entry of entries) {
		const a = entry.querySelector('a[title="登録チャンネル"]');
		if (a) {
			targetEntry = entry;
			break;
		}
	}
	if (!targetEntry) {
		console.log('[YTFrozen] 登録チャンネル entry not found');
		return;
	}

	// すでにボタンが追加されていれば何もしない
	if (items.querySelector('.ytfrozen-custom-sidebar-btn')) {
		//console.log('[YTFrozen] ボタンは既に存在');
		return;
	}

	// ボタン要素を作成
	const btn = document.createElement('button');
	btn.textContent = 'YTFrozen管理画面';
	btn.className = 'ytfrozen-custom-sidebar-btn';
	btn.style.margin = '8px 0 8px 40px';
	btn.style.padding = '6px 12px';
	btn.style.background = 'var(--ytfrozen-nord8, #88c0d0)';
	btn.style.color = '#fff';
	btn.style.border = 'none';
	btn.style.borderRadius = '6px';
	btn.style.cursor = 'pointer';
	btn.style.fontSize = '14px';

	btn.addEventListener('click', () => {
		window.location.href = '/feed/subscriptions#ytfrozen';
	});

	// 「登録チャンネル」ボタンの直後に挿入
	targetEntry.insertAdjacentElement('afterend', btn);
	console.log('[YTFrozen] 管理画面ボタンを追加しました');
}

// ページ遷移や動的描画に対応するため定期的に実行
setInterval(addYTFrozenSidebarButton, 1500);

// 「登録チャンネル」リンクのhrefを書き換えてハッシュ付きに遷移
function patchSubscriptionsGuideLink() {
	// titleで探す（日本語環境）
	let a = document.querySelector('#items ytd-guide-entry-renderer a[title="登録チャンネル"]');
	// 予備: hrefで探す（言語違い対策）
	if (!a) a = document.querySelector('#items ytd-guide-entry-renderer a[href="/feed/subscriptions"]');
	if (!a) return;

	// 二重適用防止
	if (a.classList.contains('ytfrozen-patched')) return;

	const targetHref = '/feed/subscriptions#ytfrozen';
	try {
		a.href = targetHref;
	} catch (e) {
		console.warn('[YTFrozen] href書き換えに失敗:', e);
	}

	// クリックを横取りして確実に遷移（SPA対策）
	const handler = (e) => {
		try {
			e.preventDefault();
			e.stopPropagation();
		} catch {}
		window.location.assign(targetHref);
	};
	a.addEventListener('click', handler, true); // キャプチャ段階で処理
	a.classList.add('ytfrozen-patched');
	console.log('[YTFrozen] 登録チャンネルリンクをパッチしました');
}

setInterval(patchSubscriptionsGuideLink, 1500);

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


	// 動画埋め込み
	const player = document.createElement('div');
	player.innerHTML = `<iframe style="width:100%;height:100%;min-height:240px;min-width:320px;max-width:100vw;max-height:100vh;aspect-ratio:16/9;" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;

	// 情報（タイトル・チャンネル名）
	const info = document.createElement('div');
	info.style.padding = '16px';
	info.style.flex = 'none';
	info.style.background = '#222';
	info.style.borderTop = '1px solid #333';
	info.innerHTML = `<div style=\"font-size:1.1em;font-weight:bold;\">動画情報取得中...</div>`;

	// 動画部分
	player.style.flex = '1 1 0%';
	player.style.display = 'flex';
	player.style.alignItems = 'center';
	player.style.justifyContent = 'center';
	player.style.background = '#111';

	// 閉じるボタンは不要
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
