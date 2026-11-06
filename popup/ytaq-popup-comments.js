(function () {
	'use strict';

	const YTaq = window.YTaq;
	const IT = () => window.YTaqInnertube;

	function el(tag, cls, text) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function find(node, test, out) {
		if (!node || typeof node !== 'object') return out;
		if (test(node)) out.push(node);
		for (const k in node) find(node[k], test, out);
		return out;
	}

	function firstToken(node) {
		const hit = find(node, o => o.continuationCommand && o.continuationCommand.token, [])[0];
		return hit ? hit.continuationCommand.token : null;
	}

	function parsePage(json) {
		const payloads = {};
		for (const m of find(json, o => o.entityKey && o.payload && o.payload.commentEntityPayload, [])) {
			payloads[m.entityKey] = m.payload.commentEntityPayload;
		}
		const groups = find(json, o => Array.isArray(o.continuationItems), []);
		const items = groups.length ? groups[groups.length - 1].continuationItems : [];
		const comments = [];
		let next = null;
		for (const item of items) {
			if (item.commentThreadRenderer) {
				const key = find(item.commentThreadRenderer, o => typeof o.commentKey === 'string', [])[0];
				const p = key && payloads[key.commentKey];
				if (p) comments.push(p);
			} else if (item.continuationItemRenderer) {
				next = firstToken(item.continuationItemRenderer);
			}
		}
		return { comments, next };
	}

	function handleOf(name) {
		return name && name.startsWith('@') ? name.toLowerCase() : null;
	}

	function textWithTimes(content, seek) {
		const text = content.content || '';
		const runs = (content.commandRuns || [])
			.map(r => {
				const w = find(r, o => o.watchEndpoint && typeof o.watchEndpoint.startTimeSeconds === 'number', [])[0];
				return w ? { start: r.startIndex, length: r.length, seconds: w.watchEndpoint.startTimeSeconds } : null;
			})
			.filter(Boolean)
			.sort((a, b) => a.start - b.start);
		const box = el('div', 'ytaq-popup-comment-text');
		let at = 0;
		for (const r of runs) {
			if (r.start < at) continue;
			box.append(document.createTextNode(text.slice(at, r.start)));
			const b = el('button', 'ytaq-popup-comment-time', text.slice(r.start, r.start + r.length));
			b.type = 'button';
			b.addEventListener('click', () => seek(r.seconds));
			box.append(b);
			at = r.start + r.length;
		}
		box.append(document.createTextNode(text.slice(at)));
		return box;
	}

	function create(videoId, options) {
		const seek = options.seek;
		const root = el('aside', 'ytaq-popup-comments');
		const head = el('div', 'ytaq-popup-comments-head', 'コメント');
		const list = el('div', 'ytaq-popup-comments-list');
		root.append(head, list);

		let next = null;
		let loading = false;
		let started = false;

		function muted(p) {
			const a = p.author || {};
			return !!window.YTaqMute && window.YTaqMute.isChannelMuted({ id: a.channelId, handle: handleOf(a.displayName) });
		}

		function refilter() {
			for (const row of list.querySelectorAll('.ytaq-popup-comment')) {
				row.hidden = !!window.YTaqMute && window.YTaqMute.isChannelMuted({ id: row.dataset.channel, handle: row.dataset.handle || null });
			}
		}

		function row(p) {
			const a = p.author || {};
			const props = p.properties || {};
			const r = el('div', 'ytaq-popup-comment');
			if (a.channelId) r.dataset.channel = a.channelId;
			const handle = handleOf(a.displayName);
			if (handle) r.dataset.handle = handle;
			const meta = el('div', 'ytaq-popup-comment-meta');
			meta.append(el('span', 'ytaq-popup-comment-author', a.displayName || ''), el('span', 'ytaq-popup-comment-when', props.publishedTime || ''));
			const mute = el('button', 'ytaq-popup-comment-mute');
			mute.type = 'button';
			mute.title = 'このチャンネルをミュート';
			mute.setAttribute('aria-label', 'このチャンネルをミュート');
			mute.append(YTaqIcons.create('visibility_off'));
			mute.addEventListener('click', () => {
				if (window.YTaqMute) window.YTaqMute.addChannel({ id: a.channelId || null, handle, name: a.displayName || '' });
			});
			meta.append(mute);
			r.append(meta, textWithTimes(props.content || {}, seek));
			const likes = String((p.toolbar && p.toolbar.likeCountNotliked) || '').trim();
			if (/[1-9]/.test(likes)) r.append(el('div', 'ytaq-popup-comment-likes', '高評価 ' + likes));
			r.hidden = muted(p);
			return r;
		}

		function note(text) {
			const n = list.querySelector('.ytaq-popup-comments-note') || el('p', 'ytaq-popup-comments-note');
			n.textContent = text;
			list.append(n);
		}

		async function load(token) {
			if (loading) return;
			loading = true;
			try {
				const page = parsePage(await IT().call('next', { continuation: token }));
				const n = list.querySelector('.ytaq-popup-comments-note');
				if (n) n.remove();
				list.append(...page.comments.map(row));
				next = page.next;
				if (!list.querySelector('.ytaq-popup-comment')) note('コメントはありません');
			} catch (e) {
				YTaq.warn('popup comments', e.message);
				note('コメントを読み込めませんでした');
			} finally {
				loading = false;
			}
		}

		async function start() {
			if (started || !IT()) return;
			started = true;
			note('読み込み中…');
			try {
				const json = await IT().call('next', { videoId });
				const section = find(json, o => o.itemSectionRenderer && o.itemSectionRenderer.sectionIdentifier === 'comment-item-section', [])[0];
				const token = section && firstToken(section);
				if (!token) return note('コメントはオフになっています');
				await load(token);
			} catch (e) {
				YTaq.warn('popup comments', e.message);
				note('コメントを読み込めませんでした');
			}
		}

		list.addEventListener('scroll', () => {
			if (next && !loading && list.scrollTop + list.clientHeight >= list.scrollHeight - 300) load(next);
		});

		active = refilter;
		if (options.onClose) options.onClose(() => {
			if (active === refilter) active = null;
		});

		return { el: root, start };
	}

	let active = null;
	YTaqSettings.onChange('mute', () => setTimeout(() => {
		if (active) active();
	}, 50));

	window.YTaqPopupComments = { create };
})();
