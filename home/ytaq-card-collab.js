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

	let scheduled = false;
	function schedule() {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			scan();
		});
	}

	YTaq.ready(() => {
		scan();
		YTaq.onMutation(schedule);
	});
	YTaqSettings.watch('cardHeader', () => setTimeout(schedule, 0));
})();
