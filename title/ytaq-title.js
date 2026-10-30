(function () {
	'use strict';

	const YTaq = window.YTaq;

	const TARGET_SELECTOR = [
		'.ytLockupMetadataViewModelTitle',
		'.ytaq-feed-title',
		'#video-title'
	].join(',');

	const EXAGGERATION = /【[^】]*】|\[[^\]]*\]|［[^］]*］/g;

	function clean(text) {
		return text.replace(EXAGGERATION, m =>
			(m.includes('#') || m.includes('＃')) ? m : ''
		);
	}

	function hasMark(text) {
		return text.indexOf('【') >= 0 || text.indexOf('[') >= 0 || text.indexOf('［') >= 0;
	}

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
		if (!hasMark(original)) return;

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
		if (!joined.trim()) return;

		nexts[0] = nexts[0].replace(/^\s+/, '');
		nexts[nexts.length - 1] = nexts[nexts.length - 1].replace(/\s+$/, '');

		for (let i = 0; i < nodes.length; i++) {
			if (nexts[i] !== nodes[i].data) nodes[i].data = nexts[i];
		}
	}

	function scan(root) {
		const scope = root && root.querySelectorAll ? root : document;
		const els = scope.querySelectorAll(TARGET_SELECTOR);
		for (let i = 0; i < els.length; i++) process(els[i]);
	}

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
					if (n.matches(RECYCLE_ROOTS)) observeRoot(n);
				}
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
