
// YouTube動画サムネイルやタイトルクリック時にポップアップで動画本体・概要・アクションのみ表示
console.log('YTFrozen content script loaded');
// YTFrozen: サイドバーに独自遷移ボタンを追加

function addYTFrozenSidebarButton() {
	// サイドバーのitems内のytd-guide-entry-rendererを取得
	const items = document.querySelector('#items');
	if (!items) {
		// console.log('[YTFrozen] #items not found');
		return;
	}
	const entries = items.querySelectorAll('ytd-guide-entry-renderer');
	// console.log(`[YTFrozen] ytd-guide-entry-renderer count: ${entries.length}`);
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
		// console.log('[YTFrozen] 登録チャンネル entry not found');
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
	// console.log('[YTFrozen] 管理画面ボタンを追加しました');
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
	// console.log('[YTFrozen] 登録チャンネルリンクをパッチしました');
}

setInterval(patchSubscriptionsGuideLink, 1500);

// 旧ポップアップ実装は home/ytfrozen-home.js に移動しました
