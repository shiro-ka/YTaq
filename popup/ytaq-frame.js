// YTaq: ポップアップ内 iframe であることを <html> に印付けする
//
// ポップアップは /watch を iframe で開く。その中では YTaq の大半の機能は
// 不要（テーマもクリック横取りもリスト機能も要らない）だが、perf モジュールだけは
// 効かせたい。そこで manifest の2つ目の content_scripts エントリで
// core + perf + このファイルだけをサブフレームにも注入し、
// CSS 側は html.ytaq-popup-iframe で出し分ける。

(function () {
	'use strict';

	// トップフレームでは何もしない（同じエントリがトップにも注入されるため）
	if (window.self === window.top) return;

	document.documentElement.classList.add('ytaq-popup-iframe');
})();
