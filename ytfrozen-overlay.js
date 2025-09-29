

// --- 直接postMessageでYouTube埋め込みを制御 + チャンネルごと再生速度記憶 ---
console.log('YTFrozen overlay script loaded');

// --- サイドバーの「登録チャンネル」リンクを書き換え（/feed/subscriptions#ytfrozen へ） ---
function patchSubscriptionsGuideLink_OverlaySide() {
	try {
		let a = document.querySelector('#items ytd-guide-entry-renderer a[title="登録チャンネル"]');
		if (!a) a = document.querySelector('#items ytd-guide-entry-renderer a[href="/feed/subscriptions"]');
		if (!a) return;
		if (a.classList.contains('ytfrozen-patched')) return;
		const targetHref = '/feed/subscriptions#ytfrozen';
		a.href = targetHref;
		const handler = (e) => {
			try { e.preventDefault(); e.stopPropagation(); } catch {}
			window.location.assign(targetHref);
		};
		a.addEventListener('click', handler, true);
		a.classList.add('ytfrozen-patched');
		console.log('[YTFrozen] (overlay) 登録チャンネルリンクをパッチしました');
	} catch (e) {
		console.warn('[YTFrozen] (overlay) パッチ中にエラー', e);
	}
}
setInterval(patchSubscriptionsGuideLink_OverlaySide, 1500);

// YouTube iframe postMessage helper
function createYTController(iframe, playerId) {
	const ORIGIN = 'https://www.youtube.com';
	function postCommand(func, args = []) {
		if (!iframe.contentWindow) return;
		const msg = JSON.stringify({ event: 'command', func, args, id: playerId });
		iframe.contentWindow.postMessage(msg, ORIGIN);
	}
	function listen(handler) {
		function onMsg(e) {
			if (e.origin !== ORIGIN) return;
			let data;
			try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
			if (!data) return;
			if (data.id && data.id !== playerId) return; // 別プレイヤー無視
			handler(data);
		}
		window.addEventListener('message', onMsg);
		return () => window.removeEventListener('message', onMsg);
	}
	function init() {
		// プレイヤーへの購読開始
		if (!iframe.contentWindow) return;
		const listenMsg = JSON.stringify({ event: 'listening', id: playerId });
		iframe.contentWindow.postMessage(listenMsg, ORIGIN);
		// 必要なイベントを購読
		postCommand('addEventListener', ['onReady']);
		postCommand('addEventListener', ['onStateChange']);
		postCommand('addEventListener', ['onPlaybackRateChange']);
	}
	return { postCommand, listen, init };
}

function getVideoIdFromUrl(url) {
	const m = url.match(/[?&]v=([\w-]{11})/);
	return m ? m[1] : null;
}

// チャンネル名取得
async function fetchChannelName(videoId) {
	try {
		const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
		const res = await fetch(oembedUrl);
		if (!res.ok) throw new Error('oEmbed fetch failed');
		const data = await res.json();
		return data.author_name;
	} catch {
		return null;
	}
}

// 再生速度ストレージ
function getStoredRate(channel, cb) {
	if (!channel) return cb(null);
	chrome.storage.local.get(['ytfrozen_playbackrate'], result => {
		const map = result.ytfrozen_playbackrate || {};
		cb(map[channel] || null);
	});
}
function setStoredRate(channel, rate) {
	if (!channel) return;
	chrome.storage.local.get(['ytfrozen_playbackrate'], result => {
		const map = result.ytfrozen_playbackrate || {};
		map[channel] = rate;
		chrome.storage.local.set({ ytfrozen_playbackrate: map });
	});
}

