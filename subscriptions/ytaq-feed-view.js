(function () {
	'use strict';

	const YTaq = window.YTaq;
	const Folders = window.YTaqFolders;

	const PATH = '/feed/subscriptions';
	const PER_COLUMN = 100;

	let native = false;
	let folders = { folders: [], channels: {} };
	let feed = null;

	const root = document.createElement('div');
	root.className = 'ytaq-feed-root';

	const toggle = document.createElement('button');
	toggle.className = 'ytaq-feed-toggle';
	toggle.type = 'button';
	toggle.addEventListener('click', () => {
		native = !native;
		apply();
	});

	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	const dtf = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

	function ago(ms) {
		const s = (ms - Date.now()) / 1000;
		const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
		for (const [unit, size] of units) {
			if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
		}
		return rtf.format(0, 'minute');
	}

	function duration(sec) {
		const h = Math.floor(sec / 3600);
		const m = Math.floor(sec % 3600 / 60);
		const s = String(sec % 60).padStart(2, '0');
		return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
	}

	function el(tag, cls, text) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function item(id, v) {
		const d = v.detail || {};
		const a = el('a', 'ytaq-feed-item');
		a.href = '/watch?v=' + id;

		const thumb = el('div', 'ytaq-feed-thumb');
		const img = el('img');
		img.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
		img.alt = '';
		img.loading = 'lazy';
		thumb.append(img);
		if (d.seconds && !d.upcoming) thumb.append(el('span', 'ytaq-feed-duration', duration(d.seconds)));

		const body = el('div', 'ytaq-feed-body');
		body.append(el('span', 'ytaq-feed-title', v.title));
		const name = (folders.channels[v.channel] || {}).name;
		if (name) body.append(el('span', 'ytaq-feed-channel', name));

		const meta = el('span', 'ytaq-feed-meta');
		if (d.upcoming) meta.append(el('span', 'ytaq-feed-badge ytaq-feed-badge-upcoming', '配信予定'), document.createTextNode(dtf.format(d.published || v.published)));
		else if (d.liveNow) meta.append(el('span', 'ytaq-feed-badge ytaq-feed-badge-live', 'ライブ'));
		else meta.append(document.createTextNode(ago(v.published)));
		if (d.short) meta.append(el('span', 'ytaq-feed-badge', 'Shorts'));
		body.append(meta);

		a.append(thumb, body);
		return a;
	}

	function column(folder) {
		const col = el('section', 'ytaq-feed-column');
		const ids = new Set(folder.channels);
		const videos = feed ? Object.keys(feed.videos)
			.filter(id => ids.has(feed.videos[id].channel) && feed.videos[id].published)
			.sort((a, b) => feed.videos[b].published - feed.videos[a].published)
			.slice(0, PER_COLUMN) : [];

		const head = el('header', 'ytaq-feed-column-head');
		head.append(el('span', 'ytaq-feed-column-name', folder.name), el('span', 'ytaq-feed-column-count', folder.channels.length + ' ch'));
		const list = el('div', 'ytaq-feed-list');
		if (videos.length) list.append(...videos.map(id => item(id, feed.videos[id])));
		else list.append(el('p', 'ytaq-feed-empty', folder.channels.length ? '読み込み中…' : 'チャンネルがまだ入っていません'));
		col.append(head, list);
		return col;
	}

	function render() {
		if (!folders.folders.length) {
			root.replaceChildren(el('p', 'ytaq-feed-empty', 'フォルダがありません。チャンネルのページや動画の下の「＋ フォルダ」から作れます。'));
			return;
		}
		const cols = el('div', 'ytaq-feed-columns');
		cols.append(...folders.folders.map(column));
		root.replaceChildren(cols);
	}

	function onPage() {
		return location.pathname === PATH;
	}

	function apply() {
		const on = onPage();
		const manager = document.querySelector('ytd-page-manager');
		document.documentElement.classList.toggle('ytaq-feed-on', on && !native);
		if (!on) {
			root.remove();
			toggle.remove();
			native = false;
			return;
		}
		if (manager && root.parentElement !== manager) manager.appendChild(root);
		if (toggle.parentElement !== document.body) document.body.appendChild(toggle);
		toggle.textContent = native ? 'フォルダの新着に戻る' : 'YouTube の一覧を見る';
		if (!native) chrome.runtime.sendMessage({ type: 'ytaq-feed-refresh' });
	}

	Folders.watch(next => {
		folders = next;
		render();
	});

	YTaq.getStorage('ytaq_feed', null).then(v => {
		feed = v;
		render();
	});
	YTaq.onStorageChange('ytaq_feed', v => {
		feed = v;
		render();
	});

	YTaq.ready(() => {
		apply();
		YTaq.onNavigate(apply);
		YTaq.onMutation(() => {
			if (onPage() && !root.isConnected) apply();
		});
	});
})();
