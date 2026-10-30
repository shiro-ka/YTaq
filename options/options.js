(function () {
	'use strict';

	const S = YTaqSettings;
	const FIRST = 'theme';
	const PERF_KEYS = Object.keys(S.defaults('perf'));
	const THEME_BLOCK = /^\[data-suisou-theme~="([a-z]+)"\] \{/gm;
	const ACCENT_BLOCK = /^\[data-suisou-theme~="([a-z]+)"\]\[data-suisou-theme~="([a-z]+)"\] \{/gm;

	function $(section, cls) {
		return document.querySelector(`.ytaq-section-${section} .ytaq-${cls}`);
	}

	function applyTheme(t) {
		document.documentElement.setAttribute('data-suisou-theme', t.theme + ' ' + t.accent);
	}

	async function loadPalette() {
		const css = await (await fetch(chrome.runtime.getURL('suisou-palette.css'))).text();
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

	const SECTIONS = {
		theme: {
			names: ['theme'],
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
				applyTheme(this.collect().theme);
			},
			collect() {
				return { theme: { theme: $('theme', 'theme-name').value, accent: $('theme', 'theme-accent').value } };
			}
		},

		perf: {
			names: ['perf', 'click', 'embedReferer', 'embedLogin', 'watchHistory'],
			render(v) {
				for (const k of PERF_KEYS) $('perf', 'perf-' + k).checked = !!v.perf[k];
				$('perf', 'click').value = v.click;
				$('perf', 'embedReferer').value = v.embedReferer;
				$('perf', 'embedLogin').checked = !!v.embedLogin;
				$('perf', 'watchHistory').checked = !!v.watchHistory;
			},
			collect() {
				const perf = {};
				for (const k of PERF_KEYS) perf[k] = $('perf', 'perf-' + k).checked;
				return {
					perf,
					click: $('perf', 'click').value,
					embedReferer: $('perf', 'embedReferer').value.trim() || S.defaults('embedReferer'),
					embedLogin: $('perf', 'embedLogin').checked,
					watchHistory: $('perf', 'watchHistory').checked
				};
			}
		},

		antibite: {
			names: ['antibite'],
			init() {
				$('antibite', 'thumbnailEnabled').addEventListener('change', () => this.sync());
			},
			sync() {
				$('antibite', 'thumbnailFrame').disabled = !$('antibite', 'thumbnailEnabled').checked;
			},
			render(v) {
				$('antibite', 'thumbnailEnabled').checked = !!v.antibite.thumbnailEnabled;
				$('antibite', 'thumbnailFrame').value = v.antibite.thumbnailFrame;
				this.sync();
			},
			collect() {
				return {
					antibite: {
						thumbnailEnabled: $('antibite', 'thumbnailEnabled').checked,
						thumbnailFrame: $('antibite', 'thumbnailFrame').value
					}
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
		p.setAttribute('data-suisou-item', 'notice');
		p.setAttribute('data-suisou', tone);
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
	});
})();
