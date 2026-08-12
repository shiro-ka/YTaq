// YTaq: タイトルの誇張表記（【】[]［］）を落とす
//
// 以前は body 全体を characterData 込みで監視し、発火のたびに document 全体へ
// querySelectorAll を投げていた。共有 Observer の「追加された要素」だけを見れば、
// 走査範囲は新しく入った分に限定できる。
// Polymer は行を再利用するので、textContent 差し替え（＝テキストノードの入れ替え）
// も core 側で親要素として通知される。

(function () {
	'use strict';

	const YTaq = window.YTaq;

	const TARGET_SELECTOR = [
		'h3.yt-lockup-metadata-view-model__heading-reset span.yt-core-attributed-string',
		'yt-formatted-string.style-scope.ytd-video-renderer'
	].join(',');

	// 内部に # / ＃ を含む場合はハッシュタグなので残す
	const EXAGGERATION = /【[^】]*】|\[[^\]]*\]|［[^］]*］/g;

	function clean(text) {
		return text.replace(EXAGGERATION, m =>
			(m.includes('#') || m.includes('＃')) ? m : ''
		);
	}

	function process(el) {
		const original = el.textContent;
		if (!original) return;
		// 該当文字が無ければ正規表現すら走らせない
		if (original.indexOf('【') < 0 && original.indexOf('[') < 0 && original.indexOf('［') < 0) return;

		const next = clean(original);
		// DOM 書き換えは高いので、本当に変わるときだけ
		if (next !== original) el.textContent = next;
	}

	function scan(root) {
		const scope = root && root.querySelectorAll ? root : document;
		const els = scope.querySelectorAll(TARGET_SELECTOR);
		for (let i = 0; i < els.length; i++) process(els[i]);
	}

	YTaq.ready(() => {
		scan(document);

		YTaq.onMutation(added => {
			for (let i = 0; i < added.length; i++) {
				const n = added[i];
				if (n.matches && n.matches(TARGET_SELECTOR)) process(n);
				// 子要素が無ければ querySelectorAll する意味がない。
				// テキストノード差し替え由来の通知は葉の span であることが多いので、
				// この1行で大半の無駄クエリが消える。
				if (n.firstElementChild) scan(n);
			}
		});

		YTaq.onNavigate(() => scan(document));
	});
})();
