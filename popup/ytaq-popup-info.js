(function () {
	'use strict';

	const YTaq = window.YTaq;
	const IT = () => window.YTaqInnertube;

	const NEEDS_PLAYER = ['description', 'date', 'views', 'folder'];
	const NEEDS_NEXT = ['avatar', 'like', 'dislike', 'subscribe', 'likeCount'];

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

	function iconButton(cls, label, icon, fn) {
		const b = button(cls, null, fn);
		b.classList.add('ytaq-popup-act-icon');
		b.title = label;
		b.setAttribute('aria-label', label);
		b.append(YTaqIcons.create(icon));
		return b;
	}

	function setIcon(b, icon, label, text) {
		b.replaceChildren(YTaqIcons.create(icon));
		if (text) b.append(el('span', null, text));
		b.title = label;
		b.setAttribute('aria-label', text ? label + ' ' + text : label);
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
		const owner = first(json, 'videoOwnerRenderer');
		const avatars = owner && owner.thumbnail ? owner.thumbnail.thumbnails || [] : [];
		return {
			likeStatus: like ? like.likeStatus : 'INDIFFERENT',
			likeParams: params('likeParams'),
			dislikeParams: params('dislikeParams'),
			removeLikeParams: params('removeLikeParams'),
			likeCount: toggle ? { off: toggle.defaultButtonViewModel.buttonViewModel.title, on: toggle.toggledButtonViewModel.buttonViewModel.title } : null,
			subscribed: sub ? !!sub.subscribed : !!subRenderer.subscribed,
			subscribe,
			unsubscribe,
			avatar: (avatars.find(t => t.width >= 56) || avatars[avatars.length - 1] || {}).url || null
		};
	}

	function build(videoId, parts) {
		const want = k => !!show[k];
		const actions = el('div', 'ytaq-popup-actions-row');
		const info = el('div', 'ytaq-popup-info');
		parts.meta.append(actions, info);

		let next = null;
		let channelId = null;

		const avatar = want('avatar') ? el('img', 'ytaq-popup-avatar') : null;
		if (avatar) {
			avatar.alt = '';
			avatar.hidden = true;
			avatar.addEventListener('load', () => { avatar.hidden = false; });
			parts.channelRow.prepend(avatar);
		}

		const likeBtn = want('like') ? iconButton('ytaq-popup-like', '高評価', 'thumb_up', () => rate('LIKE')) : null;
		const dislikeBtn = want('dislike') ? iconButton('ytaq-popup-dislike', '低評価', 'thumb_down', () => rate('DISLIKE')) : null;
		const subBtn = want('subscribe') ? button('ytaq-popup-sub', 'チャンネル登録', toggleSubscribe) : null;
		const folderBtn = want('folder') && window.YTaqFolderButton ? window.YTaqFolderButton.create({ icon: true }) : null;
		if (folderBtn && parts.onClose) parts.onClose(folderBtn.destroy);

		const drops = [];
		function dropdown(cls, label, icon, onOpen) {
			const wrap = el('div', 'ytaq-popup-drop');
			const menu = el('div', 'ytaq-popup-drop-menu ' + cls);
			menu.hidden = true;
			const btn = iconButton(cls + '-btn', label, icon, () => {
				const opening = menu.hidden;
				for (const d of drops) d.menu.hidden = true;
				menu.hidden = !opening;
				if (opening && onOpen) onOpen(menu);
			});
			wrap.append(btn, menu);
			const d = { wrap, btn, menu };
			drops.push(d);
			return d;
		}
		function closeDrops(e) {
			if (!drops.some(d => d.wrap.contains(e.target))) for (const d of drops) d.menu.hidden = true;
		}
		document.addEventListener('pointerdown', closeDrops, true);
		if (parts.onClose) parts.onClose(() => document.removeEventListener('pointerdown', closeDrops, true));

		const descDrop = want('description') ? dropdown('ytaq-popup-desc', '概要', 'notes') : null;
		const saveDrop = want('save') ? dropdown('ytaq-popup-save', '保存', 'playlist_add', openSave) : null;

		for (const b of [likeBtn, dislikeBtn, subBtn]) if (b) b.disabled = true;
		if (descDrop) descDrop.btn.disabled = true;
		if (likeBtn) actions.append(likeBtn);
		if (dislikeBtn) actions.append(dislikeBtn);
		if (saveDrop) actions.append(saveDrop.wrap);
		if (descDrop) actions.append(descDrop.wrap);
		if (subBtn) parts.channelRow.append(subBtn);
		if (folderBtn) parts.channelRow.append(folderBtn.el);

		function renderRating() {
			const s = next ? next.likeStatus : 'INDIFFERENT';
			if (likeBtn) {
				likeBtn.classList.toggle('ytaq-popup-on', s === 'LIKE');
				const count = want('likeCount') && next && next.likeCount ? (s === 'LIKE' ? next.likeCount.on : next.likeCount.off) : '';
				setIcon(likeBtn, s === 'LIKE' ? 'thumb_up_fill' : 'thumb_up', s === 'LIKE' ? '高評価を取り消す' : '高評価', count);
			}
			if (dislikeBtn) {
				dislikeBtn.classList.toggle('ytaq-popup-on', s === 'DISLIKE');
				setIcon(dislikeBtn, s === 'DISLIKE' ? 'thumb_down_fill' : 'thumb_down', s === 'DISLIKE' ? '低評価を取り消す' : '低評価');
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

		async function openSave(menu) {
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
				if (descDrop) {
					if (vd.shortDescription) {
						descDrop.menu.textContent = vd.shortDescription;
						descDrop.btn.disabled = false;
					} else {
						descDrop.wrap.remove();
					}
				}
			}).catch(e => YTaq.warn('popup info: player', e.message));
		}

		if (NEEDS_NEXT.some(want)) {
			IT().call('next', { videoId }).then(json => {
				next = parseNext(json);
				if (avatar && next.avatar) avatar.src = next.avatar;
				for (const b of [likeBtn, dislikeBtn, subBtn]) if (b) b.disabled = false;
				renderRating();
				renderSubscribe();
			}).catch(e => YTaq.warn('popup info: next', e.message));
		}
		renderRating();
	}

	window.YTaqPopupInfo = { build };
})();
