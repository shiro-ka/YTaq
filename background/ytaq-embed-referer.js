// YTaq: ポップアップ内 /embed/ の Referer を差し替える
//
// YouTube は「親が youtube.com の埋め込み」を弾く（onError 152）。
// 検証で分かった対応:
//     Referer なし            → 153（referrer が無い）
//     第三者サイトの URL      → 再生できる
//     youtube.com             → 152（その referrer では埋め込ませない）
// つまり判定材料は referrer。ポップアップの iframe が出すサブフレーム
// リクエストの Referer だけを差し替えれば /embed/ が使えるようになる。
//
// 対象は /embed/ のサブフレームのみ。ここを広げると他の通信にも影響するので
// 絶対に広げないこと。動画そのものの取得や他サイトの閲覧には一切触れない。
//
// 注意: YouTube 側の判定が変われば黙って効かなくなる類の回避策。
// 恒久的な解決は自前 <video>（InnerTube 直叩き）側にある。

const REFERER_KEY = 'ytaq_embed_referer';

// example.com は IANA が文書用に予約しているドメインで、誰の実サイトでもない。
// 通らない場合は設定画面から自分の持っているサイトの URL に変える。
const DEFAULT_REFERER = 'https://example.com/';

let embedReferer = DEFAULT_REFERER;

chrome.storage.local.get([REFERER_KEY], (result) => {
	embedReferer = result[REFERER_KEY] || DEFAULT_REFERER;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === 'local' && changes[REFERER_KEY]) {
		embedReferer = changes[REFERER_KEY].newValue || DEFAULT_REFERER;
	}
});

browser.webRequest.onBeforeSendHeaders.addListener(
	(details) => {
		if (!embedReferer) return;

		const headers = details.requestHeaders.filter(
			h => h.name.toLowerCase() !== 'referer'
		);
		headers.push({ name: 'Referer', value: embedReferer });

		return { requestHeaders: headers };
	},
	{
		urls: [
			'*://www.youtube-nocookie.com/embed/*',
			'*://www.youtube.com/embed/*'
		],
		types: ['sub_frame']
	},
	['blocking', 'requestHeaders']
);
