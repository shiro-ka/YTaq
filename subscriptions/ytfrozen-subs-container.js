/* * *
  登録チャンネル画面にhtml要素を作成
  ytd-browse[page-subtype="subscriptions"]の子要素として.ytfrozen-subs-containerを作成し、
  その中にリストカラムを追加
* * */

// 登録チャンネルはYouTubeネイティブUIをCSS魔改造する方針に変更したため、
// カスタムカラムは作成しない。コードは参考用に残す。

/*
(function() {
  let isUpdating = false;

  async function createSubsContainer() {
    if (isUpdating) return;

    const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
    if (!browse) {
      // ログを減らすため、subscriptionsページ以外では何も出力しない
      return;
    }

    // YouTubeの#primary要素を探す
    const primary = browse.querySelector('#primary.ytd-two-column-browse-results-renderer');
    if (!primary) {
      console.log('[YTFrozen Subs] #primary not found');
      return;
    }

    // 既存のカラムを探す
    const existingColumn = primary.querySelector('.ytfrozen-list-column[data-list-hash="sub-channels"]');

    // 既にsub-channelsカラムが存在すれば何もしない
    if (existingColumn) {
      console.log('[YTFrozen Subs] Column already exists');
      return;
    }

    try {
      isUpdating = true;

      // 既存のYTFrozenカラムをすべて削除（念のため）
      primary.querySelectorAll('.ytfrozen-list-column').forEach(e => e.remove());

      // sub-channelsカラムを作成
      const subCol = document.createElement('div');
      subCol.className = 'ytfrozen-list-column';
      subCol.dataset.listHash = 'sub-channels';

      const subHeader = document.createElement('div');
      subHeader.className = 'ytfrozen-header';
      subHeader.textContent = '登録チャンネル';
      subCol.appendChild(subHeader);

      const subContent = document.createElement('div');
      subContent.className = 'ytfrozen-list-content';
      subCol.appendChild(subContent);

      // #primaryに直接カラムを追加
      primary.appendChild(subCol);

      console.log('[YTFrozen Subs] Column added to #primary');

      // 動画リストを描画
      setTimeout(() => {
        console.log('[YTFrozen Subs] Attempting to render videos, YTFrozenListMovie:', window.YTFrozenListMovie);
        if (window.YTFrozenListMovie) {
          // sub-channelsカラムに新着動画を表示
          const subColContent = primary.querySelector('.ytfrozen-list-column[data-list-hash="sub-channels"] .ytfrozen-list-content');
          console.log('[YTFrozen Subs] subColContent:', subColContent, 'rendered:', subColContent?.dataset.rendered);
          if (subColContent && !subColContent.dataset.rendered) {
            subColContent.dataset.rendered = 'true';
            console.log('[YTFrozen Subs] Calling renderListMovies for sub-channels');
            window.YTFrozenListMovie.renderListMovies('sub-channels', subColContent);
          }
        } else {
          console.error('[YTFrozen Subs] YTFrozenListMovie not available!');
        }
      }, 100);

    } finally {
      isUpdating = false;
    }
  }

  // 定期的にチェック（content.jsと同じ方式）
  setInterval(createSubsContainer, 1500);

  // 初回実行
  createSubsContainer();
})();
*/
