(function () {
	'use strict';

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

	const navCallbacks = new Set();
	let lastHref = location.href;
	let navScheduled = false;

	function flushNav() {
		navScheduled = false;
		lastHref = location.href;
		log('navigate:', lastHref);
		navCallbacks.forEach(cb => safe(cb));
	}

	function scheduleNav() {
		if (navScheduled) return;
		navScheduled = true;
		requestAnimationFrame(flushNav);
	}

	window.addEventListener('yt-navigate-finish', scheduleNav, true);
	window.addEventListener('yt-page-data-updated', scheduleNav, true);
	window.addEventListener('popstate', scheduleNav);
	window.addEventListener('hashchange', scheduleNav);

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
					pendingAdded.push(n.parentElement);
				}
			}
		}

		if (location.href !== lastHref) scheduleNav();

		if (!pendingAdded.length || mutScheduled) return;
		mutScheduled = true;
		requestAnimationFrame(flushMutations);
	}

	function ensureObserver() {
		if (observer || !document.body) return;
		observer = new MutationObserver(onRecords);
		observer.observe(document.body, { childList: true, subtree: true });
		log('shared observer started');
	}

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

		ready(cb) {
			if (isReady) return safe(cb);
			readyCallbacks.push(cb);
		},

		onNavigate(cb) {
			navCallbacks.add(cb);
			return () => navCallbacks.delete(cb);
		},

		onMutation(cb) {
			mutCallbacks.add(cb);
			YTaq.ready(ensureObserver);
			return () => mutCallbacks.delete(cb);
		},

		eachNew(added, selector, fn) {
			for (let i = 0; i < added.length; i++) {
				const node = added[i];
				if (node.matches && node.matches(selector)) fn(node);
				if (!node.querySelectorAll) continue;
				const hits = node.querySelectorAll(selector);
				for (let j = 0; j < hits.length; j++) fn(hits[j]);
			}
		},

		waitFor(selector, cb, tries) {
			let left = typeof tries === 'number' ? tries : 180;
			(function attempt() {
				const el = document.querySelector(selector);
				if (el) return cb(el);
				if (--left <= 0) return;
				requestAnimationFrame(attempt);
			})();
		},

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
		document.addEventListener('DOMContentLoaded', runReady, { once: true });
		new MutationObserver(function (_, obs) {
			if (!document.body) return;
			obs.disconnect();
			runReady();
		}).observe(document.documentElement, { childList: true });
	}
})();
