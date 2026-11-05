(function () {
	'use strict';

	const YTaq = window.YTaq;
	const Folders = window.YTaqFolders;

	const buttons = new Set();
	let data = { folders: [], channels: {} };

	function createButton() {
		const widget = document.createElement('div');
		widget.className = 'ytaq-folder';

		const button = document.createElement('button');
		button.className = 'ytaq-folder-btn';
		button.type = 'button';

		const menu = document.createElement('div');
		menu.className = 'ytaq-folder-menu';

		widget.append(button, menu);

		const self = { el: widget, channel: null, render, setChannel, destroy: () => buttons.delete(self) };

		function setChannel(channel) {
			self.channel = channel;
			render();
		}

		function render() {
			const channel = self.channel;
			const inFolders = channel ? Folders.foldersOf(data, channel.id) : [];
			button.classList.toggle('ytaq-folder-in', inFolders.length > 0);
			const names = inFolders.map(f => f.name);
			button.replaceChildren(YTaqIcons.create(names.length ? 'folder_fill' : 'folder'));
			button.setAttribute('aria-label', names.length ? 'フォルダ: ' + names.join('・') : 'フォルダに入れる');
			button.title = names.length ? names.join('・') : 'フォルダに入れる';
			button.disabled = !channel;

			const rows = data.folders.map(f => {
				const row = document.createElement('label');
				row.className = 'ytaq-folder-row';
				const cb = document.createElement('input');
				cb.type = 'checkbox';
				cb.checked = !!channel && f.channels.includes(channel.id);
				cb.addEventListener('change', () => {
					if (self.channel) Folders.toggle(f.id, self.channel);
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
				if (!name || !self.channel) return;
				input.value = '';
				const id = await Folders.createFolder(name);
				await Folders.toggle(id, self.channel);
			});

			menu.replaceChildren(...rows, input);
		}

		buttons.add(self);
		render();
		return self;
	}

	Folders.watch(next => {
		data = next;
		for (const b of buttons) b.render();
	});

	window.YTaqFolderButton = { create: createButton };

	const pageButton = createButton();
	const widget = pageButton.el;
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
		pageButton.setChannel(null);
		const id = await Folders.resolveChannel(t.href);
		if (currentHref !== t.href) return;
		pageButton.setChannel(id ? { id, name: t.name } : null);
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
