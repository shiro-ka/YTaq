// YTaq: 動画ポップアップ
//
// 以前は iframe に youtube.com/watch をそのまま読み込んでいた。これは
// 「重い SPA をもう1枚起動する」だけで、軽量化どころか二重に重い。
// /embed/ は Polymer アプリもサイドバーもコメントも関連動画も持たない
// 別実装のページなので、同じ再生を桁違いに軽く行える。
//
// 代償は「投稿者が埋め込みを禁止している動画は再生できない」こと。
// 検出は cross-origin では確実にできないので、常に脱出口（YouTubeで開く）を
// ヘッダに置いてある。

(function () {
	'use strict';

	const YTaq = window.YTaq;

	const ANTIBITE_KEY = 'ytaq_antibite';
	const DEFAULT_ANTIBITE = { thumbnailEnabled: true, thumbnailFrame: 'hq1' };

	let thumbSettings = DEFAULT_ANTIBITE;

	YTaq.getStorage(ANTIBITE_KEY, null).then(v => {
		thumbSettings = Object.assign({}, DEFAULT_ANTIBITE, v);
	});
	YTaq.onStorageChange(ANTIBITE_KEY, v => {
		thumbSettings = Object.assign({}, DEFAULT_ANTIBITE, v);
	});

	function thumbnailUrl(videoId) {
		return `https://i.ytimg.com/vi/${videoId}/${thumbSettings.thumbnailFrame || 'hq1'}.jpg`;
	}

	// 埋め込み方式の経緯:
	//   www.youtube.com/embed/ を親 www.youtube.com から開くと全動画が
	//   onError(152) で落ちる。第三者サイトの iframe からは通るので、
	//   YouTube が「youtube.com が youtube.com を埋め込むこと」を弾いている。
	//
	//   同一オリジンだと埋め込み側から window.top.location が読めてしまい、
	//   親が youtube.com だと即座に分かる。youtube-nocookie.com にすると
	//   クロスオリジンになり、それが読めなくなる。ドメインも別なので判定が変わる。
	//
	//   代償: nocookie はログインセッションを持たない。
	//   年齢制限・メンバー限定の動画は再生できない。
	//   Referer さえ通れば www.youtube.com/embed/ でも再生できる可能性があり、
	//   そちらなら Cookie が飛ぶのでログイン状態を保てる。設定で切り替える。
	// Referer 差し替えが効いているので www.youtube.com/embed/ でも再生できることを確認済み。
	// nocookie より Cookie のぶんだけ重いが、年齢制限・メンバー限定が使えて、
	// 同一オリジンなので playbackRate を直接書ける。よって既定はこちら。
	// 塞がれたら設定で OFF にすれば nocookie に戻る。
	//
	// 視聴履歴には残らない（2026-08-15 実測）。ログイン埋め込みでも同じで、
	// 埋め込みプレイヤーからの再生は再生回数には入るが watch history には載らない。
	// 埋め込みという再生経路そのものの仕様なので、iframe 側では変えられない。
	// 履歴が要る場合は popup/ytaq-history.js が /watch 用の再生ログを代わりに送る。
	const LOGIN_KEY = 'ytaq_embed_login';
	let useLoggedInEmbed = true;

	YTaq.getStorage(LOGIN_KEY, true).then(v => { useLoggedInEmbed = !!v; });
	YTaq.onStorageChange(LOGIN_KEY, v => { useLoggedInEmbed = !!v; });

	function embedHost() {
		return useLoggedInEmbed ? 'https://www.youtube.com' : 'https://www.youtube-nocookie.com';
	}

	function embedUrl(videoId) {
		const params = new URLSearchParams({
			autoplay: '1',
			playsinline: '1',
			rel: '0',
			enablejsapi: '1',   // onError を受け取るため
			origin: location.origin
		});
		return `${embedHost()}/embed/${videoId}?${params}`;
	}

	function watchUrl(videoId) {
		return `https://www.youtube.com/watch?v=${videoId}`;
	}

	// --- 再生速度 -------------------------------------------------------------
	// 公式 IFrame API の setPlaybackRate は「サポート外の値は 1 に近い方向へ
	// 丸める」仕様で、実質 2.0 が上限になる。標準の速度メニューも 0.25 刻み・2.0 まで。
	//
	// ログイン埋め込み（www.youtube.com/embed/）なら親と iframe が同一オリジンなので、
	// contentDocument から生の <video> を掴んで playbackRate を直接書ける。
	// これは HTML5 のプロパティなので YouTube の UI 制限とは無関係で、上限を超えられる。
	// nocookie モードではクロスオリジンになって触れないので、その場合だけ API に落ちる。

	const RATE_SETTINGS_KEY = 'ytaq_playbackrate_settings';
	const DEFAULT_RATE_SETTINGS = {
		speedStep: 0.25,
		speedPresets: [1.0, 1.25, 1.5, 1.75, 2.0, 4.0]
	};

	const RATE_MIN = 0.25;
	const RATE_MAX = 16.0;

	function command(iframe, func, args) {
		try {
			iframe.contentWindow.postMessage(
				JSON.stringify({ event: 'command', func, args: args || [], id: 1, channel: 'widget' }),
				embedHost()
			);
		} catch (e) {
			YTaq.warn('popup: command failed:', func, e);
		}
	}

	/** 同一オリジンなら iframe 内の video 要素。無理なら null。 */
	function embeddedVideo(iframe) {
		try {
			const doc = iframe.contentDocument;
			return (doc && doc.querySelector('video')) || null;
		} catch (e) {
			return null; // nocookie（クロスオリジン）
		}
	}

	/** @returns {boolean} 生の video を直接書けたか（false なら API 経由＝2.0 上限） */
	function applyRate(iframe, rate) {
		const v = embeddedVideo(iframe);
		if (v) {
			v.playbackRate = rate;
			return true;
		}
		command(iframe, 'setPlaybackRate', [rate]);
		return false;
	}

	let escHandler = null;
	let messageHandler = null;
	let historyStop = null;

	function hideVideoPopup() {
		// iframe を消す前に呼ぶこと。中の <video> から実際の再生位置を読むので、
		// 先に remove すると最後の報告が 0 秒になる。
		if (historyStop) {
			historyStop();
			historyStop = null;
		}
		const popup = document.getElementById('ytaq-popup');
		if (popup) popup.remove();  // iframe ごと落として再生とネットワークを止める
		if (escHandler) {
			document.removeEventListener('keydown', escHandler);
			escHandler = null;
		}
		if (messageHandler) {
			window.removeEventListener('message', messageHandler);
			messageHandler = null;
		}
	}

	function showVideoPopup(videoId, videoTitle, isShorts = false) {
		if (!videoId) return;
		hideVideoPopup();

		const popup = document.createElement('div');
		popup.id = 'ytaq-popup';

		const content = document.createElement('div');
		content.className = 'ytaq-popup-content';
		if (isShorts) content.classList.add('ytaq-popup-shorts');

		const closeBtn = document.createElement('button');
		closeBtn.className = 'ytaq-popup-close';
		closeBtn.textContent = '×';
		closeBtn.addEventListener('click', hideVideoPopup);

		const title = document.createElement('div');
		title.className = 'ytaq-popup-title';
		title.textContent = videoTitle || '';

		// 埋め込み禁止動画などのための脱出口
		const openLink = document.createElement('a');
		openLink.className = 'ytaq-popup-open-original';
		openLink.textContent = 'YouTubeで開く';
		openLink.href = `https://www.youtube.com/watch?v=${videoId}`;
		openLink.target = '_blank';
		openLink.rel = 'noopener';
		title.appendChild(openLink);

		// 速度コントロールは iframe の中ではなくポップアップ側（親ドキュメント）に置く。
		// 中に注入するとプレイヤーの DOM 構造に依存するうえ、nocookie では触れない。
		const rateBox = document.createElement('div');
		rateBox.className = 'ytaq-popup-rate';
		title.appendChild(rateBox);

		const iframeContainer = document.createElement('div');
		iframeContainer.className = 'ytaq-popup-iframe-container';
		if (isShorts) iframeContainer.classList.add('ytaq-popup-shorts');

		// ローディング中はサムネ＋スピナーを重ねておく
		const skeleton = document.createElement('div');
		skeleton.className = 'ytaq-popup-loading-skeleton';

		const thumb = document.createElement('img');
		thumb.className = 'ytaq-popup-thumbnail';
		thumb.src = thumbnailUrl(videoId);
		thumb.alt = '';

		const spinner = document.createElement('div');
		spinner.className = 'ytaq-popup-spinner';
		skeleton.append(thumb, spinner);

		const iframe = document.createElement('iframe');
		iframe.className = 'ytaq-popup-iframe';
		iframe.src = embedUrl(videoId);
		// autoplay / encrypted-media は Firefox が Permissions Policy として
		// 未実装で警告が出るだけ。同一オリジンなので既定 allowlist の self で足りる。
		iframe.allow = 'fullscreen';
		iframe.allowFullscreen = true;
		iframe.setAttribute('frameborder', '0');

		let skeletonGone = false;
		function dropSkeleton() {
			if (skeletonGone) return;
			skeletonGone = true;
			skeleton.classList.add('fade-out');
			skeleton.addEventListener('transitionend', () => skeleton.remove(), { once: true });
			// アニメーション無効設定だと transitionend が来ないことがある
			setTimeout(() => skeleton.remove(), 600);
		}

		// --- 埋め込み失敗の表示 ---------------------------------------------
		// enablejsapi=1 のプレイヤーは listening ハンドシェイクを送ると
		// onError を返す。cross-origin で取れる情報はこれだけ。
		// 自動遷移はしない（全動画で失敗する状況だと拡張が無いのと同じになる）。
		let failed = false;

		function showEmbedError(code) {
			if (failed) return;
			failed = true;
			skeleton.remove();
			iframe.src = 'about:blank';  // 失敗した埋め込みの通信を止める

			const box = document.createElement('div');
			box.className = 'ytaq-popup-error';

			const msg = document.createElement('p');
			msg.textContent = `埋め込み再生に失敗しました（コード: ${code}）`;
			box.appendChild(msg);

			const btn = document.createElement('button');
			btn.className = 'ytaq-popup-error-btn';
			btn.textContent = '新しいタブで開く';
			btn.addEventListener('click', () => {
				window.open(watchUrl(videoId), '_blank', 'noopener');
				hideVideoPopup();
			});
			box.appendChild(btn);

			iframeContainer.appendChild(box);
		}

		// --- 再生速度コントロール -------------------------------------------
		// チャンネル名は /watch のように DOM から取れないので、
		// listening ハンドシェイク後に流れてくる infoDelivery の
		// videoData.author を使う。保存先は /watch 側と同じ ytaq_playbackrate。
		let rateSettings = DEFAULT_RATE_SETTINGS;
		let channel = null;
		let currentRate = 1;
		let appliedStoredRate = false;
		// 自分で適用した直後は onPlaybackRateChange が返ってくる。それを
		// 「ユーザーが変えた」と誤認して保存すると、API 側で丸められた値
		// （nocookie の 2.0 上限など）で記憶を上書きしてしまう。
		let suppressSaveUntil = 0;

		const rateDisplay = document.createElement('button');
		rateDisplay.className = 'ytaq-popup-rate-display';
		rateDisplay.textContent = '1.00x';
		rateDisplay.title = '再生速度（クリックでプリセット循環）';

		const rateMinus = document.createElement('button');
		rateMinus.className = 'ytaq-popup-rate-btn';
		rateMinus.textContent = '−';

		const ratePlus = document.createElement('button');
		ratePlus.className = 'ytaq-popup-rate-btn';
		ratePlus.textContent = '＋';

		rateBox.append(rateMinus, rateDisplay, ratePlus);

		function renderRate() {
			rateDisplay.textContent = currentRate.toFixed(2) + 'x';
		}

		function changeRate(next) {
			const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, next));
			const direct = applyRate(iframe, rate);
			currentRate = rate;
			renderRate();
			// 直接書けた場合は丸められないので、その値をそのまま記憶してよい。
			// API 経由のときは丸められた実値が後から infoDelivery で返ってくる。
			if (channel) YTaqRateSave(channel, rate);
			// 直接書けた場合でもプレイヤーが自分の値を報告し返してくるので、
			// 明示保存を済ませたあとの報告はすべて無視する。
			suppressSaveUntil = performance.now() + 1500;
			if (!direct) YTaq.log('popup: API 経由のため 2.0 に丸められる可能性あり');
		}

		function YTaqRateSave(ch, rate) {
			if (window.YTaqRate) window.YTaqRate.setStoredRate(ch, rate);
		}

		rateMinus.addEventListener('click', () => changeRate(currentRate - rateSettings.speedStep));
		ratePlus.addEventListener('click', () => changeRate(currentRate + rateSettings.speedStep));
		rateDisplay.addEventListener('click', () => {
			const presets = rateSettings.speedPresets;
			const i = presets.findIndex(s => Math.abs(s - currentRate) < 0.01);
			changeRate(presets[(i + 1) % presets.length]);
		});

		YTaq.getStorage(RATE_SETTINGS_KEY, null).then(v => {
			rateSettings = Object.assign({}, DEFAULT_RATE_SETTINGS, v);
			rateMinus.title = `再生速度を下げる（-${rateSettings.speedStep}）`;
			ratePlus.title = `再生速度を上げる（+${rateSettings.speedStep}）`;
		});

		// チャンネルが判明した時点で記憶していた速度を適用する。
		// 動画のロードで速度は 1 にリセットされるので、ready 後でないと効かない。
		async function applyStoredRateOnce() {
			if (appliedStoredRate || !channel || !window.YTaqRate) return;
			appliedStoredRate = true;
			const stored = await window.YTaqRate.getStoredRate(channel);
			if (!stored || Math.abs(stored - currentRate) < 0.01) return;
			suppressSaveUntil = performance.now() + 1500;
			applyRate(iframe, stored);
			currentRate = stored;
			renderRate();
			YTaq.log('popup: rate applied', channel, stored);
		}

		// プレイヤー側から報告された速度を取り込む（ユーザーが標準メニューで
		// 変えた場合もここに来る）。自分で適用した直後の分は保存しない。
		function onReportedRate(rate) {
			if (!(rate > 0) || Math.abs(rate - currentRate) < 0.01) return;
			currentRate = rate;
			renderRate();
			if (performance.now() < suppressSaveUntil) return;
			if (channel) YTaqRateSave(channel, rate);
		}

		messageHandler = e => {
			if (e.source !== iframe.contentWindow) return;
			let data = e.data;
			if (typeof data === 'string') {
				try { data = JSON.parse(data); } catch (_) { return; }
			}
			if (!data) return;

			if (data.event === 'onError') return showEmbedError(Number(data.info));

			if (data.event === 'onPlaybackRateChange') return onReportedRate(Number(data.info));

			if (data.event === 'infoDelivery' && data.info) {
				const author = data.info.videoData && data.info.videoData.author;
				if (author && author !== channel) {
					channel = author;
					applyStoredRateOnce();
				}
				if (typeof data.info.playbackRate === 'number') onReportedRate(data.info.playbackRate);
				// nocookie では contentDocument が読めないので、履歴に送る秒数はこれが頼り
				if (typeof data.info.currentTime === 'number') lastTime = data.info.currentTime;
			}
		};
		window.addEventListener('message', messageHandler);

		// --- 視聴履歴 --------------------------------------------------------
		// 埋め込み経路は watch history を書かないので、/watch 用の再生ログを
		// popup/ytaq-history.js から自前で送る。秒数はプレイヤーの実測値で、
		// 同一オリジン（ログイン埋め込み）なら <video> から直接、nocookie なら
		// infoDelivery の currentTime から拾う。
		const HISTORY_MIN_SECONDS = 5;  // ytaq-history.js の MIN_SECONDS と合わせる
		let lastTime = 0;
		let historySession = null;
		let historyTimer = null;

		function playedSeconds() {
			const v = embeddedVideo(iframe);
			if (v && v.currentTime > 0) return v.currentTime;
			return lastTime;
		}

		function reportHistory(final) {
			if (historySession) historySession.report(playedSeconds(), final);
		}

		function tickHistory() {
			if (historySession) return reportHistory(false);
			if (failed || playedSeconds() < HISTORY_MIN_SECONDS) return;
			if (!window.YTaqHistory || !window.YTaqHistory.enabled) return;

			historySession = window.YTaqHistory.begin(videoId);
			reportHistory(false);
			// 開始待ちの間だけ 5 秒刻み。始まったら本家と同じくらいまで落とす。
			clearInterval(historyTimer);
			historyTimer = setInterval(() => reportHistory(false), 30000);
		}

		historyStop = () => {
			clearInterval(historyTimer);
			historyTimer = null;
			reportHistory(true);
			historySession = null;
		};

		iframe.addEventListener('load', () => {
			setTimeout(dropSkeleton, 150);
			if (failed) return;

			historyTimer = setInterval(tickHistory, 5000);

			// 同一オリジン（ログイン埋め込み）なら video の ratechange を直接聞ける。
			// infoDelivery より正確で、標準メニューでの変更も即座に拾える。
			const v = embeddedVideo(iframe);
			if (v) {
				v.addEventListener('ratechange', () => onReportedRate(v.playbackRate));
			}

			try {
				iframe.contentWindow.postMessage(
					JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
					embedHost()
				);
			} catch (err) {
				YTaq.warn('popup: listening handshake failed:', err);
			}
		});
		setTimeout(dropSkeleton, 5000); // 保険

		iframeContainer.append(iframe, skeleton);
		content.append(closeBtn, title, iframeContainer);
		popup.appendChild(content);

		popup.addEventListener('click', e => {
			if (e.target === popup) hideVideoPopup();
		});

		escHandler = e => {
			if (e.key === 'Escape') hideVideoPopup();
		};
		document.addEventListener('keydown', escHandler);

		document.body.appendChild(popup);
	}

	window.YTaqPopup = { showVideoPopup, hideVideoPopup };
})();
