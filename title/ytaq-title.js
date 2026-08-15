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

	// タイトルそのものだけを狙う。
	// 旧: 'yt-formatted-string.style-scope.ytd-video-renderer' は同じ style-scope の
	// 説明スニペットやメタ行まで巻き込んでいたので #video-title に絞った。
	const TARGET_SELECTOR = [
		'h3.yt-lockup-metadata-view-model__heading-reset span.yt-core-attributed-string',
		'#video-title'
	].join(',');

	// 内部に # / ＃ を含む場合はハッシュタグなので残す
	const EXAGGERATION = /【[^】]*】|\[[^\]]*\]|［[^］]*］/g;

	function clean(text) {
		return text.replace(EXAGGERATION, m =>
			(m.includes('#') || m.includes('＃')) ? m : ''
		);
	}

	function hasMark(text) {
		return text.indexOf('【') >= 0 || text.indexOf('[') >= 0 || text.indexOf('［') >= 0;
	}

	// el 配下のテキストノードを出現順に集める。
	// リンク色用の span などが挟まるので、firstChild だけ見ると足りない。
	function collectTextNodes(el, out) {
		for (let n = el.firstChild; n; n = n.nextSibling) {
			if (n.nodeType === 3) out.push(n);
			else if (n.nodeType === 1) collectTextNodes(n, out);
		}
		return out;
	}

	function process(el) {
		const original = el.textContent;
		if (!original) return;
		// 該当文字が無ければ正規表現すら走らせない
		if (!hasMark(original)) return;

		// ノードごとに掃除する。ここで el.textContent へ代入してはいけない：
		// lit / Polymer は自分が作ったテキストノード（とマーカー）へ次の描画を
		// 書き込むので、作り直すと参照が外れる。結果、行が再利用されたときに
		// 「前のタイトルが残る」「タイトルが出ない」になる。
		const nodes = collectTextNodes(el, []);
		if (!nodes.length) return;

		const nexts = new Array(nodes.length);
		let changed = false;
		let joined = '';

		for (let i = 0; i < nodes.length; i++) {
			const data = nodes[i].data;
			const next = hasMark(data) ? clean(data) : data;
			if (next !== data) changed = true;
			nexts[i] = next;
			joined += next;
		}

		if (!changed) return;
		// 【ゆっくり実況】のように全体が誇張表記のタイトルもある。
		// 空にすると「タイトルが消えた」なので、その場合は触らない。
		if (!joined.trim()) return;

		// 先頭の【】を落とすと行頭に空白が残るので詰める
		nexts[0] = nexts[0].replace(/^\s+/, '');
		nexts[nexts.length - 1] = nexts[nexts.length - 1].replace(/\s+$/, '');

		// DOM 書き換えは高いので、本当に変わるノードだけ
		for (let i = 0; i < nodes.length; i++) {
			if (nexts[i] !== nodes[i].data) nodes[i].data = nexts[i];
		}
	}

	function scan(root) {
		const scope = root && root.querySelectorAll ? root : document;
		const els = scope.querySelectorAll(TARGET_SELECTOR);
		for (let i = 0; i < els.length; i++) process(els[i]);
	}

	// --- 行の再利用を拾う ----------------------------------------------------
	// lit は再描画のとき、既にあるテキストノードの data を書き換えるだけで
	// 済ませることがある。共有 Observer は childList しか見ていないので、
	// 検索し直し・スクロールで行が使い回されたケースを取りこぼす。
	// body 全体の characterData 監視は高すぎる（再生時間の表示などで
	// 際限なく飛ぶ）ので、行が使い回されるリストにだけ張る。

	const RECYCLE_ROOTS = 'ytd-section-list-renderer, ytd-rich-grid-renderer, ' +
		'ytd-watch-next-secondary-results-renderer';

	const watchedRoots = new WeakSet();
	const dirty = new Set();
	let charObserver = null;
	let charScheduled = false;

	function flushDirty() {
		charScheduled = false;
		dirty.forEach(process);
		dirty.clear();
	}

	function onCharRecords(records) {
		for (let i = 0; i < records.length; i++) {
			const parent = records[i].target.parentElement;
			if (!parent) continue;
			const el = parent.closest(TARGET_SELECTOR);
			if (el) dirty.add(el);
		}
		if (!dirty.size || charScheduled) return;
		charScheduled = true;
		requestAnimationFrame(flushDirty);
	}

	function observeRoot(r) {
		if (watchedRoots.has(r)) return;
		watchedRoots.add(r);
		if (!charObserver) charObserver = new MutationObserver(onCharRecords);
		charObserver.observe(r, { subtree: true, characterData: true });
	}

	function watchRecycling(root) {
		const scope = root && root.querySelectorAll ? root : document;
		if (scope.matches && scope.matches(RECYCLE_ROOTS)) observeRoot(scope);
		const roots = scope.querySelectorAll(RECYCLE_ROOTS);
		for (let i = 0; i < roots.length; i++) observeRoot(roots[i]);
	}

	YTaq.ready(() => {
		scan(document);
		watchRecycling(document);

		YTaq.onMutation(added => {
			for (let i = 0; i < added.length; i++) {
				const n = added[i];
				if (n.matches) {
					if (n.matches(TARGET_SELECTOR)) process(n);
					// 差し込まれた直後のリストはまだ空なので、
					// querySelectorAll 待ちにせずここで拾う。
					if (n.matches(RECYCLE_ROOTS)) observeRoot(n);
				}
				// 子要素が無ければ querySelectorAll する意味がない。
				// テキストノード差し替え由来の通知は葉の span であることが多いので、
				// この1行で大半の無駄クエリが消える。
				if (n.firstElementChild) {
					scan(n);
					watchRecycling(n);
				}
			}
		});

		YTaq.onNavigate(() => {
			scan(document);
			watchRecycling(document);
		});
	});
})();
