(function () {
	'use strict';

	const S = YTaqSettings;
	const FIRST = 'channels';
	const PERF_KEYS = Object.keys(S.defaults('perf'));
	const THEME_BLOCK = /^\[data-ytaq-theme~="([a-z]+)"\] \{/gm;
	const ACCENT_BLOCK = /^\[data-ytaq-theme~="([a-z]+)"\]\[data-ytaq-theme~="([a-z]+)"\] \{/gm;

	function $(section, cls) {
		return document.querySelector(`.ytaq-section-${section} .ytaq-${cls}`);
	}

	function applyTheme(t) {
		document.documentElement.setAttribute('data-ytaq-theme', t.theme + ' ' + t.accent);
	}

	async function loadPalette() {
		const css = await (await fetch(chrome.runtime.getURL('ytaq-palette.css'))).text();
		const map = new Map();
		for (const m of css.matchAll(THEME_BLOCK)) map.set(m[1], []);
		for (const m of css.matchAll(ACCENT_BLOCK)) if (map.has(m[1])) map.get(m[1]).push(m[2]);
		return map;
	}

	function fillSelect(select, values, selected) {
		select.replaceChildren(...values.map(v => {
			const option = document.createElement('option');
			option.value = v;
			option.textContent = v;
			return option;
		}));
		select.value = values.includes(selected) ? selected : values[0];
	}

	let palette = new Map();

	function ruleRow(rule) {
		const row = document.createElement('div');
		row.className = 'ytaq-title-rule';
		row.setAttribute('data-ytaq-layout', 'row middle wrap');
		const on = document.createElement('input');
		on.type = 'checkbox';
		on.className = 'ytaq-title-on';
		on.checked = !!rule.on;
		on.setAttribute('aria-label', 'このルールを使う');
		const pattern = document.createElement('input');
		pattern.type = 'text';
		pattern.className = 'ytaq-title-pattern';
		pattern.value = rule.pattern;
		pattern.placeholder = '正規表現';
		const replace = document.createElement('input');
		replace.type = 'text';
		replace.className = 'ytaq-title-replace';
		replace.value = rule.replace;
		replace.placeholder = '置き換え先（空なら消す）';
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.textContent = '削除';
		remove.setAttribute('data-ytaq-button', '');
		remove.addEventListener('click', () => {
			row.remove();
			SECTIONS.antibite.test();
		});
		row.append(on, pattern, replace, remove);
		return row;
	}

	function readRules() {
		return [...document.querySelectorAll('.ytaq-section-antibite .ytaq-title-rule')].map(row => ({
			pattern: row.querySelector('.ytaq-title-pattern').value,
			replace: row.querySelector('.ytaq-title-replace').value,
			on: row.querySelector('.ytaq-title-on').checked
		}));
	}

	const SECTIONS = {
		theme: {
			names: ['theme', 'searchGrid', 'watchWide', 'watchFitInfo', 'watchSide', 'watchRelated', 'watchDescBelow', 'watchCloseReplay'],
			async init() {
				palette = await loadPalette();
				const name = $('theme', 'theme-name');
				const accent = $('theme', 'theme-accent');
				name.addEventListener('change', () => {
					fillSelect(accent, palette.get(name.value) || [], accent.value);
					applyTheme(this.collect().theme);
				});
				accent.addEventListener('change', () => applyTheme(this.collect().theme));
			},
			render(v) {
				const name = $('theme', 'theme-name');
				fillSelect(name, [...palette.keys()], v.theme.theme);
				fillSelect($('theme', 'theme-accent'), palette.get(name.value) || [], v.theme.accent);
				$('theme', 'searchGrid').checked = !!v.searchGrid;
				$('theme', 'watchWide').checked = !!v.watchWide;
				$('theme', 'watchFitInfo').checked = !!v.watchFitInfo;
				$('theme', 'watchSide').checked = !!v.watchSide;
				$('theme', 'watchRelated').checked = !!v.watchRelated;
				$('theme', 'watchDescBelow').checked = !!v.watchDescBelow;
				$('theme', 'watchCloseReplay').checked = !!v.watchCloseReplay;
				applyTheme(this.collect().theme);
			},
			collect() {
				return {
					theme: { theme: $('theme', 'theme-name').value, accent: $('theme', 'theme-accent').value },
					searchGrid: $('theme', 'searchGrid').checked,
					watchWide: $('theme', 'watchWide').checked,
					watchFitInfo: $('theme', 'watchFitInfo').checked,
					watchSide: $('theme', 'watchSide').checked,
					watchRelated: $('theme', 'watchRelated').checked,
					watchDescBelow: $('theme', 'watchDescBelow').checked,
					watchCloseReplay: $('theme', 'watchCloseReplay').checked
				};
			}
		},

		perf: {
			names: ['perf', 'click', 'embedReferer', 'embedLogin', 'watchHistory', 'popupResume', 'popupInfo'],
			render(v) {
				for (const k of PERF_KEYS) $('perf', 'perf-' + k).checked = !!v.perf[k];
				$('perf', 'click').value = v.click;
				$('perf', 'embedReferer').value = v.embedReferer;
				$('perf', 'embedLogin').checked = !!v.embedLogin;
				$('perf', 'watchHistory').checked = !!v.watchHistory;
				$('perf', 'popupResume').checked = !!v.popupResume;
				for (const cb of document.querySelectorAll('.ytaq-popup-info-options input')) cb.checked = !!v.popupInfo[cb.value];
			},
			collect() {
				const perf = {};
				for (const k of PERF_KEYS) perf[k] = $('perf', 'perf-' + k).checked;
				return {
					perf,
					click: $('perf', 'click').value,
					embedReferer: $('perf', 'embedReferer').value.trim() || S.defaults('embedReferer'),
					embedLogin: $('perf', 'embedLogin').checked,
					watchHistory: $('perf', 'watchHistory').checked,
					popupResume: $('perf', 'popupResume').checked,
					popupInfo: Object.fromEntries([...document.querySelectorAll('.ytaq-popup-info-options input')].map(cb => [cb.value, cb.checked]))
				};
			}
		},

		antibite: {
			names: ['antibite', 'titleClean'],
			init() {
				$('antibite', 'thumbnailEnabled').addEventListener('change', () => this.sync());
				$('antibite', 'title-add').addEventListener('click', () => {
					$('antibite', 'title-rules').append(ruleRow({ pattern: '', replace: '', on: true }));
				});
				$('antibite', 'title-rules').addEventListener('input', () => this.test());
				$('antibite', 'title-rules').addEventListener('change', () => this.test());
				$('antibite', 'title-test').addEventListener('input', () => this.test());
			},
			test() {
				const input = $('antibite', 'title-test');
				const out = $('antibite', 'title-result');
				const sample = input.value || input.placeholder;
				let text = sample;
				for (const r of readRules()) {
					if (!r.on || !r.pattern) continue;
					try {
						text = text.replace(new RegExp(r.pattern, 'g'), r.replace);
					} catch (e) {
						out.textContent = '正規表現が正しくありません: ' + r.pattern;
						return;
					}
				}
				out.textContent = '→ ' + (text.trim() ? text.trim() : sample);
			},
			sync() {
				$('antibite', 'thumbnailFrame').disabled = !$('antibite', 'thumbnailEnabled').checked;
				$('antibite', 'shortsVertical').disabled = !$('antibite', 'thumbnailEnabled').checked;
			},
			render(v) {
				$('antibite', 'thumbnailEnabled').checked = !!v.antibite.thumbnailEnabled;
				$('antibite', 'thumbnailFrame').value = v.antibite.thumbnailFrame;
				$('antibite', 'shortsVertical').checked = !!v.antibite.shortsVertical;
				this.sync();
				for (const cb of document.querySelectorAll('.ytaq-section-antibite .ytaq-title-place')) {
					cb.checked = !!v.titleClean.places[cb.value];
				}
				$('antibite', 'title-rules').replaceChildren(...v.titleClean.rules.map(ruleRow));
				this.test();
			},
			collect() {
				const rules = readRules().filter(r => r.pattern);
				for (const r of rules) {
					try {
						new RegExp(r.pattern, 'g');
					} catch (e) {
						return '正規表現が正しくありません: ' + r.pattern;
					}
				}
				const places = {};
				for (const cb of document.querySelectorAll('.ytaq-section-antibite .ytaq-title-place')) places[cb.value] = cb.checked;
				return {
					antibite: {
						thumbnailEnabled: $('antibite', 'thumbnailEnabled').checked,
						thumbnailFrame: $('antibite', 'thumbnailFrame').value,
						shortsVertical: $('antibite', 'shortsVertical').checked
					},
					titleClean: { places, rules }
				};
			}
		},

		mute: {
			names: ['mute', 'hideWatched'],
			channels: [],
			renderChannels() {
				const box = $('mute', 'muteChannels');
				if (!this.channels.length) {
					const p = document.createElement('p');
					p.setAttribute('data-ytaq', 'note');
					p.textContent = 'ミュートしたチャンネルはありません。';
					box.replaceChildren(p);
					return;
				}
				box.replaceChildren(...this.channels.map((c, i) => {
					const row = document.createElement('div');
					row.setAttribute('data-ytaq-layout', 'row');
					const name = document.createElement('span');
					name.textContent = c.name || c.handle || c.id;
					const sub = document.createElement('span');
					sub.setAttribute('data-ytaq', 'note');
					sub.textContent = c.handle || c.id || '';
					row.append(name, sub, button('解除', { 'data-ytaq-button': 'outline' }, () => {
						this.channels.splice(i, 1);
						this.renderChannels();
					}));
					return row;
				}));
			},
			render(v) {
				$('mute', 'words').value = v.mute.words.join('\n');
				$('mute', 'commentWords').checked = !!v.mute.commentWords;
				this.channels = (v.mute.channels || []).slice();
				this.renderChannels();
				$('mute', 'watchedPercent').value = v.hideWatched.percent;
				for (const cb of document.querySelectorAll('.ytaq-watchedPlaces input')) cb.checked = !!v.hideWatched.places[cb.value];
			},
			collect() {
				const words = $('mute', 'words').value.split('\n').map(w => w.trim()).filter(Boolean);
				for (const w of words) {
					const m = /^\/(.+)\/([a-z]*)$/.exec(w);
					if (!m) continue;
					try {
						new RegExp(m[1], m[2]);
					} catch (e) {
						return '正規表現が正しくありません: ' + w;
					}
				}
				const percent = Math.round(Number($('mute', 'watchedPercent').value));
				if (!(percent >= 1 && percent <= 100)) return '見た割合は 1〜100 で入れてください。';
				const places = Object.fromEntries([...document.querySelectorAll('.ytaq-watchedPlaces input')].map(cb => [cb.value, cb.checked]));
				return {
					mute: { words, channels: this.channels, commentWords: $('mute', 'commentWords').checked },
					hideWatched: { percent, places }
				};
			}
		},

		playbackrate: {
			names: ['playbackrate'],
			render(v) {
				$('playbackrate', 'speedStep').value = v.playbackrate.speedStep;
				$('playbackrate', 'speedPresets').value = v.playbackrate.speedPresets.join(', ');
			},
			collect() {
				const speedStep = parseFloat($('playbackrate', 'speedStep').value);
				const speedPresets = $('playbackrate', 'speedPresets').value
					.split(',')
					.map(s => parseFloat(s.trim()))
					.filter(n => !isNaN(n) && n > 0 && n <= 16);
				if (isNaN(speedStep) || speedStep < 0.05 || speedStep > 1.0) {
					return '増減量は0.05〜1.0の範囲で入力してください。';
				}
				if (speedPresets.length === 0) return 'プリセット速度を最低1つ入力してください。';
				return { playbackrate: { speedStep, speedPresets } };
			}
		}
	};

	function showMessage(section, text, tone) {
		const slot = document.querySelector(`.ytaq-section-${section} .ytaq-message`);
		const p = document.createElement('p');
		p.setAttribute('data-ytaq-item', 'notice');
		p.setAttribute('data-ytaq', tone);
		p.textContent = text;
		slot.replaceChildren(p);
		setTimeout(() => { if (p.parentNode) p.remove(); }, 3000);
	}

	async function load(section) {
		const def = SECTIONS[section];
		const values = {};
		for (const n of def.names) values[n] = await S.get(n);
		def.render(values);
	}

	async function save(section) {
		const result = SECTIONS[section].collect();
		if (typeof result === 'string') return showMessage(section, result, 'error');
		for (const n of Object.keys(result)) await S.set(n, result[n]);
		showMessage(section, '保存しました。開いている YouTube のタブに即反映されます。', 'success');
	}

	async function reset(section) {
		if (!confirm('デフォルト設定に戻しますか？')) return;
		await S.reset(SECTIONS[section].names);
		await load(section);
		showMessage(section, 'デフォルト設定に戻しました。', 'success');
	}

	function show(section) {
		for (const b of document.querySelectorAll('.ytaq-nav')) {
			if (b.value === section) b.setAttribute('aria-current', 'page');
			else b.removeAttribute('aria-current');
		}
		for (const s of document.querySelectorAll('.ytaq-section')) {
			s.hidden = !s.classList.contains('ytaq-section-' + section);
		}
	}

	S.get('theme').then(applyTheme);

	document.addEventListener('DOMContentLoaded', async () => {
		for (const b of document.querySelectorAll('.ytaq-nav')) {
			b.addEventListener('click', () => show(b.value));
		}
		show(FIRST);

		for (const section of Object.keys(SECTIONS)) {
			const def = SECTIONS[section];
			if (def.init) await def.init();
			await load(section);
			document.querySelector(`.ytaq-section-${section} .ytaq-save`).addEventListener('click', () => save(section));
			document.querySelector(`.ytaq-section-${section} .ytaq-reset`).addEventListener('click', () => reset(section));
		}

		YTaqFolders.watch(renderFolders);
		initChannels();
		initBackup();
		const shortsBox = document.querySelector('.ytaq-feed-shorts');
		S.watch('feedShorts', v => { shortsBox.checked = !!v; });
		shortsBox.addEventListener('change', () => S.set('feedShorts', shortsBox.checked));
	});

	const BACKUP_SKIP = new Set(['ytaq_feed', 'ytaq_short_owners', 'ytaq_subs', 'ytaq_channel_handles', 'ytaq_innertube', 'ytaq_channel_lists', 'ytaq_playbackrate']);

	function backupKeys(all) {
		return Object.keys(all).filter(k => k.startsWith('ytaq_') && !BACKUP_SKIP.has(k));
	}

	function initBackup() {
		const file = document.querySelector('.ytaq-backup-file');
		document.querySelector('.ytaq-backup-export').addEventListener('click', async () => {
			const all = await new Promise(ok => chrome.storage.local.get(null, ok));
			const data = Object.fromEntries(backupKeys(all).map(k => [k, all[k]]));
			const body = JSON.stringify({ app: 'YTaq', version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), data }, null, 2);
			const a = document.createElement('a');
			a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
			a.download = 'ytaq-' + new Date().toISOString().slice(0, 10) + '.json';
			a.click();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
			showMessage('backup', '書き出しました。', 'success');
		});
		document.querySelector('.ytaq-backup-import').addEventListener('click', () => file.click());
		file.addEventListener('change', async () => {
			const f = file.files[0];
			file.value = '';
			if (!f) return;
			let parsed;
			try {
				parsed = JSON.parse(await f.text());
			} catch (e) {
				return showMessage('backup', 'ファイルを読めませんでした。', 'error');
			}
			if (!parsed || parsed.app !== 'YTaq' || !parsed.data || typeof parsed.data !== 'object') {
				return showMessage('backup', 'YTaq の書き出したファイルではありません。', 'error');
			}
			const incoming = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k.startsWith('ytaq_') && !BACKUP_SKIP.has(k)));
			if (!confirm('今の設定・フォルダ・ミュート・速度を、このファイルの中身に入れ替えます。')) return;
			const all = await new Promise(ok => chrome.storage.local.get(null, ok));
			await new Promise(ok => chrome.storage.local.remove(backupKeys(all), ok));
			await new Promise(ok => chrome.storage.local.set(incoming, ok));
			location.reload();
		});
	}

	function button(label, attrs, fn) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = label;
		for (const k in attrs) b.setAttribute(k, attrs[k]);
		b.addEventListener('click', fn);
		return b;
	}

	function folderCard(data, folder, index) {
		const card = document.createElement('div');
		card.setAttribute('data-ytaq-tray', '');
		card.setAttribute('data-ytaq-layout', 'stack');

		const row = document.createElement('div');
		row.setAttribute('data-ytaq-layout', 'row middle wrap');
		const name = document.createElement('input');
		name.type = 'text';
		name.value = folder.name;
		name.setAttribute('aria-label', 'フォルダの名前');
		const commit = () => {
			const v = name.value.trim();
			if (v && v !== folder.name) YTaqFolders.renameFolder(folder.id, v);
			else name.value = folder.name;
		};
		name.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) name.blur(); });
		name.addEventListener('blur', commit);

		const up = button('上へ', { 'data-ytaq-button': 'outline' }, () => YTaqFolders.moveFolder(folder.id, -1));
		up.disabled = index === 0;
		const down = button('下へ', { 'data-ytaq-button': 'outline' }, () => YTaqFolders.moveFolder(folder.id, 1));
		down.disabled = index === data.folders.length - 1;
		const del = button('削除', { 'data-ytaq-button': 'outline', 'data-ytaq': 'error' }, () => {
			if (del.dataset.confirm) return YTaqFolders.deleteFolder(folder.id);
			del.dataset.confirm = '1';
			del.textContent = '本当に削除';
		});
		row.append(name, up, down, del);
		card.append(row);

		if (!folder.channels.length) {
			const p = document.createElement('p');
			p.setAttribute('data-ytaq', 'note');
			p.textContent = 'チャンネルが入っていません';
			card.append(p);
		}
		for (const id of folder.channels) {
			const line = document.createElement('div');
			line.setAttribute('data-ytaq-layout', 'row middle between');
			const label = document.createElement('a');
			label.href = 'https://www.youtube.com/channel/' + id;
			label.target = '_blank';
			label.rel = 'noopener';
			label.textContent = (data.channels[id] || {}).name || id;
			line.append(label, button('外す', { 'data-ytaq-button': '' }, () => YTaqFolders.removeChannel(folder.id, id)));
			card.append(line);
		}
		return card;
	}

	let channelState = { rates: {}, subs: { fetchedAt: 0, channels: [] }, folders: { folders: [], channels: {} } };

	const seen = new Map();
	const hasSettings = new Map();

	function configured(id) {
		const { rates, folders } = channelState;
		return !!rates[id] || folders.folders.some(f => f.channels.includes(id));
	}

	function allChannels() {
		const { rates, subs, folders } = channelState;
		for (const c of subs.channels) seen.set(c.id, c);
		for (const id of Object.keys(rates)) if (!seen.has(id)) seen.set(id, { id, name: rates[id].name });
		for (const f of folders.folders) {
			for (const id of f.channels) if (!seen.has(id)) seen.set(id, { id, name: (folders.channels[id] || {}).name || id });
		}
		const list = [...seen.values()].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'ja'));
		for (const c of list) if (!hasSettings.has(c.id)) hasSettings.set(c.id, configured(c.id));
		return list;
	}

	function channelRow(c) {
		const { rates, folders, subs } = channelState;
		const row = document.createElement('div');
		row.className = 'ytaq-channel-row';
		row.dataset.name = c.name.toLowerCase();
		row.setAttribute('data-ytaq-tray', '');
		row.setAttribute('data-ytaq-layout', 'row middle wrap between');

		const head = document.createElement('div');
		head.setAttribute('data-ytaq-layout', 'row middle wrap');
		if (c.avatar) {
			const img = document.createElement('img');
			img.src = c.avatar;
			img.alt = '';
			img.loading = 'lazy';
			img.referrerPolicy = 'no-referrer';
			img.setAttribute('data-ytaq-item', 'circle');
			head.append(img);
		}
		const name = document.createElement('a');
		name.href = 'https://www.youtube.com/channel/' + c.id;
		name.target = '_blank';
		name.rel = 'noopener';
		name.textContent = c.name;
		head.append(name);
		if (subs.fetchedAt && !subs.channels.some(x => x.id === c.id)) {
			const tag = document.createElement('span');
			tag.textContent = '未登録';
			tag.setAttribute('data-ytaq-item', 'tag');
			head.append(tag);
		}

		const speed = document.createElement('div');
		speed.setAttribute('data-ytaq-layout', 'row middle wrap');
		const label = document.createElement('label');
		label.setAttribute('data-ytaq-layout', 'row middle');
		const input = document.createElement('input');
		input.type = 'number';
		input.step = '0.05';
		input.min = '0.25';
		input.max = '16';
		input.className = 'ytaq-channel-rate';
		input.placeholder = '未設定';
		input.value = rates[c.id] ? rates[c.id].rate : '';
		input.addEventListener('change', () => {
			const rate = parseFloat(input.value);
			if (!(rate >= 0.25 && rate <= 16)) {
				input.value = rates[c.id] ? rates[c.id].rate : '';
				return;
			}
			YTaqChannels.setRate(c.id, c.name, rate);
		});
		label.append('再生速度', input);
		const clear = button('消す', { 'data-ytaq-button': '' }, () => YTaqChannels.clearRate(c.id));
		clear.disabled = !rates[c.id];
		speed.append(label, clear);

		const boxes = document.createElement('div');
		boxes.setAttribute('data-ytaq-layout', 'row middle wrap');
		for (const f of folders.folders) {
			const l = document.createElement('label');
			const cb = document.createElement('input');
			cb.type = 'checkbox';
			cb.checked = f.channels.includes(c.id);
			cb.addEventListener('change', () => YTaqFolders.toggle(f.id, { id: c.id, name: c.name }));
			l.append(cb, ' ' + f.name);
			boxes.append(l);
		}

		const controls = document.createElement('div');
		controls.setAttribute('data-ytaq-layout', 'row middle wrap');
		controls.append(speed);
		if (folders.folders.length) controls.append(boxes);
		row.append(head, controls);
		return row;
	}

	function filterChannels() {
		const q = document.querySelector('.ytaq-channel-search').value.trim().toLowerCase();
		for (const row of document.querySelectorAll('.ytaq-channel-row')) {
			row.hidden = !!q && !row.dataset.name.includes(q);
		}
		for (const group of document.querySelectorAll('.ytaq-channel-group')) {
			group.hidden = !group.querySelector('.ytaq-channel-row:not([hidden])');
		}
	}

	function renderChannels() {
		const box = document.querySelector('.ytaq-channel-list');
		if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') return;
		const list = allChannels();
		if (!list.length) {
			const p = document.createElement('p');
			p.setAttribute('data-ytaq', 'note');
			p.textContent = 'まだチャンネルがありません。ログインした状態で YouTube を開くと、登録チャンネルを読み込みます。';
			box.replaceChildren(p);
			return;
		}
		box.replaceChildren(...[['設定あり', true], ['設定なし', false]].flatMap(([title, flag]) => {
			const rows = list.filter(c => hasSettings.get(c.id) === flag);
			if (!rows.length) return [];
			const group = document.createElement('div');
			group.className = 'ytaq-channel-group';
			group.setAttribute('data-ytaq-layout', 'stack');
			const h = document.createElement('h3');
			h.textContent = `${title}（${rows.length}）`;
			h.setAttribute('data-ytaq-text', 'fs-16 fw-700');
			group.append(h, ...rows.map(channelRow));
			return [group];
		}));
		filterChannels();
	}

	function initChannels() {
		document.querySelector('.ytaq-channel-search').addEventListener('input', filterChannels);
		let gotChannels = false;
		let gotFolders = false;
		YTaqChannels.watch(v => {
			channelState.rates = v.rates;
			channelState.subs = v.subs;
			gotChannels = true;
			if (gotFolders) renderChannels();
		});
		YTaqFolders.watch(v => {
			channelState.folders = v;
			gotFolders = true;
			if (gotChannels) renderChannels();
		});
	}

	function renderFolders(data) {
		const box = document.querySelector('.ytaq-folders');
		if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
		if (!data.folders.length) {
			const p = document.createElement('p');
			p.setAttribute('data-ytaq', 'note');
			p.textContent = 'フォルダがありません。YouTube のチャンネルのページや動画の下のフォルダのボタンから作れます。';
			box.replaceChildren(p);
			return;
		}
		box.replaceChildren(...data.folders.map((f, i) => folderCard(data, f, i)));
	}
})();
