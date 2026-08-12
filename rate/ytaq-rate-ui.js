// YTaq: プレイヤーの再生速度 UI
//   - YouTube ネイティブの「再生速度」メニュー項目を隠す
//   - 右下コントロールに −／表示／＋ を追加する
//
// 以前は setInterval 2本（2秒間隔）で常時 querySelector していた。
// プレイヤーの DOM が変わるのは遷移時とメニューを開いた時だけなので、
// core の遷移イベント＋メニュー開閉の検知で十分。
// history.pushState のフックは Firefox の isolated world ではページ側の
// 呼び出しを捕捉できない（expando になるだけ）ため削除した。

(function () {
	'use strict';

	const YTaq = window.YTaq;

	const KEY = 'ytaq_playbackrate_settings';
	const DEFAULTS = {
		speedStep: 0.25,
		speedPresets: [1.0, 1.25, 1.5, 1.75, 2.0, 4.0]
	};

	// --- ネイティブの再生速度メニューを隠す ---------------------------------

	function hideNativeSpeedMenu(root) {
		const scope = root && root.querySelectorAll ? root : document;
		const items = scope.querySelectorAll('.ytp-menuitem:not(.ytaq-hide-playback-rate)');
		for (let i = 0; i < items.length; i++) {
			const label = items[i].querySelector('.ytp-menuitem-label');
			if (label && label.textContent.trim() === '再生速度') {
				items[i].classList.add('ytaq-hide-playback-rate');
			}
		}
	}

	// --- 速度コントロールボタン ---------------------------------------------

	function video() {
		return document.querySelector('video');
	}

	async function addSpeedControls() {
		const rightControls = document.querySelector('.ytp-right-controls');
		if (!rightControls) return;
		if (document.querySelector('.ytaq-rate-controls')) return;

		const settings = Object.assign({}, DEFAULTS, await YTaq.getStorage(KEY, null));
		const { speedStep, speedPresets } = settings;

		// 非同期で設定を読む間に別の呼び出しが追加済みかもしれない
		if (document.querySelector('.ytaq-rate-controls')) return;

		const container = document.createElement('div');
		container.className = 'ytaq-rate-controls';

		const display = document.createElement('button');
		display.className = 'ytaq-rate-display ytp-button';
		display.title = '再生速度';

		function updateDisplay() {
			const v = video();
			if (v) display.textContent = v.playbackRate.toFixed(2) + 'x';
		}

		function setRate(fn) {
			const v = video();
			if (!v) return;
			v.playbackRate = fn(v.playbackRate);
			updateDisplay();
		}

		// クリックでプリセットを循環
		display.addEventListener('click', () => setRate(current => {
			const i = speedPresets.findIndex(s => Math.abs(s - current) < 0.01);
			return speedPresets[(i + 1) % speedPresets.length];
		}));

		const minus = document.createElement('button');
		minus.className = 'ytaq-rate-minus ytp-button';
		minus.textContent = '−';
		minus.title = `再生速度を下げる（-${speedStep}）`;
		minus.addEventListener('click', () => setRate(c => Math.max(0.25, c - speedStep)));

		const plus = document.createElement('button');
		plus.className = 'ytaq-rate-plus ytp-button';
		plus.textContent = '＋';
		plus.title = `再生速度を上げる（+${speedStep}）`;
		plus.addEventListener('click', () => setRate(c => Math.min(16.0, c + speedStep)));

		container.append(minus, display, plus);

		// #startSegmentButton（他拡張）があればその後ろ、無ければ先頭
		const anchor = document.getElementById('startSegmentButton');
		if (anchor && anchor.parentElement === rightControls) {
			rightControls.insertBefore(container, anchor.nextSibling);
		} else {
			rightControls.insertBefore(container, rightControls.firstChild);
		}

		const v = video();
		if (v) {
			v.addEventListener('ratechange', updateDisplay);
			updateDisplay();
		} else {
			display.textContent = '1.00x';
		}
	}

	// --- 起動 ---------------------------------------------------------------

	function setup() {
		if (!location.pathname.startsWith('/watch')) return;
		YTaq.waitFor('.ytp-right-controls', addSpeedControls);
	}

	YTaq.ready(() => {
		setup();
		hideNativeSpeedMenu(document);

		YTaq.onNavigate(setup);

		// 設定メニューは開いた瞬間に生成される。追加ノードにメニュー項目が
		// 含まれるときだけ処理するので、閉じている間のコストはゼロ。
		YTaq.onMutation(added => {
			for (let i = 0; i < added.length; i++) {
				const n = added[i];
				if (!n.querySelector) continue;
				if ((n.matches && n.matches('.ytp-menuitem, .ytp-panel, .ytp-popup')) ||
					n.querySelector('.ytp-menuitem')) {
					hideNativeSpeedMenu(n.parentElement || document);
					return;
				}
			}
		});
	});
})();
