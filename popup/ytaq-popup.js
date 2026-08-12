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
	//   代償: nocookie はログインセッションを持たない。視聴履歴に残らず、
	//   年齢制限・メンバー限定の動画は再生できない。
	//   Referer さえ通れば www.youtube.com/embed/ でも再生できる可能性があり、
	//   そちらなら Cookie が飛ぶのでログイン状態を保てる。設定で切り替える。
	const LOGIN_KEY = 'ytaq_embed_login';
	let useLoggedInEmbed = false;

	YTaq.getStorage(LOGIN_KEY, false).then(v => { useLoggedInEmbed = !!v; });
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

	let escHandler = null;
	let messageHandler = null;

	function hideVideoPopup() {
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

		messageHandler = e => {
			if (e.source !== iframe.contentWindow) return;
			let data = e.data;
			if (typeof data === 'string') {
				try { data = JSON.parse(data); } catch (_) { return; }
			}
			if (!data || data.event !== 'onError') return;
			showEmbedError(Number(data.info));
		};
		window.addEventListener('message', messageHandler);

		iframe.addEventListener('load', () => {
			setTimeout(dropSkeleton, 150);
			if (failed) return;
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