// ポップアップオーバーレイ生成
function openOverlayForVideo(videoId, clickedElement) {
	if (!videoId) return;
	// 既存オーバーレイがあれば削除
	const old = document.getElementById('ytfrozen-overlay');
	if (old) old.remove();

	// オーバーレイ要素
	const overlay = document.createElement('div');
	overlay.id = 'ytfrozen-overlay';
	overlay.style.position = 'fixed';
	overlay.style.top = '0';
	overlay.style.left = '0';
	overlay.style.width = '100vw';
	overlay.style.height = '100vh';
	overlay.style.background = 'rgba(0,0,0,0.7)';
	overlay.style.zIndex = '99999';
	overlay.style.display = 'flex';
	overlay.style.alignItems = 'center';
	overlay.style.justifyContent = 'center';

	// ダイアログ本体
	const dialog = document.createElement('div');
	dialog.style.background = '#222';
	dialog.style.borderRadius = '18px';
	dialog.style.boxShadow = '0 8px 40px 0 #000a, 0 0 0 2.5px rgba(180,220,255,0.18)';
	dialog.style.border = '1.5px solid rgba(180,220,255,0.22)';
	dialog.style.backgroundClip = 'padding-box';
	dialog.style.width = '80vw';
	dialog.style.maxWidth = '80vw';
	dialog.style.height = '80vh';
	dialog.style.maxHeight = '80vh';
	dialog.style.padding = '0';
	dialog.style.color = '#fff';
	dialog.style.overflow = 'hidden';
	dialog.style.position = 'relative';
	dialog.style.display = 'flex';
	dialog.style.flexDirection = 'column';

	// プレイヤー表示領域
	const playerDiv = document.createElement('div');
	playerDiv.id = 'ytfrozen-player';
	playerDiv.style.flex = '1 1 0%';
	playerDiv.style.display = 'flex';
	playerDiv.style.alignItems = 'center';
	playerDiv.style.justifyContent = 'center';
	playerDiv.style.background = '#111';

	// 情報欄
	const info = document.createElement('div');
	info.style.padding = '16px';
	info.style.flex = 'none';
	info.style.background = '#222';
	info.style.borderTop = '1px solid #333';
	info.innerHTML = `<div style="font-size:1.1em;font-weight:bold;">動画情報取得中...</div>`;

	dialog.appendChild(playerDiv);
	dialog.appendChild(info);
	overlay.appendChild(dialog);

	// 外側クリックで閉じる
	overlay.addEventListener('click', e => {
		if (e.target === overlay) overlay.remove();
	});
	document.body.appendChild(overlay);

	(async () => {
		const channel = await fetchChannelName(videoId);
		let savedRate = null;
		await new Promise(resolve => getStoredRate(channel, r => { savedRate = r; resolve(); }));

		// Iframe埋め込み（APIなし、postMessage制御）
		const iframe = document.createElement('iframe');
		const playerId = 'ytfrozen-' + Math.random().toString(36).slice(2);
		iframe.id = playerId;
		iframe.style.width = '100%';
		iframe.style.height = '100%';
		iframe.style.minHeight = '240px';
		iframe.style.minWidth = '320px';
		iframe.style.maxWidth = '100vw';
		iframe.style.maxHeight = '100vh';
		iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
		const originParam = encodeURIComponent(location.origin);
		iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1&origin=${originParam}`;
		playerDiv.innerHTML = '';
		playerDiv.appendChild(iframe);

		const ctrl = createYTController(iframe, playerId);
		let cleanupMsg = null;
		let ready = false;
		let lastRate = null;
		cleanupMsg = ctrl.listen(msg => {
			// デバッグ
			if (msg.event && msg.event !== 'infoDelivery') {
				console.log('YT msg', msg);
			}
			if (msg.event === 'onReady') {
				ready = true;
				if (savedRate) ctrl.postCommand('setPlaybackRate', [savedRate]);
			}
			if (msg.event === 'infoDelivery' && msg.info) {
				if (typeof msg.info.playbackRate === 'number') {
					if (msg.info.playbackRate !== lastRate) {
						lastRate = msg.info.playbackRate;
						if (channel) setStoredRate(channel, lastRate);
					}
				}
			}
		});

		iframe.addEventListener('load', () => {
			ctrl.init();
		});

				// 速度UI削除

				// タイトル・チャンネル名表示（大きく・マージン追加）
				try {
					const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
					const res = await fetch(oembedUrl);
					if (res.ok) {
						const data = await res.json();
						info.innerHTML = `
							<div style="font-size:2em;font-weight:bold;margin-bottom:0.5em;line-height:1.2;">${data.title}</div>
							<div style="font-size:1.3em;opacity:0.85;margin-bottom:0.5em;line-height:1.2;">${data.author_name}</div>
						`;
					}
				} catch (e) {
					console.warn('oEmbed fetch failed', e);
				}

		// クリーンアップ
		overlay.addEventListener('remove', () => { if (cleanupMsg) cleanupMsg(); }, { once: true });
	})();
}

function onVideoClick(e) {
	const a = e.currentTarget;
	e.preventDefault();
	e.stopPropagation();
	const videoId = getVideoIdFromUrl(a.href);
	openOverlayForVideo(videoId, a);
	return false;
}

function observeVideoLinks() {
	const selector = [
		'a#video-title',
		'a.ytd-thumbnail',
		'a[href^="/watch?v="]',
		'a.yt-lockup-view-model__content-image'
	].join(',');
	document.querySelectorAll(selector).forEach(a => {
		if (!a.dataset.ytfrozen) {
			a.addEventListener('click', onVideoClick, true);
			a.dataset.ytfrozen = '1';
		}
	});
}

const observer = new MutationObserver(observeVideoLinks);
observer.observe(document.body, { childList: true, subtree: true });
observeVideoLinks();
