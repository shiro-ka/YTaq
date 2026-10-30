(function () {
	'use strict';

	const YTaq = window.YTaq;
	const Folders = window.YTaqFolders;

	const SHOWN_NAMES = 2;

	const widget = document.createElement('div');
	widget.className = 'ytaq-folder';

	const button = document.createElement('button');
	button.className = 'ytaq-folder-btn';
	button.type = 'button';

	const menu = document.createElement('div');
	menu.className = 'ytaq-folder-menu';

	widget.append(button, menu);

	let channel = null;
	let data = { folders: [], channels: {} };
	let currentHref = null;

	function target() {
		if (location.pathname.startsWith('/watch')) {
			const host = document.querySelector('ytd-watch-metadata #owner');
			const link = document.querySelector('ytd-watch-metadata ytd-channel-name a');
			return host && link ? { host, href: link.getAttribute('href'), name: link.textContent.trim() } : null;
		}
		const host = document.querySelector('yt-flexible-actions-view-model');
		if (!host || !/^\/(@|channel\/|c\/|user\/)/.test(location.pathname)) return null;
		const h1 = document.querySelector('yt-page-header-view-model h1');
		return { host, href: location.pathname, name: h1 ? h1.textContent.trim() : document.title.replace(/ - YouTube$/, '') };
	}

	function render() {
		const inFolders = channel ? Folders.foldersOf(data, channel.id) : [];
		button.classList.toggle('ytaq-folder-in', inFolders.length > 0);
		const names = inFolders.map(f => f.name);
		const label = names.length === 0
			? '＋ フォルダ'
			: '✓ ' + names.slice(0, SHOWN_NAMES).join('・') + (names.length > SHOWN_NAMES ? '　＋' + (names.length - SHOWN_NAMES) : '');
		button.textContent = label;
		button.title = names.length ? names.join('・') : 'フォルダに入れる';
		button.disabled = !channel;

		const rows = data.folders.map(f => {
			const row = document.createElement('label');
			row.className = 'ytaq-folder-row';
			const cb = document.createElement('input');
			cb.type = 'checkbox';
			cb.checked = !!channel && f.channels.includes(channel.id);
			cb.addEventListener('change', () => {
				if (channel) Folders.toggle(f.id, channel);
			});
			row.append(cb, document.createTextNode(f.name));
			return row;
		});

		const input = document.createElement('input');
		input.className = 'ytaq-folder-new';
		input.type = 'text';
		input.placeholder = '＋ 新しいフォルダ';
		input.addEventListener('keydown', async e => {
			if (e.key !== 'Enter' || e.isComposing) return;
			const name = input.value.trim();
			if (!name || !channel) return;
			input.value = '';
			const id = await Folders.createFolder(name);
			await Folders.toggle(id, channel);
		});

		menu.replaceChildren(...rows, input);
	}

	async function place() {
		const t = target();
		if (!t) {
			widget.remove();
			currentHref = null;
			return;
		}
		if (widget.parentElement !== t.host) t.host.appendChild(widget);
		if (t.href === currentHref) return;
		currentHref = t.href;
		channel = null;
		render();
		const id = await Folders.resolveChannel(t.href);
		if (currentHref !== t.href) return;
		channel = id ? { id, name: t.name } : null;
		render();
	}

	let scheduled = false;
	function schedule() {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			place();
		});
	}

	const WATCH = 'ytd-watch-metadata, ytd-channel-name, yt-flexible-actions-view-model, yt-page-header-view-model';

	Folders.watch(next => {
		data = next;
		render();
	});

	YTaq.ready(() => {
		schedule();
		YTaq.onNavigate(schedule);
		YTaq.onMutation(added => {
			for (let i = 0; i < added.length; i++) {
				const n = added[i];
				if (n === widget || widget.contains(n)) continue;
				if ((n.matches && n.matches(WATCH)) || (n.closest && n.closest(WATCH))) {
					schedule();
					return;
				}
			}
		});
	});
})();
