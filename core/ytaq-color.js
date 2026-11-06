(function () {
	'use strict';

	const LADDERS = {
		dark: { bg: 0.18, panel: 0.22, item: 0.28, tint: 0.33, accent: 0.74 },
		dim: { bg: 0.29, panel: 0.33, item: 0.39, tint: 0.44, accent: 0.80 }
	};
	const THEMES = {
		hadal: { ladder: 'dark', h: 286, cs: 0.006, ar: 0.85, lift: 0.03 },
		trench: { ladder: 'dark', h: 270, cs: 0.040, ar: 0.85, lift: 0.03, ct: 0.015 },
		fjord: { ladder: 'dark', h: 281, cs: 0.037, ar: 0.85, lift: 0.015, ct: 0.025 },
		shoal: { ladder: 'dim', h: 265, cs: 0.020, ar: 0.60 }
	};
	const ACCENTS = { clown: 55, turtle: 122, konbu: 188, jelly: 212, blue: 255, indigo: 282, coral: 308, magenta: 332, seal: 355 };
	const SEMANTIC = {
		dark: { error: [0.73, 22], warning: [0.82, 90], success: [0.76, 155] },
		dim: { error: [0.85, 22], warning: [0.85, 90], success: [0.83, 155] }
	};
	const SEM_OFFSET = 0.15;
	const SELECTED = 0.055;
	const TINT_HUE = 0.05;
	const NEAR = 0.055;
	const CUSTOM_BASE = 'trench';
	const CUSTOM_ACCENT_BASE = 'blue';

	function toLinear(L, C, H) {
		const a = C * Math.cos(H * Math.PI / 180);
		const b = C * Math.sin(H * Math.PI / 180);
		const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
		const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
		const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
		return [
			4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
			-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
			-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
		];
	}

	function inGamut(L, C, H) {
		return toLinear(L, C, H).every(c => c >= -1e-4 && c <= 1 + 1e-4);
	}

	function maxC(L, H) {
		let lo = 0;
		let hi = 0.5;
		for (let i = 0; i < 48; i++) {
			const m = (lo + hi) / 2;
			if (inGamut(L, m, H)) lo = m;
			else hi = m;
		}
		return lo;
	}

	function dE([l1, c1, h1], [l2, c2, h2]) {
		const r = Math.PI / 180;
		return Math.hypot(l1 - l2, c1 * Math.cos(h1 * r) - c2 * Math.cos(h2 * r), c1 * Math.sin(h1 * r) - c2 * Math.sin(h2 * r));
	}

	function ladder(t) {
		const d = Object.assign({}, LADDERS[t.ladder]);
		for (const k of ['bg', 'panel', 'item', 'tint']) d[k] = Math.round((d[k] + (t.lift || 0)) * 1000) / 1000;
		return d;
	}

	function face(L, t) {
		return [L, Math.min(t.cs, maxC(L, t.h)), t.h];
	}

	function resolveTint(t, h) {
		const d = ladder(t);
		const L = d.tint;
		const ceil = maxC(L, h);
		const ok = C => Math.min(dE([L, C, h], face(d.panel, t)), dE([L, C, h], face(d.item, t))) >= SELECTED
			&& dE([L, C, h], face(L, t)) >= TINT_HUE
			&& C >= TINT_HUE;
		if (!ok(ceil)) return ceil;
		let lo = 0;
		let hi = ceil;
		for (let i = 0; i < 48; i++) {
			const m = (lo + hi) / 2;
			if (ok(m)) hi = m;
			else lo = m;
		}
		return hi;
	}

	function accentOf(t, h) {
		const d = ladder(t);
		return {
			accent: [d.accent, maxC(d.accent, h) * t.ar, h],
			tint: [d.tint, resolveTint(t, h), h]
		};
	}

	function hue(v, fallback) {
		const n = Number(v);
		return Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : fallback;
	}

	function resolve(setting) {
		const s = setting || {};
		const customTheme = s.theme === 'custom' || !THEMES[s.theme];
		const customAccent = s.accent === 'custom' || !ACCENTS[s.accent];
		const baseName = customTheme ? CUSTOM_BASE : s.theme;
		const t = Object.assign({}, THEMES[baseName]);
		if (customTheme) t.h = hue(s.primaryHue, t.h);
		const accentHue = customAccent ? hue(s.accentHue, ACCENTS[CUSTOM_ACCENT_BASE]) : ACCENTS[s.accent];
		return {
			attr: baseName + ' ' + (customAccent ? CUSTOM_ACCENT_BASE : s.accent),
			theme: t,
			customTheme: s.theme === 'custom',
			customAccent: s.accent === 'custom',
			accentHue
		};
	}

	function oklch([L, C, H]) {
		return `oklch(${(L * 100).toFixed(2)}% ${C.toFixed(4)} ${H})`;
	}

	function customVars(setting) {
		const r = resolve(setting);
		if (!r.customTheme && !r.customAccent) return {};
		const t = r.theme;
		const vars = {};
		if (r.customTheme) {
			const d = ladder(t);
			vars['--ytaq-gray-hue'] = String(t.h);
			vars['--ytaq-gray-chroma'] = Math.min(t.cs, ...['bg', 'panel', 'item', 'tint'].map(k => maxC(d[k], t.h))).toFixed(4);
			vars['--ytaq-text-chroma'] = Math.min(t.ct || t.cs, maxC(0.94, t.h)).toFixed(4);
		}
		const a = accentOf(t, r.accentHue);
		vars['--ytaq-color-accent'] = oklch(a.accent);
		vars['--ytaq-color-accent-tint'] = oklch(a.tint);
		return vars;
	}

	function css(setting, layer) {
		const vars = customVars(setting);
		const body = Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ');
		if (!body) return '';
		const rule = `html[data-ytaq-theme][data-ytaq-theme] { ${body} }`;
		return layer ? `@layer ${layer} { ${rule} }` : rule;
	}

	function nearSemantic(setting) {
		const r = resolve(setting);
		if (!r.customAccent) return null;
		const a = accentOf(r.theme, r.accentHue).accent;
		const sr = Math.min(0.95, r.theme.ar + SEM_OFFSET);
		for (const [name, [L, h]] of Object.entries(SEMANTIC[r.theme.ladder])) {
			if (dE(a, [L, maxC(L, h) * sr, h]) < NEAR) return name;
		}
		return null;
	}

	function primarySwatch(h) {
		const t = Object.assign({}, THEMES[CUSTOM_BASE], { h });
		return oklch(face(ladder(t).item, t));
	}

	function accentSwatch(setting, h) {
		return oklch(accentOf(resolve(setting).theme, h).accent);
	}

	function apply(root, setting, layer) {
		const r = resolve(setting);
		root.setAttribute('data-ytaq-theme', r.attr);
		let style = root.querySelector(':scope > style.ytaq-custom-colors');
		const text = css(setting, layer);
		if (!text) {
			if (style) style.remove();
			return;
		}
		if (!style) {
			style = document.createElement('style');
			style.className = 'ytaq-custom-colors';
			root.prepend(style);
		}
		style.textContent = text;
	}

	window.YTaqColor = { THEMES, ACCENTS, CUSTOM_BASE, resolve, customVars, css, apply, nearSemantic, primarySwatch, accentSwatch, accentOf, oklch };
})();
