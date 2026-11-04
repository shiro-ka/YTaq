(function () {
	'use strict';

	const YTaq = window.YTaq;
	const IT = () => window.YTaqInnertube;

	const NEEDS_PLAYER = ['description', 'date', 'views', 'folder'];
	const NEEDS_NEXT = ['like', 'dislike', 'subscribe', 'likeCount', 'comment'];

	let show = YTaqSettings.defaults('popupInfo');
	YTaqSettings.watch('popupInfo', v => { show = v; });

	const numberFormat = new Intl.NumberFormat(undefined, { notation: 'compact' });
	const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });

	function el(tag, cls, text) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function button(cls, text, fn) {
		const b = el('button', 'ytaq-popup-act ' + cls, text);
		b.type = 'button';
		b.addEventListener('click', fn);
		return b;
	}

	function find(node, test, out) {
		if (Array.isArray(node)) {
			for (const n of node) find(n, test, out);
		} else if (node && typeof node === 'object') {
			if (test(node)) out.push(node);
			for (const k in node) find(node[k], test, out);
		}
		return out;
	}

	function first(node, key) {
		const hit = find(node, o => key in o, []);
		return hit.length ? hit[0][key] : undefined;
	}

	function parseNext(json) {
		const like = first(json, 'likeStatusEntity');
		const sub = first(json, 'subscriptionStateEntity');
		const likeEndpoints = find(json, o => o.likeEndpoint, []).map(o => o.likeEndpoint);
		const params = k => (likeEndpoints.find(e => e[k]) || {})[k];
		const toggle = find(json, o => o.defaultButtonViewModel && o.toggledButtonViewModel && o.toggledButtonViewModel.buttonViewModel, [])[0];
		const subRenderer = first(json, 'subscribeButtonRenderer') || {};
		const subscribe = find(subRenderer, o => o.subscribeEndpoint, []).map(o => o.subscribeEndpoint)[0];
		const unsubscribe = find(json, o => o.unsubscribeEndpoint, []).map(o => o.unsubscribeEndpoint)[0];
		const commentSection = find(json, o => o.itemSectionRenderer && o.itemSectionRenderer.sectionIdentifier === 'comment-item-section', [])[0];
		const commentToken = commentSection ? (find(commentSection, o => o.continuationCommand && o.continuationCommand.token, [])[0] || {}).continuationCommand : null;
		return {
			likeStatus: like ? like.likeStatus : 'INDIFFERENT',
			likeParams: params('likeParams'),
			dislikeParams: params('dislikeParams'),
			removeLikeParams: params('removeLikeParams'),
			likeCount: toggle ? { off: toggle.defaultButtonViewModel.buttonViewModel.title, on: toggle.toggledButtonViewModel.buttonViewModel.title } : null,
			subscribed: sub ? !!sub.subscribed : !!subRenderer.subscribed,
			subscribe,
			unsubscribe,
			commentToken: commentToken ? commentToken.token : null
		};
	}

	function build(videoId, parts) {
		const want = k => !!show[k];
		const actions = el('div', 'ytaq-popup-actions-row');
		const info = el('div', 'ytaq-popup-info');
		const desc = el('div', 'ytaq-popup-desc');
		const comment = el('div', 'ytaq-popup-comment');
		parts.meta.append(actions, info, desc, comment);

		let next = null;
		let channelId = null;

		const likeBtn = want('like') ? button('ytaq-popup-like', '高評価', () => rate('LIKE')) : null;
		const dislikeBtn = want('dislike') ? button('ytaq-popup-dislike', '低評価', () => rate('DISLIKE')) : null;
		const saveWrap = want('save') ? el('div', 'ytaq-popup-save') : null;
		const commentBtn = want('comment') ? button('ytaq-popup-comment-btn', 'コメントを書く', openComment) : null;
		const subBtn = want('subscribe') ? button('ytaq-popup-sub', 'チャンネル登録', toggleSubscribe) : null;
		const folderBtn = want('folder') && window.YTaqFolderButton ? window.YTaqFolderButton.create() : null;
		if (folderBtn && parts.onClose) parts.onClose(folderBtn.destroy);

		for (const b of [likeBtn, dislikeBtn, subBtn, commentBtn]) if (b) b.disabled = true;
		if (likeBtn) actions.append(likeBtn);
		if (dislikeBtn) actions.append(dislikeBtn);
		if (saveWrap) {
			const saveBtn = button('ytaq-popup-save-btn', '保存', openSave);
			const menu = el('div', 'ytaq-popup-save-menu');
			menu.hidden = true;
			saveWrap.append(saveBtn, menu);
			actions.append(saveWrap);
		}
		if (commentBtn) actions.append(commentBtn);
		if (subBtn) parts.channelRow.append(subBtn);
		if (folderBtn) parts.channelRow.append(folderBtn.el);

		function renderRating() {
			const s = next ? next.likeStatus : 'INDIFFERENT';
			if (likeBtn) {
				likeBtn.classList.toggle('ytaq-popup-on', s === 'LIKE');
				const count = want('likeCount') && next && next.likeCount ? ' ' + (s === 'LIKE' ? next.likeCount.on : next.likeCount.off) : '';
				likeBtn.textContent = (s === 'LIKE' ? '高評価済み' : '高評価') + count;
			}
			if (dislikeBtn) {
				dislikeBtn.classList.toggle('ytaq-popup-on', s === 'DISLIKE');
				dislikeBtn.textContent = s === 'DISLIKE' ? '低評価済み' : '低評価';
			}
		}

		function renderSubscribe() {
			if (!subBtn || !next) return;
			subBtn.classList.toggle('ytaq-popup-on', next.subscribed);
			subBtn.textContent = next.subscribed ? '登録済み' : 'チャンネル登録';
		}

		async function rate(kind) {
			if (!next) return;
			const target = { videoId };
			const current = next.likeStatus;
			try {
				if (current === kind) {
					await IT().call('like/removelike', { target, params: next.removeLikeParams });
					next.likeStatus = 'INDIFFERENT';
				} else if (kind === 'LIKE') {
					await IT().call('like/like', { target, params: next.likeParams });
					next.likeStatus = 'LIKE';
				} else {
					await IT().call('like/dislike', { target, params: next.dislikeParams });
					next.likeStatus = 'DISLIKE';
				}
			} catch (e) {
				console.warn('[YTaq] rate', e.message);
			}
			renderRating();
		}

		async function toggleSubscribe() {
			if (!next) return;
			const ep = next.subscribed ? next.unsubscribe : next.subscribe;
			if (!ep) return;
			subBtn.disabled = true;
			try {
				await IT().call(next.subscribed ? 'subscription/unsubscribe' : 'subscription/subscribe', { channelIds: ep.channelIds, params: ep.params });
				next.subscribed = !next.subscribed;
			} catch (e) {
				console.warn('[YTaq] subscribe', e.message);
			}
			subBtn.disabled = false;
			renderSubscribe();
		}

		async function openSave() {
			const menu = saveWrap.querySelector('.ytaq-popup-save-menu');
			if (!menu.hidden) {
				menu.hidden = true;
				return;
			}
			menu.hidden = false;
			menu.replaceChildren(el('span', 'ytaq-popup-note', '読み込み中…'));
			try {
				const json = await IT().call('playlist/get_add_to_playlist', { videoIds: [videoId] });
				const lists = find(json, o => o.playlistAddToOptionRenderer, []).map(o => o.playlistAddToOptionRenderer);
				menu.replaceChildren(...lists.map(r => {
					const row = el('label', 'ytaq-popup-save-row');
					const cb = el('input');
					cb.type = 'checkbox';
					cb.checked = r.containsSelectedVideos === 'ALL';
					cb.addEventListener('change', async () => {
						const ep = cb.checked ? r.addToPlaylistServiceEndpoint : r.removeFromPlaylistServiceEndpoint;
						const edit = ep && ep.playlistEditEndpoint;
						try {
							if (!edit) throw new Error('no playlistEditEndpoint');
							await IT().call('browse/edit_playlist', { playlistId: edit.playlistId, actions: edit.actions, params: edit.params });
						} catch (e) {
							cb.checked = !cb.checked;
							row.title = e.message;
							console.warn('[YTaq] save', e.message);
						}
					});
					const title = r.title ? (r.title.simpleText || (r.title.runs || []).map(x => x.text).join('')) : r.playlistId;
					row.append(cb, document.createTextNode(title));
					return row;
				}));
			} catch (e) {
				menu.replaceChildren(el('span', 'ytaq-popup-note', '再生リストを読み込めませんでした'));
			}
		}

		async function openComment() {
			if (!next || !next.commentToken || comment.childElementCount) return;
			commentBtn.disabled = true;
			try {
				const json = await IT().call('next', { continuation: next.commentToken });
				const params = first(json, 'createCommentParams');
				if (!params) throw new Error('no createCommentParams');
				const box = el('textarea', 'ytaq-popup-comment-text');
				box.rows = 3;
				box.placeholder = 'コメントを入力';
				const send = button('ytaq-popup-comment-send', '送信', async () => {
					const text = box.value.trim();
					if (!text) return;
					send.disabled = true;
					try {
						await IT().call('comment/create_comment', { commentText: text, createCommentParams: params });
						comment.replaceChildren(el('span', 'ytaq-popup-note', 'コメントを送信しました'));
					} catch (e) {
						send.disabled = false;
						console.warn('[YTaq] comment', e.message);
					}
				});
				comment.append(box, send);
				box.focus();
			} catch (e) {
				comment.replaceChildren(el('span', 'ytaq-popup-note', 'コメント欄を読み込めませんでした'));
			}
			commentBtn.disabled = false;
		}

		if (NEEDS_PLAYER.some(want)) {
			IT().call('player', { videoId, contentCheckOk: true, racyCheckOk: true }).then(json => {
				const vd = json.videoDetails || {};
				const mf = (json.microformat && json.microformat.playerMicroformatRenderer) || {};
				channelId = vd.channelId || null;
				if (folderBtn && channelId) folderBtn.setChannel({ id: channelId, name: vd.author || '' });
				const bits = [];
				if (want('date') && mf.publishDate) bits.push(dateFormat.format(new Date(mf.publishDate)));
				if (want('views') && vd.viewCount) bits.push(numberFormat.format(Number(vd.viewCount)) + ' 回視聴');
				info.textContent = bits.join(' · ');
				if (want('description') && vd.shortDescription) {
					desc.textContent = vd.shortDescription;
					desc.addEventListener('click', () => desc.classList.toggle('ytaq-popup-desc-open'));
				}
			}).catch(e => YTaq.warn('popup info: player', e.message));
		}

		if (NEEDS_NEXT.some(want)) {
			IT().call('next', { videoId }).then(json => {
				next = parseNext(json);
				for (const b of [likeBtn, dislikeBtn, subBtn]) if (b) b.disabled = false;
				if (commentBtn) commentBtn.disabled = !next.commentToken;
				renderRating();
				renderSubscribe();
			}).catch(e => YTaq.warn('popup info: next', e.message));
		}
		renderRating();
	}

	window.YTaqPopupInfo = { build };
})();
