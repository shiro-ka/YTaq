(function () {
	'use strict';

	const RATES_KEY = 'ytaq_channel_rates';
	const SUBS_KEY = 'ytaq_subs';
	const OLD_RATES_KEY = 'ytaq_playbackrate';

	function read(keys) {
		return new Promise(ok => chrome.storage.local.get(keys, ok));
	}

	function write(values) {
		return new Promise(ok => chrome.storage.local.set(values, ok));
	}

	async function getRate(id, name) {
		const got = await read([RATES_KEY, OLD_RATES_KEY]);
		const rates = got[RATES_KEY] || {};
		if (rates[id]) return rates[id].rate;
		const old = got[OLD_RATES_KEY] || {};
		if (!old[name]) return null;
		const rate = old[name];
		rates[id] = { rate, name };
		delete old[name];
		await write({ [RATES_KEY]: rates, [OLD_RATES_KEY]: old });
		return rate;
	}

	async function setRate(id, name, rate) {
		const rates = (await read([RATES_KEY]))[RATES_KEY] || {};
		rates[id] = { rate, name: name || (rates[id] && rates[id].name) || '' };
		await write({ [RATES_KEY]: rates });
	}

	async function clearRate(id) {
		const rates = (await read([RATES_KEY]))[RATES_KEY] || {};
		delete rates[id];
		await write({ [RATES_KEY]: rates });
	}

	async function getSubs() {
		return (await read([SUBS_KEY]))[SUBS_KEY] || { fetchedAt: 0, channels: [] };
	}

	async function setSubs(channels) {
		const got = await read([RATES_KEY, OLD_RATES_KEY]);
		const rates = got[RATES_KEY] || {};
		const old = got[OLD_RATES_KEY] || {};
		for (const c of channels) {
			if (old[c.name] && !rates[c.id]) rates[c.id] = { rate: old[c.name], name: c.name };
			delete old[c.name];
		}
		await write({ [SUBS_KEY]: { fetchedAt: Date.now(), channels }, [RATES_KEY]: rates, [OLD_RATES_KEY]: old });
	}

	async function watch(cb) {
		const send = async () => {
			const got = await read([RATES_KEY, SUBS_KEY]);
			cb({ rates: got[RATES_KEY] || {}, subs: got[SUBS_KEY] || { fetchedAt: 0, channels: [] } });
		};
		chrome.storage.onChanged.addListener((changes, area) => {
			if (area === 'local' && (changes[RATES_KEY] || changes[SUBS_KEY])) send();
		});
		await send();
	}

	window.YTaqChannels = { getRate, setRate, clearRate, getSubs, setSubs, watch };
})();
