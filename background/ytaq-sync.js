(function () {
	'use strict';

	const ON = 'ytaq_sync_on';
	const META = 'ytaq_sync_meta';
	const STATUS = 'ytaq_sync_status';
	const SKIP = new Set([ON, META, STATUS, 'ytaq_feed', 'ytaq_short_owners', 'ytaq_subs', 'ytaq_channel_handles', 'ytaq_innertube', 'ytaq_channel_lists', 'ytaq_playbackrate', 'ytaq_memberships']);
	const PIECE = 2000;
	const PUSH_DELAY = 2000;

	let on = false;
	let meta = {};
	const applying = new Map();
	const dirty = new Set();
	let timer = 0;
	let metaTimer = 0;
	let chain = Promise.resolve();

	function syncable(key) {
		return key.startsWith('ytaq_') && !SKIP.has(key) && !key.includes('#');
	}

	function queue(job) {
		chain = chain.then(job).catch(e => status(String(e && e.message || e)));
		return chain;
	}

	async function status(error) {
		await browser.storage.local.set({ [STATUS]: { at: Date.now(), error: error || null } });
	}

	async function saveMeta() {
		await browser.storage.local.set({ [META]: meta });
	}

	function pieces(json) {
		const out = [];
		for (let i = 0; i < json.length; i += PIECE) out.push(json.slice(i, i + PIECE));
		return out;
	}

	async function push(keys) {
		const values = await browser.storage.local.get(keys);
		const heads = await browser.storage.sync.get(keys);
		const write = {};
		const drop = [];
		for (const key of keys) {
			const t = meta[key] || Date.now();
			meta[key] = t;
			const old = heads[key];
			if (!(key in values)) {
				write[key] = { t, n: 0, gone: true };
			} else {
				const parts = pieces(JSON.stringify(values[key]));
				write[key] = { t, n: parts.length };
				parts.forEach((p, i) => { write[key + '#' + i] = p; });
			}
			if (old && old.n > write[key].n) for (let i = write[key].n; i < old.n; i++) drop.push(key + '#' + i);
		}
		await browser.storage.sync.set(write);
		if (drop.length) await browser.storage.sync.remove(drop);
		await saveMeta();
		await status();
	}

	async function pull(keys) {
		const heads = await browser.storage.sync.get(keys);
		const want = [];
		for (const key of keys) {
			const head = heads[key];
			if (!head || !(head.t > (meta[key] || 0))) continue;
			for (let i = 0; i < head.n; i++) want.push(key + '#' + i);
		}
		const parts = want.length ? await browser.storage.sync.get(want) : {};
		for (const key of keys) {
			const head = heads[key];
			if (!head || !(head.t > (meta[key] || 0))) continue;
			if (head.gone) {
				applying.set(key, null);
				await browser.storage.local.remove(key);
			} else {
				let json = '';
				for (let i = 0; i < head.n; i++) {
					const p = parts[key + '#' + i];
					if (typeof p !== 'string') return;
					json += p;
				}
				const value = JSON.parse(json);
				applying.set(key, json);
				await browser.storage.local.set({ [key]: value });
			}
			meta[key] = head.t;
		}
		await saveMeta();
		await status();
	}

	async function merge() {
		const all = await browser.storage.local.get(null);
		const remote = await browser.storage.sync.get(null);
		const keys = new Set([...Object.keys(all), ...Object.keys(remote)].filter(syncable));
		const up = [];
		const down = [];
		for (const key of keys) {
			const mine = meta[key] || 0;
			const theirs = remote[key] ? remote[key].t : 0;
			if (theirs > mine) down.push(key);
			else if (key in all && (mine > theirs || !remote[key])) up.push(key);
		}
		if (down.length) await pull(down);
		if (up.length) await push(up);
		if (!down.length && !up.length) await status();
	}

	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const keys = [...dirty];
			dirty.clear();
			if (keys.length) queue(() => push(keys));
		}, PUSH_DELAY);
	}

	browser.storage.onChanged.addListener((changes, area) => {
		if (area === 'local' && ON in changes) {
			on = !!changes[ON].newValue;
			if (on) queue(merge);
		}
		if (area === 'local') {
			let touched = false;
			for (const [key, change] of Object.entries(changes)) {
				if (!syncable(key)) continue;
				if (applying.has(key)) {
					const json = applying.get(key);
					applying.delete(key);
					if (json === ('newValue' in change ? JSON.stringify(change.newValue) : null)) continue;
				}
				meta[key] = Date.now();
				if (on) dirty.add(key);
				touched = true;
			}
			if (!touched) return;
			if (on) schedule();
			else {
				clearTimeout(metaTimer);
				metaTimer = setTimeout(saveMeta, PUSH_DELAY);
			}
		} else if (on && area === 'sync') {
			const keys = [...new Set(Object.keys(changes).map(k => k.split('#')[0]))].filter(syncable);
			if (keys.length) queue(() => pull(keys));
		}
	});

	browser.storage.local.get([ON, META]).then(r => {
		meta = r[META] || {};
		on = !!r[ON];
		if (on) queue(merge);
	});
})();
