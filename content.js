// YTaq: サイドバー（ガイド）まわりの手入れ
//
// 以前は setInterval を2本回して毎秒ガイドを走査していたが、ガイドの DOM は
// 開いたときにしか変化しない。共有 Observer の追加ノード通知だけで足りる。

(function () {
	'use strict';

	const YTaq = window.YTaq;

	// 日本語 UI の title 属性で探し、言語違いは href で拾う
	const SUBS_LINK = '#items ytd-guide-entry-renderer a[title="登録チャンネル"], ' +
		'#items ytd-guide-entry-renderer a[href="/feed/subscriptions"]';

	const TARGET_HREF = '/feed/subscriptions#ytaq';

	// サイドバーに YTaq 管理画面へのボタンを足す
	function addSidebarButton() {
		const link = document.querySelector(SUBS_LINK);
		if (!link) return;

		const entry = link.closest('ytd-guide-entry-renderer');
		if (!entry || !entry.parentElement) return;
		if (entry.parentElement.querySelector('.ytaq-custom-sidebar-btn')) return;

		const btn = document.createElement('button');
		btn.textContent = 'YTaq管理画面';
		btn.className = 'ytaq-custom-sidebar-btn';
		btn.addEventListener('click', () => {
			window.location.href = TARGET_HREF;
		});

		entry.insertAdjacentElement('afterend', btn);
	}

	// 「登録チャンネル」リンクを #ytaq 付きに向ける。
	// SPA 遷移だとハッシュだけ付けても再描画されないので、クリックを横取りする。
	function patchSubscriptionsLink() {
		const a = document.querySelector(SUBS_LINK);
		if (!a || a.classList.contains('ytaq-patched')) return;

		a.href = TARGET_HREF;
		a.addEventListener('click', e => {
			e.preventDefault();
			e.stopPropagation();
			window.location.assign(TARGET_HREF);
		}, true);
		a.classList.add('ytaq-patched');
	}

	function apply() {
		patchSubscriptionsLink();
		addSidebarButton();
	}

	YTaq.ready(() => {
		apply();

		// ガイドは開閉のたびに作り直される。追加ノードに guide エントリが
		// 混ざっているときだけ処理すれば、走査コストはほぼゼロ。
		YTaq.onMutation(added => {
			for (let i = 0; i < added.length; i++) {
				const n = added[i];
				if (!n.querySelector && !n.matches) continue;
				if ((n.matches && n.matches('ytd-guide-entry-renderer, #items, tp-yt-app-drawer')) ||
					(n.querySelector && n.querySelector('ytd-guide-entry-renderer'))) {
					apply();
					return;
				}
			}
		});
	});
})();
