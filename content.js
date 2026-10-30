(function () {
	'use strict';

	const YTaq = window.YTaq;

	const SUBS_LINK = '#items ytd-guide-entry-renderer a[title="登録チャンネル"], ' +
		'#items ytd-guide-entry-renderer a[href="/feed/subscriptions"]';

	const TARGET_HREF = '/feed/subscriptions#ytaq';

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
