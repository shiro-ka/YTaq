(function () {
	'use strict';

	const S = YTaqSettings;
	const PERF_KEYS = Object.keys(S.defaults('perf'));
	const THEME_BLOCK = /^\[data-ytaq-theme~="([a-z]+)"\] \{/gm;
	const ACCENT_BLOCK = /^\[data-ytaq-theme~="([a-z]+)"\]\[data-ytaq-theme~="([a-z]+)"\] \{/gm;

	function $(cls) {
		return document.querySelector('.ytaq-' + cls);
	}

	function applyTheme(t) {
		YTaqColor.apply(document.documentElement, t);
	}

	const SEMANTIC_NAMES = { error: 'エラー', warning: '注意', success: '成功' };

	function hueBand(colorAt) {
		const stops = [];
		for (let h = 0; h <= 360; h += 15) stops.push(colorAt(h % 360));
		return `linear-gradient(to right, ${stops.join(', ')})`;
	}

	async function loadPalette() {
		const css = await (await fetch(chrome.runtime.getURL('ytaq-palette.css'))).text();
		const map = new Map();
		for (const m of css.matchAll(THEME_BLOCK)) map.set(m[1], []);
		for (const m of css.matchAll(ACCENT_BLOCK)) if (map.has(m[1])) map.get(m[1]).push(m[2]);
		return map;
	}

	function fillSelect(select, values, selected, custom) {
		const all = custom ? [...values, 'custom'] : values;
		select.replaceChildren(...all.map(v => {
			const option = document.createElement('option');
			option.value = v;
			option.textContent = v === 'custom' ? 'カスタム' : v;
			return option;
		}));
		select.value = all.includes(selected) ? selected : all[0];
	}

	let palette = new Map();

	function ruleRow(rule) {
		const row = document.createElement('div');
		row.className = 'ytaq-title-rule';
		row.classList.add('row', 'middle', 'wrap');
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
		remove.classList.add('button');
		remove.addEventListener('click', () => {
			row.remove();
			SECTIONS.antibite.test();
			saveSoon();
		});
		row.append(on, pattern, replace, remove);
		return row;
	}

	function readRules() {
		return [...document.querySelectorAll('.ytaq-title-rule')].map(row => ({
			pattern: row.querySelector('.ytaq-title-pattern').value,
			replace: row.querySelector('.ytaq-title-replace').value,
			on: row.querySelector('.ytaq-title-on').checked
		}));
	}

	function pressed(box) {
		return Object.fromEntries([...document.querySelectorAll(box + ' button')].map(b => [b.value, b.getAttribute('aria-pressed') === 'true']));
	}

	function press(box, values) {
		for (const b of document.querySelectorAll(box + ' button')) b.setAttribute('aria-pressed', String(!!values[b.value]));
	}

	function lines(text) {
		return text.split('\n').map(s => s.trim()).filter(Boolean);
	}

	const SECTIONS = {
		theme: {
			names: ['theme'],
			async init() {
				palette = await loadPalette();
				const name = $('theme-name');
				const accent = $('theme-accent');
				const update = () => {
					const t = this.collect().theme;
					applyTheme(t);
					this.sliders(t);
				};
				name.addEventListener('change', () => {
					fillSelect(accent, this.accents(name.value), accent.value, true);
					update();
				});
				accent.addEventListener('change', update);
				$('primary-hue').addEventListener('input', update);
				$('accent-hue').addEventListener('input', update);
			},
			accents(theme) {
				return palette.get(theme === 'custom' ? YTaqColor.CUSTOM_BASE : theme) || [];
			},
			sliders(t) {
				const primary = $('primary-hue');
				const accent = $('accent-hue');
				primary.closest('label').hidden = t.theme !== 'custom';
				accent.closest('label').hidden = t.accent !== 'custom';
				primary.style.background = hueBand(h => YTaqColor.primarySwatch(h));
				accent.style.background = hueBand(h => YTaqColor.accentSwatch(t, h));
				const near = YTaqColor.nearSemantic(t);
				const note = $('accent-note');
				note.hidden = !near;
				note.textContent = near ? `${SEMANTIC_NAMES[near]}の色と見分けにくい色です` : '';
			},
			render(v) {
				const name = $('theme-name');
				fillSelect(name, [...palette.keys()], v.theme.theme, true);
				fillSelect($('theme-accent'), this.accents(name.value), v.theme.accent, true);
				$('primary-hue').value = v.theme.primaryHue;
				$('accent-hue').value = v.theme.accentHue;
				const t = this.collect().theme;
				applyTheme(t);
				this.sliders(t);
			},
			collect() {
				return {
					theme: {
						theme: $('theme-name').value,
						accent: $('theme-accent').value,
						primaryHue: Number($('primary-hue').value),
						accentHue: Number($('accent-hue').value)
					}
				};
			}
		},

		look: {
			names: ['customCss', 'searchGrid', 'cardHeader', 'hideCardBadges', 'compactCards', 'watchWide', 'watchFitInfo', 'watchSide', 'watchRelated', 'watchDescBelow', 'watchCloseReplay'],
			sync() {
				document.querySelector('.ytaq-compact[value="search"]').disabled = !$('searchGrid').checked;
				const wide = $('watchWide').checked;
				for (const o of document.querySelectorAll('.ytaq-dep-wide')) {
					o.classList.toggle('ytaq-off', !wide);
					for (const i of o.querySelectorAll('input')) i.disabled = !wide;
				}
			},
			render(v) {
				$('customCss').value = v.customCss || '';
				$('searchGrid').checked = !!v.searchGrid;
				$('cardHeader').checked = !!v.cardHeader;
				$('hideCardBadges').checked = !!v.hideCardBadges;
				for (const cb of document.querySelectorAll('.ytaq-compact')) cb.checked = !!v.compactCards[cb.value];
				for (const k of ['watchWide', 'watchFitInfo', 'watchSide', 'watchRelated', 'watchDescBelow', 'watchCloseReplay']) $(k).checked = !!v[k];
				this.sync();
			},
			collect() {
				this.sync();
				const out = {
					customCss: $('customCss').value,
					searchGrid: $('searchGrid').checked,
					cardHeader: $('cardHeader').checked,
					hideCardBadges: $('hideCardBadges').checked,
					compactCards: Object.fromEntries([...document.querySelectorAll('.ytaq-compact')].map(cb => [cb.value, cb.checked]))
				};
				for (const k of ['watchWide', 'watchFitInfo', 'watchSide', 'watchRelated', 'watchDescBelow', 'watchCloseReplay']) out[k] = $(k).checked;
				return out;
			}
		},

		perf: {
			names: ['perf', 'shortsHide', 'click', 'embedReferer', 'embedLogin', 'watchHistory', 'popupResume', 'popupInfo'],
			render(v) {
				for (const k of PERF_KEYS) $('perf-' + k).checked = !!v.perf[k];
				press('.ytaq-shortsPlaces', v.shortsHide);
				$('click').value = v.click;
				$('embedReferer').value = v.embedReferer;
				$('embedLogin').checked = !!v.embedLogin;
				$('watchHistory').checked = !!v.watchHistory;
				$('popupResume').checked = !!v.popupResume;
				for (const cb of document.querySelectorAll('.ytaq-popupInfo input')) cb.checked = !!v.popupInfo[cb.value];
			},
			collect() {
				const perf = {};
				for (const k of PERF_KEYS) perf[k] = $('perf-' + k).checked;
				return {
					perf,
					shortsHide: pressed('.ytaq-shortsPlaces'),
					click: $('click').value,
					embedReferer: $('embedReferer').value.trim() || S.defaults('embedReferer'),
					embedLogin: $('embedLogin').checked,
					watchHistory: $('watchHistory').checked,
					popupResume: $('popupResume').checked,
					popupInfo: Object.fromEntries([...document.querySelectorAll('.ytaq-popupInfo input')].map(cb => [cb.value, cb.checked]))
				};
			}
		},

		antibite: {
			names: ['antibite', 'titleClean'],
			init() {
				$('title-add').addEventListener('click', () => {
					$('title-rules').append(ruleRow({ pattern: '', replace: '', on: true }));
				});
				$('title-rules').addEventListener('input', () => this.test());
				$('title-rules').addEventListener('change', () => this.test());
				$('title-test').addEventListener('input', () => this.test());
			},
			test() {
				const input = $('title-test');
				const out = $('title-result');
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
				const on = $('thumbnailEnabled').checked;
				for (const o of document.querySelectorAll('.ytaq-dep-thumb')) {
					o.classList.toggle('ytaq-off', !on);
					for (const i of o.querySelectorAll('input, select')) i.disabled = !on;
				}
			},
			render(v) {
				$('thumbnailEnabled').checked = !!v.antibite.thumbnailEnabled;
				$('thumbnailFrame').value = v.antibite.thumbnailFrame;
				$('shortsVertical').checked = !!v.antibite.shortsVertical;
				this.sync();
				for (const cb of document.querySelectorAll('.ytaq-title-place')) cb.checked = !!v.titleClean.places[cb.value];
				$('title-rules').replaceChildren(...v.titleClean.rules.map(ruleRow));
				this.test();
			},
			collect() {
				this.sync();
				const rules = readRules().filter(r => r.pattern);
				for (const r of rules) {
					try {
						new RegExp(r.pattern, 'g');
					} catch (e) {
						return '正規表現が正しくありません: ' + r.pattern;
					}
				}
				const places = {};
				for (const cb of document.querySelectorAll('.ytaq-title-place')) places[cb.value] = cb.checked;
				return {
					antibite: {
						thumbnailEnabled: $('thumbnailEnabled').checked,
						thumbnailFrame: $('thumbnailFrame').value,
						shortsVertical: $('shortsVertical').checked
					},
					titleClean: { places, rules }
				};
			}
		},

		mute: {
			names: ['mute', 'hideWatched', 'homeHide', 'membersOnly'],
			channels: [],
			renderChannels() {
				const box = $('muteChannels');
				if (!this.channels.length) {
					const p = document.createElement('span');
					p.classList.add('note');
					p.textContent = 'まだありません';
					box.replaceChildren(p);
					return;
				}
				box.replaceChildren(...this.channels.map((c, i) => {
					const tag = document.createElement('span');
					tag.classList.add('tag');
					tag.title = c.handle || c.id || '';
					tag.append(c.name || c.handle || c.id, button('×', 'ytaq-tag-x', () => {
						this.channels.splice(i, 1);
						this.renderChannels();
						saveSoon();
					}));
					tag.lastChild.setAttribute('aria-label', '解除');
					return tag;
				}));
			},
			render(v) {
				$('words').value = v.mute.words.join('\n');
				$('commentWords').checked = !!v.mute.commentWords;
				this.channels = (v.mute.channels || []).slice();
				this.renderChannels();
				$('watchedPercent').value = v.hideWatched.percent;
				press('.ytaq-watchedPlaces', v.hideWatched.places);
				$('homeHideShelves').checked = !!v.homeHide.shelves;
				$('homeHidePlaylists').checked = !!v.homeHide.playlists;
				$('membersHide').checked = !!v.membersOnly.hide;
				$('membersExtra').value = (v.membersOnly.extra || []).join('\n');
				chrome.storage.local.get(['ytaq_memberships'], r => {
					const m = r.ytaq_memberships;
					const list = m ? [...(m.handles || []), ...(m.ids || [])] : [];
					$('membersJoined').textContent = !m ? 'まだ読み取っていません。YouTube を開くと読み取ります。' : list.length ? '読み取ったチャンネル: ' + list.join('、') : '読み取ったチャンネルはありません。';
				});
			},
			collect() {
				const words = lines($('words').value);
				for (const w of words) {
					const m = /^\/(.+)\/([a-z]*)$/.exec(w);
					if (!m) continue;
					try {
						new RegExp(m[1], m[2]);
					} catch (e) {
						return '正規表現が正しくありません: ' + w;
					}
				}
				const percent = Math.round(Number($('watchedPercent').value));
				if (!(percent >= 1 && percent <= 100)) return '見た割合は 1〜100 で入れてください';
				return {
					mute: { words, channels: this.channels, commentWords: $('commentWords').checked },
					hideWatched: { percent, places: pressed('.ytaq-watchedPlaces') },
					homeHide: { shelves: $('homeHideShelves').checked, playlists: $('homeHidePlaylists').checked },
					membersOnly: { hide: $('membersHide').checked, extra: lines($('membersExtra').value) }
				};
			}
		},

		playbackrate: {
			names: ['playbackrate', 'musicNormalRate'],
			render(v) {
				$('musicNormalRate').checked = !!v.musicNormalRate;
				$('speedStep').value = v.playbackrate.speedStep;
				$('speedPresets').value = v.playbackrate.speedPresets.join(', ');
			},
			collect() {
				const speedStep = parseFloat($('speedStep').value);
				const speedPresets = $('speedPresets').value
					.split(',')
					.map(s => parseFloat(s.trim()))
					.filter(n => !isNaN(n) && n > 0 && n <= 16);
				if (isNaN(speedStep) || speedStep < 0.05 || speedStep > 1.0) return '変える量は 0.05〜1.0 で入れてください';
				if (speedPresets.length === 0) return '切り替わる速度を1つ以上入れてください';
				return { playbackrate: { speedStep, speedPresets }, musicNormalRate: $('musicNormalRate').checked };
			}
		}
	};

	let toastTimer = 0;
	function toast(text, tone) {
		const el = $('status');
		el.textContent = text;
		el.classList.remove('success', 'error');
		if (tone) el.classList.add(tone);
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			el.textContent = '';
			el.classList.remove('success', 'error');
		}, tone === 'error' ? 4000 : 1400);
	}

	const saved = {};
	let loaded = false;

	async function loadAll() {
		for (const def of Object.values(SECTIONS)) {
			const values = {};
			for (const n of def.names) {
				values[n] = await S.get(n);
				saved[n] = JSON.stringify(values[n]);
			}
			def.render(values);
		}
		loaded = true;
		updatePreviews();
	}

	async function saveAll() {
		if (!loaded) return;
		let changed = false;
		for (const def of Object.values(SECTIONS)) {
			const result = def.collect();
			if (typeof result === 'string') {
				toast(result, 'error');
				continue;
			}
			for (const [n, value] of Object.entries(result)) {
				const json = JSON.stringify(value);
				if (saved[n] === json) continue;
				saved[n] = json;
				await S.set(n, value);
				changed = true;
			}
		}
		if (changed) toast('保存しました', 'success');
	}

	let saveTimer = 0;
	function saveSoon(delay) {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(saveAll, delay || 0);
	}

	async function resetPage(page) {
		const paths = (page.dataset.reset || '').split(/\s+/).filter(Boolean);
		for (const path of paths) {
			const [name, key] = path.split('.');
			if (!key) {
				await S.set(name, S.defaults(name));
				continue;
			}
			const value = await S.get(name);
			value[key] = S.defaults(name)[key];
			await S.set(name, value);
		}
		await loadAll();
		toast('既定に戻しました', 'success');
	}

	function show() {
		const key = (location.hash || '#top').slice(1);
		const pages = [...document.querySelectorAll('.ytaq-page')];
		const target = pages.find(p => p.dataset.page === key) || pages[0];
		for (const p of pages) p.hidden = p !== target;
		for (const a of document.querySelectorAll('.toc a')) {
			if (a.getAttribute('href') === '#' + target.dataset.page) a.setAttribute('aria-current', 'page');
			else a.removeAttribute('aria-current');
		}
		const menu = document.querySelector('nav[popover]');
		try {
			if (menu.matches(':popover-open') && matchMedia('(max-width: 1023.98px)').matches) menu.hidePopover();
		} catch (e) {}
		window.scrollTo(0, 0);
	}

	const PARTS = '.ytaq-yt-chips, .ytaq-yt-card, .ytaq-s-item, .ytaq-yt-watch > div, .ytaq-p-bar > *';

	function animate(scope, change) {
		const cs = getComputedStyle(document.documentElement);
		const duration = parseFloat(cs.getPropertyValue('--ytaq-duration')) || 0;
		if (!scope || !duration || matchMedia('(prefers-reduced-motion: reduce)').matches) return change();
		const easing = cs.getPropertyValue('--ytaq-ease').trim() || 'ease';
		const els = [...scope.querySelectorAll(PARTS)];
		const before = new Map(els.map(e => [e, e.offsetParent ? e.getBoundingClientRect() : null]));
		change();
		for (const e of els) {
			const b = before.get(e);
			const a = e.offsetParent ? e.getBoundingClientRect() : null;
			if (!a || !a.width || !a.height) continue;
			if (!b) {
				e.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing });
				continue;
			}
			const dx = b.left - a.left, dy = b.top - a.top, sx = b.width / a.width, sy = b.height / a.height;
			if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
			e.animate([
				{ transformOrigin: '0 0', transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sx + ', ' + sy + ')' },
				{ transformOrigin: '0 0', transform: 'none' }
			], { duration, easing });
		}
	}

	function el(tag, cls, text) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text) e.textContent = text;
		return e;
	}

	function mockCard(time, sub, badge, extra) {
		const card = el('div', 'ytaq-yt-card' + (extra ? ' ' + extra : ''));
		const thumb = el('div', 'ytaq-yt-thumb');
		thumb.append(el('span', 'ytaq-yt-time', time));
		const meta = el('div', 'ytaq-yt-meta');
		const text = el('div', 'ytaq-yt-text');
		text.append(el('span', 'ytaq-yt-title', '動画のタイトル'), el('span', 'ytaq-yt-ch', 'チャンネル名'), el('span', 'ytaq-yt-sub', sub));
		if (badge) text.append(el('span', 'ytaq-yt-badge', badge));
		meta.append(el('span', 'ytaq-yt-avatar'), text);
		card.append(thumb, meta);
		return card;
	}

	function buildMocks() {
		const grid = document.querySelector('.ytaq-yt-home .ytaq-yt-grid');
		const cards = [['12:04', '1万回 · 2日前', 'オートダビング版'], ['21:30', '1万回 · 3時間前', '新着'], ['15:42', '1万回 · 5日前'], ['9:12', '1万回 · 1日前'], ['32:08', '1万回 · 4日前'], ['4:55', '1万回 · 1週間前'], ['7:21', '1万回 · 2週間前'], ['18:03', '1万回 · 3週間前']];
		grid.replaceChildren(...cards.map(c => mockCard(c[0], c[1], c[2])));
		const search = document.querySelector('.ytaq-yt-search');
		search.replaceChildren(...[['12:04', 'オートダビング版'], ['8:51'], ['21:30', '新着'], ['15:42'], ['9:12'], ['4:55']].map(c => {
			const item = mockCard(c[0], '1万回 · 2日前', c[1], 'ytaq-s-item');
			return item;
		}));
		const comments = document.querySelector('.ytaq-w-comments');
		for (let i = 0; i < 4; i++) {
			const c = el('div', 'ytaq-w-c');
			const t = el('div', 'ytaq-yt-text');
			t.append(el('span', 'ytaq-yt-ch', '@ユーザー名 · 2時間前'), el('span', '', 'コメントの本文'));
			c.append(el('span', 'ytaq-yt-avatar'), t);
			comments.append(c);
		}
		const related = document.querySelector('.ytaq-w-related');
		for (let i = 0; i < 3; i++) {
			const r = el('div', 'ytaq-w-r');
			const t = el('div', 'ytaq-yt-text');
			t.append(el('span', 'ytaq-yt-title', '動画のタイトル'), el('span', 'ytaq-yt-ch', 'チャンネル名'));
			r.append(el('span', 'ytaq-w-r-thumb'), t);
			related.append(r);
		}
	}

	function updatePreviews() {
		const home = document.querySelector('.ytaq-yt-home');
		home.classList.toggle('ytaq-header', $('cardHeader').checked);
		home.classList.toggle('ytaq-no-badges', $('hideCardBadges').checked);
		home.classList.toggle('ytaq-compact-on', document.querySelector('.ytaq-compact[value="home"]').checked);
		const search = document.querySelector('.ytaq-yt-search');
		const grid = $('searchGrid').checked;
		search.classList.toggle('ytaq-grid', grid);
		search.classList.toggle('ytaq-header', grid && $('cardHeader').checked);
		search.classList.toggle('ytaq-no-badges', $('hideCardBadges').checked);
		search.classList.toggle('ytaq-compact-on', grid && document.querySelector('.ytaq-compact[value="search"]').checked);
		const watch = document.querySelector('.ytaq-yt-watch');
		watch.classList.toggle('ytaq-narrow', !$('watchWide').checked);
		watch.classList.toggle('ytaq-side', $('watchWide').checked && $('watchSide').checked);
		watch.classList.toggle('ytaq-related', $('watchRelated').checked);
		watch.classList.toggle('ytaq-desc', !$('watchRelated').checked && $('watchDescBelow').checked);
		const popup = document.querySelector('.ytaq-yt-popup');
		const info = Object.fromEntries([...document.querySelectorAll('.ytaq-popupInfo input')].map(cb => [cb.value, cb.checked]));
		for (const e of popup.querySelectorAll('[data-show]')) e.hidden = !info[e.dataset.show];
	}

	function previewOf(target) {
		const page = target.closest && target.closest('.ytaq-page');
		return page ? page.querySelector('.ytaq-yt') : null;
	}

	S.get('theme').then(applyTheme);

	document.addEventListener('DOMContentLoaded', async () => {
		addEventListener('hashchange', show);
		show();
		buildMocks();
		for (const def of Object.values(SECTIONS)) if (def.init) await def.init();
		await loadAll();

		document.addEventListener('change', e => {
			if (!e.target.closest('.ytaq-page') || e.target.closest('.ytaq-folders, .ytaq-channel-list, .ytaq-feed-shorts, .ytaq-backup-file')) return;
			animate(previewOf(e.target), updatePreviews);
			saveSoon();
		});
		document.addEventListener('input', e => {
			if (!e.target.matches('input[type="text"], input[type="number"], textarea, input[type="range"]')) return;
			if (e.target.closest('.ytaq-channel-list, .ytaq-folders, .ytaq-title-test, .ytaq-channel-search')) return;
			saveSoon(e.target.matches('input[type="range"]') ? 120 : 600);
		});
		for (const b of document.querySelectorAll('.ytaq-places button')) {
			b.type = 'button';
			b.classList.add('button', 'button-outline');
			b.addEventListener('click', () => {
				b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
				saveSoon();
			});
		}
		for (const r of document.querySelectorAll('.ytaq-reset')) r.addEventListener('click', () => resetPage(r.closest('.ytaq-page')));
		for (const b of document.querySelectorAll('.ytaq-wstate')) b.addEventListener('click', () => {
			for (const x of document.querySelectorAll('.ytaq-wstate')) x.setAttribute('aria-pressed', String(x === b));
			const watch = document.querySelector('.ytaq-yt-watch');
			animate(watch, () => { watch.dataset.state = b.dataset.state; });
		});

		chrome.storage.onChanged.addListener(async (changes, area) => {
			if (area !== 'local') return;
			for (const def of Object.values(SECTIONS)) {
				let outside = false;
				for (const n of def.names) {
					const value = await S.get(n);
					if (JSON.stringify(value) !== saved[n]) outside = true;
				}
				if (!outside || document.activeElement && document.activeElement.closest('.ytaq-page') && document.activeElement.matches('input, textarea')) continue;
				const values = {};
				for (const n of def.names) {
					values[n] = await S.get(n);
					saved[n] = JSON.stringify(values[n]);
				}
				def.render(values);
				updatePreviews();
			}
		});

		YTaqFolders.watch(renderFolders);
		initChannels();
		initBackup();
		const shortsBox = document.querySelector('.ytaq-feed-shorts');
		S.watch('feedShorts', v => { shortsBox.checked = !!v; });
		shortsBox.addEventListener('change', async () => {
			await S.set('feedShorts', shortsBox.checked);
			toast('保存しました', 'success');
		});
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
			toast('書き出しました', 'success');
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
				return toast('ファイルを読めませんでした', 'error');
			}
			if (!parsed || parsed.app !== 'YTaq' || !parsed.data || typeof parsed.data !== 'object') {
				return toast('YTaq の書き出したファイルではありません', 'error');
			}
			const incoming = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k.startsWith('ytaq_') && !BACKUP_SKIP.has(k)));
			if (!confirm('今の設定・フォルダ・ミュート・速度を、このファイルの中身に入れ替えます。')) return;
			const all = await new Promise(ok => chrome.storage.local.get(null, ok));
			await new Promise(ok => chrome.storage.local.remove(backupKeys(all), ok));
			await new Promise(ok => chrome.storage.local.set(incoming, ok));
			location.reload();
		});
	}

	function button(label, cls, fn) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = label;
		b.className = cls;
		b.addEventListener('click', fn);
		return b;
	}

	function folderCard(data, folder, index) {
		const card = document.createElement('div');
		card.classList.add('tray', 'stack');

		const row = document.createElement('div');
		row.classList.add('row', 'middle', 'wrap');
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

		const up = button('上へ', 'button button-outline', () => YTaqFolders.moveFolder(folder.id, -1));
		up.disabled = index === 0;
		const down = button('下へ', 'button button-outline', () => YTaqFolders.moveFolder(folder.id, 1));
		down.disabled = index === data.folders.length - 1;
		const del = button('削除', 'button button-outline error', () => {
			if (del.dataset.confirm) return YTaqFolders.deleteFolder(folder.id);
			del.dataset.confirm = '1';
			del.textContent = '本当に削除';
		});
		row.append(name, up, down, del);
		card.append(row);

		if (!folder.channels.length) {
			const p = document.createElement('p');
			p.classList.add('note');
			p.textContent = 'チャンネルが入っていません';
			card.append(p);
		}
		for (const id of folder.channels) {
			const line = document.createElement('div');
			line.classList.add('row', 'middle', 'between');
			const label = document.createElement('a');
			label.href = 'https://www.youtube.com/channel/' + id;
			label.target = '_blank';
			label.rel = 'noopener';
			label.textContent = (data.channels[id] || {}).name || id;
			line.append(label, button('外す', 'button', () => YTaqFolders.removeChannel(folder.id, id)));
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
		row.classList.add('tray');
		row.classList.add('row', 'middle', 'wrap', 'between');

		const head = document.createElement('div');
		head.classList.add('row', 'middle', 'wrap');
		if (c.avatar) {
			const img = document.createElement('img');
			img.src = c.avatar;
			img.alt = '';
			img.loading = 'lazy';
			img.referrerPolicy = 'no-referrer';
			img.classList.add('circle');
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
			tag.classList.add('tag');
			head.append(tag);
		}

		const speed = document.createElement('div');
		speed.classList.add('row', 'middle', 'wrap');
		const label = document.createElement('label');
		label.classList.add('row', 'middle');
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
		const clear = button('消す', 'button', () => YTaqChannels.clearRate(c.id));
		clear.disabled = !rates[c.id];
		speed.append(label, clear);

		const boxes = document.createElement('div');
		boxes.classList.add('row', 'middle', 'wrap');
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
		controls.classList.add('row', 'middle', 'wrap');
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
			p.classList.add('note');
			p.textContent = 'まだチャンネルがありません。ログインした状態で YouTube を開くと、登録チャンネルを読み込みます。';
			box.replaceChildren(p);
			return;
		}
		box.replaceChildren(...[['設定あり', true], ['設定なし', false]].flatMap(([title, flag]) => {
			const rows = list.filter(c => hasSettings.get(c.id) === flag);
			if (!rows.length) return [];
			const group = document.createElement('div');
			group.className = 'ytaq-channel-group';
			group.classList.add('stack');
			const h = document.createElement('h3');
			h.textContent = `${title}（${rows.length}）`;
			h.classList.add('fs-16', 'fw-700');
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
			p.classList.add('note');
			p.textContent = 'フォルダがありません。YouTube のチャンネルのページや動画の下のフォルダのボタンから作れます。';
			box.replaceChildren(p);
			return;
		}
		box.replaceChildren(...data.folders.map((f, i) => folderCard(data, f, i)));
	}
})();
