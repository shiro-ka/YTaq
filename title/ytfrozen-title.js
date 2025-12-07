// ytfrozen-title.js
// タイトルの誇張（【】）を非表示にするスクリプト
// ただし、"#", "＃"が含まれる場合は除外しない

(function () {
  'use strict';

  // 処理対象のセレクタ
  const TARGET_SELECTORS = [
    '#video-title', // 汎用: 関連動画、検索結果など（多くの箇所でIDとして使用）
    '#video-title-link', // リンク要素自体がタイトルの場合
    'h1.ytd-watch-metadata', // 再生画面のタイトル (新レイアウト)
    'h1.title.ytd-video-primary-info-renderer', // 再生画面のタイトル (旧レイアウト)
    'ytd-rich-grid-media #video-title', // ホーム画面（グリッド表示）
    'ytd-video-renderer #video-title', // 検索結果リスト
    'ytd-compact-video-renderer #video-title', // 関連動画サイドバー
    'ytd-grid-video-renderer #video-title', // チャンネルページ等のグリッド
    'a#video-title-link yt-formatted-string', // リンク内のテキスト要素
    'h3.yt-lockup-metadata-view-model__heading-reset span.yt-core-attributed-string', // 新しいホーム画面レイアウト
    // 必要に応じて追加
  ];

  /**
   * テキストから【】、[]、［］で囲まれた部分を除去する。
   * ただし、内部に # または ＃ が含まれる場合は維持する。
   * @param {string} text 
   * @returns {string} processed text
   */
  function cleanTitleText(text) {
    if (!text) return text;

    // 正規表現: 
    // 1. 【...】 (全角隅付き括弧)
    // 2. [...] (半角角括弧)
    // 3. ［...］ (全角角括弧)
    const regex = /【[^】]*】|\[[^\]]*\]|［[^］]*］/g;

    return text.replace(regex, (match) => {
      // "#" または "＃" が含まれているかチェック
      if (match.includes('#') || match.includes('＃')) {
        return match; // そのまま返す
      }
      return ''; // 削除（空文字に置換）
    });
  }

  /**
   * 要素のタイトルを処理する
   * @param {HTMLElement} element 
   */
  function processElement(element) {
    // 既に処理済みかどうかのフラグは、SPAでの再利用を考慮して使用しない、
    // あるいはテキスト内容が変わったかを基準にする。

    // 要素が非表示等の場合はスキップしてもよいが、ここではテキストベースで判断
    const originalText = element.textContent;
    const newText = cleanTitleText(originalText);

    if (originalText !== newText) {
      // テキストのみ更新
      // youtubeのデータバインディングと競合する可能性はあるが、
      // MutationObserverで監視しているので再適用されるはず。
      element.textContent = newText;
      // デバッグ用ログ
      // console.log(`[YTFrozen] Title cleaned: "${originalText}" -> "${newText}"`);
    }
  }

  /**
   * ページ全体のスキャン実行
   */
  function scanAndClean() {
    // セレクタにマッチする全ての要素を取得
    const elements = document.querySelectorAll(TARGET_SELECTORS.join(','));
    elements.forEach(processElement);
  }

  // MutationObserverの設定
  // YouTubeは動的にコンテンツをロードするため常に監視が必要
  const observer = new MutationObserver((mutations) => {
    let needsScan = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // ノードが追加された場合
        if (mutation.addedNodes.length > 0) {
          needsScan = true;
          break;
        }
      } else if (mutation.type === 'characterData') {
        // テキストノードが変更された場合
        // タイトル要素直下のテキスト変更を検知するのは難しい（親のみ監視しているため）
        // しかしsubtree: trueなら検知可能
        needsScan = true;
        break;
      }
      // 属性変更などは無視
    }

    if (needsScan) {
      // パフォーマンスのため、頻繁な実行を少し間引くことも考えられるが、
      // テキスト比較が軽量なので一旦そのまま実行
      scanAndClean();
    }
  });

  // 監視開始
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true // テキスト書き換えも監視
  });

  // 初回実行
  scanAndClean();

  // 定期的なクリーンアップ（Observer漏れ対策）
  setInterval(scanAndClean, 2000);

})();
