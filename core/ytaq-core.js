// YTaq Core: 全コンテンツスクリプト共通の基盤
//
// 目的は「拡張自身がページを重くしない」こと。以前は各モジュールが
// それぞれ setInterval と body 全体の MutationObserver を持っていたため、
// スクロール中ずっと全DOM走査が走っていた。ここに1本ずつだけ集約する。
//
//  - ナビゲーション検知: yt-navigate-finish 等のイベント駆動（ポーリング廃止）
//  - DOM 監視: 共有 MutationObserver 1本、rAF デバウンス、追加ノードのみ通知
//  - ログ: DEBUG が false の間は完全な no-op

(function () {
	'use strict';

	if (window.YTaq) return;

	// 本番は false。true にすると全モジュールのログが復活する。
	const DEBUG = false;

	const noop = function () {};
	const log = DEBUG ? console.log.bind(console, '[YTaq]') : noop;
	const warn = DEBUG ? console.warn.bind(console, '[YTaq]') : noop;

	function safe(fn, arg) {
		try {
			fn(arg);
		} catch (e) {
			warn('callback error:', e);
		}
	}

	// --- ナビゲーション検知 -------------------------------------------------
	// YouTube は SPA なので location の変化を拾う必要があるが、ポーリングは不要。
	// yt-navigate-finish が最も確実で、popstate / hashchange が保険。
	// なお history.pushState のフックは Firefox の isolated world では
	// ページ側の呼び出しを捕捉できない（expando になるだけ）ので採用しない。
	// 取りこぼしは共有 Observer の href チェックで拾う。

	const navCallbacks = new Set();
	let lastHref = location.href;
	let navScheduled = false;

	function flushNav() {
		navScheduled = false;
		lastHref = location.href;
		log('navigate:', lastHref);
		navCallbacks.forEach(cb => safe(cb));
	}

	// 1フレームに1回へ集約する（yt-navigate-finish は連続して飛ぶことがある）
	function scheduleNav() {
		if (navScheduled) return;
		navScheduled = true;
		requestAnimationFrame(flushNav);
	}

	window.addEventListener('yt-navigate-finish', scheduleNav, true);
	window.addEventListener('yt-page-data-updated', scheduleNav, true);
	window.addEventListener('popstate', scheduleNav);
	window.addEventListener('hashchange', scheduleNav);

	// --- 共有 MutationObserver ----------------------------------------------
	// 購読者が1人以上いるときだけ動かす。コールバックには「今フレームで
	// 追加された要素」だけを渡すので、各モジュールは document 全体ではなく
	// 追加分のサブツリーだけを見れば済む。

	const mutCallbacks = new Set();
	let observer = null;
	let pendingAdded = [];
	let mutScheduled = false;

	function flushMutations() {
		mutScheduled = false;
		const added = pendingAdded;
		pendingAdded = [];
		if (!added.length) return;
		mutCallbacks.forEach(cb => safe(cb, added));
	}

	function onRecords(records) {
		for (let i = 0; i < records.length; i++) {
			const nodes = records[i].addedNodes;
			for (let j = 0; j < nodes.length; j++) {
				const n = nodes[j];
				if (n.nodeType === 1) {
					pendingAdded.push(n);
				} else if (n.nodeType === 3 && n.parentElement) {
					// textContent 差し替えはテキストノードの入れ替えとして飛んでくる。
					// Polymer は要素をリサイクルするので、これを拾わないと
					// スクロール中に再利用された行を取りこぼす。
					// characterData の監視より安い代わりに、親要素を通知する。
					pendingAdded.push(n.parentElement);
				}
			}
		}

		// pushState を捕捉できない分の保険。DOM が動いたついでに確認するので
		// 専用タイマーは不要。
		if (location.href !== lastHref) scheduleNav();

		if (!pendingAdded.length || mutScheduled) return;
		mutScheduled = true;
		requestAnimationFrame(flushMutations);
	}

	function ensureObserver() {
		if (observer || !document.body) return;
		observer = new MutationObserver(onRecords);
		// characterData は監視しない（コストが高い割に得るものが少ない）
		observer.observe(document.body, { childList: true, subtree: true });
		log('shared observer started');
	}

	// --- 公開 API -----------------------------------------------------------

	const readyCallbacks = [];
	let isReady = false;

	function runReady() {
		if (isReady) return;
		isReady = true;
		ensureObserver();
		while (readyCallbacks.length) safe(readyCallbacks.shift());
	}

	const YTaq = {
		DEBUG,
		log,
		warn,

		/** document.body が存在する状態で cb を実行する */
		ready(cb) {
			if (isReady) return safe(cb);
			readyCallbacks.push(cb);
		},

		/** SPA 遷移のたびに cb を呼ぶ。cb 自身が location を見て判断すること。 */
		onNavigate(cb) {
			navCallbacks.add(cb);
			return () => navCallbacks.delete(cb);
		},

		/** 追加された要素の配列を受け取る。共有 Observer は1本だけ。 */
		onMutation(cb) {
			mutCallbacks.add(cb);
			YTaq.ready(ensureObserver);
			return () => mutCallbacks.delete(cb);
		},

		/**
		 * 追加ノード群のうち selector にマッチするものへ fn を適用する。
		 * 追加ノード自身とその子孫だけを見るので、document 全体走査より桁で安い。
		 */
		eachNew(added, selector, fn) {
			for (let i = 0; i < added.length; i++) {
				const node = added[i];
				if (node.matches && node.matches(selector)) fn(node);
				if (!node.querySelectorAll) continue;
				const hits = node.querySelectorAll(selector);
				for (let j = 0; j < hits.length; j++) fn(hits[j]);
			}
		},

		/**
		 * 遷移直後は目的の要素がまだ無いので、現れるまで rAF で粘る。
		 * setInterval と違い、見つかった時点で完全に止まる & タブが
		 * 非アクティブなら自然に停止する。既定 180 フレーム（およそ3秒）。
		 */
		waitFor(selector, cb, tries) {
			let left = typeof tries === 'number' ? tries : 180;
			(function attempt() {
				const el = document.querySelector(selector);
				if (el) return cb(el);
				if (--left <= 0) return;
				requestAnimationFrame(attempt);
			})();
		},

		/** chrome.storage.local の薄いラッパ */
		getStorage(key, fallback) {
			return new Promise(resolve => {
				chrome.storage.local.get([key], result => {
					resolve(result[key] === undefined ? fallback : result[key]);
				});
			});
		},

		setStorage(key, value) {
			return new Promise(resolve => {
				chrome.storage.local.set({ [key]: value }, resolve);
			});
		},

		/** key の変更を購読する */
		onStorageChange(key, cb) {
			chrome.storage.onChanged.addListener((changes, area) => {
				if (area === 'local' && changes[key]) safe(cb, changes[key].newValue);
			});
		}
	};

	window.YTaq = YTaq;

	if (document.body) {
		runReady();
	} else {
		// document_start で走るので body を待つ
		document.addEventListener('DOMContentLoaded', runReady, { once: true });
		new MutationObserver(function (_, obs) {
			if (!document.body) return;
			obs.disconnect();
			runReady();
		}).observe(document.documentElement, { childList: true });
	}
})();
