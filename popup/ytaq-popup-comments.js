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
			const thread = item.commentThreadRenderer;
			const view = thread ? thread.commentViewModel : item.commentViewModel;
			if (view) {
				const key = find(view, o => typeof o.commentKey === 'string', [])[0];
				const p = key && payloads[key.commentKey];
				if (p) comments.push({ p, replies: thread && thread.replies ? firstToken(thread.replies) : null });
			} else if (item.continuationItemRenderer) {
				next = firstToken(item.continuationItemRenderer);
			}
		}
		const sorts = (find(json, o => o.sortFilterSubMenuRenderer, [])[0] || { sortFilterSubMenuRenderer: { subMenuItems: [] } })
			.sortFilterSubMenuRenderer.subMenuItems.map(i => ({ title: i.title, token: firstToken(i), selected: !!i.selected })).filter(i => i.token);
		const create = find(json, o => typeof o.createCommentParams === 'string', [])[0];
		return { comments, next, sorts, createParams: create ? create.createCommentParams : null };
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
		const head = el('div', 'ytaq-popup-comments-head');
		const sortBox = el('div', 'ytaq-popup-comments-sort');
		head.append(el('span', 'ytaq-popup-comments-title', 'コメント'), sortBox);
		const writeBox = el('div', 'ytaq-popup-comments-write');
		writeBox.hidden = true;
		const list = el('div', 'ytaq-popup-comments-list');
		root.append(head, writeBox, list);

		let next = null;
		let loading = false;
		let started = false;
		let want = { commentReplies: false, commentWrite: false };

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

		function thread(c) {
			const r = row(c.p);
			const count = String((c.p.toolbar && c.p.toolbar.replyCount) || '').trim();
			if (want.commentReplies && c.replies && /[1-9]/.test(count)) {
				const box = el('div', 'ytaq-popup-comment-replies');
				box.append(moreButton('返信 ' + count + ' 件', c.replies, box));
				r.append(box);
			}
			return r;
		}

		function moreButton(label, token, box) {
			const b = el('button', 'ytaq-popup-comment-more', label);
			b.type = 'button';
			b.addEventListener('click', async () => {
				b.disabled = true;
				try {
					const page = parsePage(await IT().call('next', { continuation: token }));
					b.remove();
					box.append(...page.comments.map(c => row(c.p)));
					if (page.next) box.append(moreButton('ほかの返信', page.next, box));
				} catch (e) {
					YTaq.warn('popup comments: replies', e.message);
					b.disabled = false;
				}
			});
			return b;
		}

		function renderSorts(sorts) {
			if (sortBox.childElementCount || sorts.length < 2) return;
			sorts.forEach((s, i) => {
				const b = el('button', 'ytaq-popup-comments-sort-btn', s.title);
				b.type = 'button';
				b.classList.toggle('ytaq-popup-comments-sort-on', s.selected || (i === 0 && !sorts.some(x => x.selected)));
				b.addEventListener('click', () => {
					if (b.classList.contains('ytaq-popup-comments-sort-on')) return;
					for (const x of sortBox.children) x.classList.toggle('ytaq-popup-comments-sort-on', x === b);
					list.replaceChildren();
					next = null;
					note('読み込み中…');
					load(s.token);
				});
				sortBox.append(b);
			});
		}

		function renderWrite(params) {
			if (!want.commentWrite || !params || writeBox.childElementCount) return;
			const text = el('textarea', 'ytaq-popup-comments-text');
			text.rows = 2;
			text.placeholder = 'コメントを書く';
			const send = el('button', 'ytaq-popup-comments-send', '送信');
			send.type = 'button';
			send.disabled = true;
			const status = el('span', 'ytaq-popup-comments-status');
			text.addEventListener('input', () => { send.disabled = !text.value.trim(); });
			send.addEventListener('click', async () => {
				const body = text.value.trim();
				if (!body) return;
				send.disabled = true;
				status.textContent = '送信中…';
				try {
					await IT().call('comment/create_comment', { commentText: body, createCommentParams: params });
					text.value = '';
					status.textContent = '送信しました';
				} catch (e) {
					YTaq.warn('popup comments: create', e.message);
					status.textContent = '送信できませんでした';
					send.disabled = false;
				}
			});
			const row = el('div', 'ytaq-popup-comments-write-row');
			row.append(status, send);
			writeBox.append(text, row);
			writeBox.hidden = false;
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
				list.append(...page.comments.map(thread));
				next = page.next;
				renderSorts(page.sorts);
				renderWrite(page.createParams);
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
			want = Object.assign(want, await YTaqSettings.get('popupInfo'));
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
