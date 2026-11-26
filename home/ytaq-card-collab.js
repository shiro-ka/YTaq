(function () {
	'use strict';

	const YTaq = window.YTaq;
	const META = 'ytd-rich-item-renderer[rendered-from-rich-grid] yt-lockup-metadata-view-model';
	const HIDE = 'data-ytaq-collab-hide';

	function enabled() {
		return document.documentElement.classList.contains('ytaq-card-header');
	}

	function nameParts(row) {
		const parts = [];
		for (const el of row.children) {
			if (el.classList.contains('ytContentMetadataViewModelLeadingIcon')) return parts;
			parts.push(el);
		}
		return null;
	}

	function undo(meta) {
		meta.removeAttribute('data-ytaq-collab');
		const label = meta.querySelector(':scope > .ytaq-collab-names');
		if (label) label.remove();
		for (const el of meta.querySelectorAll('[' + HIDE + ']')) el.removeAttribute(HIDE);
	}

	function update(meta) {
		const row = meta.querySelector('.ytContentMetadataViewModelMetadataRow');
		const parts = enabled() && meta.querySelector('yt-avatar-stack-view-model') && row ? nameParts(row) : null;
		if (!parts || !parts.length) return undo(meta);
		const text = parts.filter(el => el.classList.contains('ytContentMetadataViewModelMetadataText')).map(el => el.textContent.trim()).join('');
		let label = meta.querySelector(':scope > .ytaq-collab-names');
		if (!label) {
			label = document.createElement('span');
			label.className = 'ytaq-collab-names';
			meta.append(label);
		}
		if (label.textContent !== text) label.textContent = text;
		for (const el of row.children) el.toggleAttribute(HIDE, parts.includes(el));
		meta.setAttribute('data-ytaq-collab', '');
	}

	function scan() {
		for (const meta of document.querySelectorAll(META + ':has(yt-avatar-stack-view-model), ' + META + '[data-ytaq-collab]')) update(meta);
	}

	function scanAdded(nodes) {
		const metas = new Set();
		for (const n of nodes) {
			if (!n.isConnected || !n.querySelectorAll) continue;
			const own = n.closest('yt-lockup-metadata-view-model');
			if (own && own.matches(META)) metas.add(own);
			for (const m of n.querySelectorAll('yt-lockup-metadata-view-model')) if (m.matches(META)) metas.add(m);
		}
		for (const meta of metas) update(meta);
	}

	let scheduled = false;
	let full = true;
	const roots = new Set();
	function schedule(added) {
		if (Array.isArray(added)) {
			if (!enabled()) return;
			for (const n of added) roots.add(n);
		} else full = true;
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			if (full) scan();
			else scanAdded(roots);
			full = false;
			roots.clear();
		});
	}

	YTaq.ready(() => {
		schedule();
		YTaq.onMutation(added => schedule(added));
	});
	YTaqSettings.watch('cardHeader', () => setTimeout(schedule, 0));
})();
