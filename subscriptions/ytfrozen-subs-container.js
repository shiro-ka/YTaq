/* * *
  登録チャンネル画面にhtml要素を作成
  ytd-browse[page-subtype="subscriptions"]の子要素として.ytfrozen-subs-containerを作成し、
  その中にリストカラムを追加
* * */

(function() {
  let isUpdating = false;

  async function createSubsContainer() {
    if (isUpdating) return;

    const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
    if (!browse) {
      // ログを減らすため、subscriptionsページ以外では何も出力しない
      return;
    }

    // 既存のコンテナを探す
    let container = browse.querySelector('.ytfrozen-subs-container');

    // なければ新規作成
    if (!container) {
      console.log('[YTFrozen Subs] Creating new container');
      container = document.createElement('div');
      container.className = 'ytfrozen-subs-container';
      browse.appendChild(container);
      console.log('[YTFrozen Subs] Container created:', container);
    }

    // リストマネージャーの確認
    if (!window.YTFrozenListManager) return;
    const lists = await window.YTFrozenListManager.getLists();

    // すでに同じ構成のカラムが存在するかチェック
    const existingColumns = container.querySelectorAll('.ytfrozen-list-column');
    const expectedCount = lists.length + 1; // sub-channels + リスト数

    let columnsValid = true;
    if (existingColumns.length === expectedCount) {
      // sub-channelsカラム
      if (!existingColumns[0].dataset.listHash || existingColumns[0].dataset.listHash !== 'sub-channels') {
        columnsValid = false;
      }
      // 各リストカラム
      for (let i = 0; i < lists.length; i++) {
        if (!existingColumns[i+1].dataset.listHash || existingColumns[i+1].dataset.listHash !== lists[i].name) {
          columnsValid = false;
          break;
        }
      }
      if (columnsValid) {
        return; // 既に正しい構成なら何もしない
      }
    }

    try {
      isUpdating = true;

      // 既存カラムをクリア
      container.querySelectorAll('.ytfrozen-list-column').forEach(e => e.remove());

      const frag = document.createDocumentFragment();

      // 先頭にsub-channelsカラムを追加
      const subCol = document.createElement('div');
      subCol.className = 'ytfrozen-list-column';
      subCol.dataset.listHash = 'sub-channels';

      const subHeader = document.createElement('div');
      subHeader.textContent = '登録チャンネル';
      subHeader.style.cssText = 'font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.2);';
      subCol.appendChild(subHeader);

      const subContent = document.createElement('div');
      subContent.className = 'ytfrozen-list-content';
      subCol.appendChild(subContent);

      frag.appendChild(subCol);

      // 各リストカラムを追加
      lists.forEach(list => {
        const col = document.createElement('div');
        col.className = 'ytfrozen-list-column';
        col.dataset.listHash = list.name;

        const header = document.createElement('div');
        header.textContent = list.name;
        header.style.cssText = 'font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.2);';
        col.appendChild(header);

        const content = document.createElement('div');
        content.className = 'ytfrozen-list-content';
        col.appendChild(content);

        frag.appendChild(col);
      });

      // カラムをコンテナに追加
      container.appendChild(frag);

      // 動画リストを各カラムに描画
      setTimeout(() => {
        console.log('[YTFrozen Subs] Attempting to render videos, YTFrozenListMovie:', window.YTFrozenListMovie);
        if (window.YTFrozenListMovie) {
          // sub-channelsカラムに新着動画を表示
          const subColContent = container.querySelector('.ytfrozen-list-column[data-list-hash="sub-channels"] .ytfrozen-list-content');
          console.log('[YTFrozen Subs] subColContent:', subColContent, 'rendered:', subColContent?.dataset.rendered);
          if (subColContent && !subColContent.dataset.rendered) {
            subColContent.dataset.rendered = 'true';
            console.log('[YTFrozen Subs] Calling renderListMovies for sub-channels');
            window.YTFrozenListMovie.renderListMovies('sub-channels', subColContent);
          }

          // 各リストカラムにも対応
          lists.forEach(list => {
            const listContent = container.querySelector(`.ytfrozen-list-column[data-list-hash="${list.name}"] .ytfrozen-list-content`);
            if (listContent && !listContent.dataset.rendered) {
              listContent.dataset.rendered = 'true';
              console.log('[YTFrozen Subs] Calling renderListMovies for', list.name);
              window.YTFrozenListMovie.renderListMovies(list.name, listContent);
            }
          });
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
