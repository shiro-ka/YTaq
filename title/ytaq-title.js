(function () {
	'use strict';

	const YTaq = window.YTaq;

	const PLACES = {
		list: '.ytLockupMetadataViewModelTitle, #video-title',
		feed: '.ytaq-feed-title',
		popup: '.ytaq-popup-title-text',
		watch: 'ytd-watch-metadata h1 yt-formatted-string'
	};

	const RECYCLE_ROOTS = 'ytd-section-list-renderer, ytd-rich-grid-renderer, ' +
		'ytd-watch-next-secondary-results-renderer, ytd-watch-metadata';

	let selector = '';
	let rules = [];
	const written = new WeakMap();

	function configure(v) {
		selector = Object.keys(PLACES).filter(k => v.places[k]).map(k => PLACES[k]).join(',');
		rules = [];
		for (const r of v.rules) {
			if (!r.on || !r.pattern) continue;
			try {
				rules.push({ re: new RegExp(r.pattern, 'g'), replace: r.replace || '' });
			} catch (e) {
				YTaq.warn('title: bad pattern', r.pattern, e);
			}
		}
	}

	function clean(text) {
		let out = text;
		for (const r of rules) out = out.replace(r.re, r.replace);
		return out;
	}

	function collectTextNodes(el, out) {
		for (let n = el.firstChild; n; n = n.nextSibling) {
			if (n.nodeType === 3) out.push(n);
			else if (n.nodeType === 1) collectTextNodes(n, out);
		}
		return out;
	}

	function process(el) {
		if (!rules.length || !el.textContent) return;

		const nodes = collectTextNodes(el, []).filter(n => written.get(n) !== n.data);
		if (!nodes.length) return;

		const nexts = nodes.map(n => clean(n.data));
		if (nexts.every((t, i) => t === nodes[i].data)) return;
		if (!nexts.join('').trim()) return;

		nexts[0] = nexts[0].replace(/^\s+/, '');
		nexts[nexts.length - 1] = nexts[nexts.length - 1].replace(/\s+$/, '');

		for (let i = 0; i < nodes.length; i++) {
			if (nexts[i] !== nodes[i].data) nodes[i].data = nexts[i];
			written.set(nodes[i], nodes[i].data);
		}
	}

	function scan(root) {
		if (!selector) return;
		const scope = root && root.querySelectorAll ? root : document;
		const els = scope.querySelectorAll(selector);
		for (let i = 0; i < els.length; i++) process(els[i]);
	}

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
		if (!selector) return;
		for (let i = 0; i < records.length; i++) {
			const parent = records[i].target.parentElement;
			if (!parent) continue;
			const el = parent.closest(selector);
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

	configure(YTaqSettings.defaults('titleClean'));

	YTaq.ready(() => {
		YTaqSettings.watch('titleClean', v => {
			configure(v);
			scan(document);
		});
		watchRecycling(document);

		YTaq.onMutation(added => {
			if (!selector) return;
			for (let i = 0; i < added.length; i++) {
				const n = added[i];
				if (n.matches) {
					if (n.matches(selector)) process(n);
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
