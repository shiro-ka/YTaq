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

	function embedUrl(videoId) {
		const params = new URLSearchParams({
			autoplay: '1',
			playsinline: '1',
			rel: '0',            // 関連動画を同チャンネルに限定（読み込む量が減る）
			modestbranding: '1'
		});
		return `https://www.youtube.com/embed/${videoId}?${params}`;
	}

	let escHandler = null;

	function hideVideoPopup() {
		const popup = document.getElementById('ytaq-popup');
		if (popup) popup.remove();  // iframe ごと落として再生とネットワークを止める
		if (escHandler) {
			document.removeEventListener('keydown', escHandler);
			escHandler = null;
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
		iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
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

		// /watch と違って embed は速いので、load 後の待ち時間は短くてよい
		iframe.addEventListener('load', () => setTimeout(dropSkeleton, 150));
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
