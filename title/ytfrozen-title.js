// ytfrozen-title.js
// タイトルの誇張（【】）を非表示にするスクリプト
// ただし、"#", "＃"が含まれる場合は除外しない

(function () {
  'use strict';

  // 処理対象のセレクタ
  const TARGET_SELECTORS = [
    'h3.yt-lockup-metadata-view-model__heading-reset span.yt-core-attributed-string',
    'yt-formatted-string.style-scope.ytd-video-renderer'
  ];

  // 正規表現を定数化（作成コスト削減）
  const EXAGGERATION_REGEX = /【[^】]*】|\[[^\]]*\]|［[^］]*］/g;

  /**
   * テキストから【】、[]、［］で囲まれた部分を除去する。
   * ただし、内部に # または ＃ が含まれる場合は維持する。
   * @param {string} text 
   * @returns {string} processed text
   */
  function cleanTitleText(text) {
    if (!text) return text;

    return text.replace(EXAGGERATION_REGEX, (match) => {
      // "#" または "＃" が含まれているかチェック
      if (match.includes('#') || match.includes('＃')) {
        return match;
      }
      return '';
    });
  }

  /**
   * 要素のタイトルを処理する
   * @param {HTMLElement} element 
   */
  function processElement(element) {
    const originalText = element.textContent;
    // 変更がない場合は早期リターン（計算コスト削減）
    if (!originalText) return;

    const newText = cleanTitleText(originalText);

    if (originalText !== newText) {
      // DOM書き換えコストは高いので、本当に変わる場合のみ実行
      element.textContent = newText;
    }
  }

  /**
   * ページ全体のスキャン実行
   * requestAnimationFrameを使用して描画サイクルに合わせる
   */
  function scanAndClean() {
    requestAnimationFrame(() => {
      const elements = document.querySelectorAll(TARGET_SELECTORS.join(','));
      elements.forEach(processElement);
    });
  }

  // DebounceタイマーID
  let timeoutId = null;

  /**
   * スキャン実行を遅延させ、連続呼び出しを間引く（Debounce）
   * YouTubeは頻繁にDOM更新するため、この処理がパフォーマンスの肝
   */
  function debouncedScan() {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // 最後の変更検知から200ms経過後に実行
    timeoutId = setTimeout(() => {
      scanAndClean();
      timeoutId = null;
    }, 200);
  }

  // MutationObserverの設定
  const observer = new MutationObserver((mutations) => {
    // どの種類の変更であっても、画面上の要素に変更があった可能性があるため
    // 間引きつつスキャンをリクエストする
    debouncedScan();
  });

  // 監視開始
  // body以下の全変更を監視するが、debouncedScanで処理を間引くため負荷は低い
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // 初回実行
  scanAndClean();

})();
