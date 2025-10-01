/* * *
  登録チャンネル画面にhtml要素を作成
  全体のコンテナとしてytfrozen-subs-containerを作成し、その中にリストカラムを作成
* * */




(function() {
  let isUpdating = false;
  async function wrapSubsRenderer() {
    if (isUpdating) return;
    const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
    if (!browse) return;
    const renderer = browse.querySelector('ytd-two-column-browse-results-renderer[page-subtype="subscriptions"]');
    if (!renderer) return;
    // YouTube本体の初期化が終わったか確認（ytd-item-section-rendererが出現してから実行）
    if (!renderer.querySelector('ytd-item-section-renderer')) return;

    // コンテナはrendererを内包する（希望のDOM構造）
    const parent = renderer.parentNode;
    // すでにrendererの親がwrapperならそれを使う
    let wrapper = (renderer.parentElement && renderer.parentElement.classList.contains('ytfrozen-subs-container'))
      ? renderer.parentElement
      : null;
    // まだ無ければ同じ親配下の既存wrapperを探す
    if (!wrapper) {
      wrapper = parent.querySelector(':scope > .ytfrozen-subs-container');
    }
    // それでも無ければ新規作成
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'ytfrozen-subs-container';
      parent.insertBefore(wrapper, renderer); // 先にコンテナを差し込み
    }
    // まだ内包していなければrendererをコンテナ配下に移動
    if (renderer.parentElement !== wrapper) {
      wrapper.appendChild(renderer);
    }

    // カラム生成（リストごと）
    if (!window.YTFrozenListManager) return;
  const lists = await window.YTFrozenListManager.getLists();
    
    // すでに同じ構成のカラムが存在するかチェック
    const existingColumns = wrapper.querySelectorAll('.ytfrozen-list-column');
    const expectedCount = lists.length + 1; // sub-channels + リスト数
    // 既存カラムのdata-list-hashがリスト名のみかどうかチェック
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
      wrapper.querySelectorAll('.ytfrozen-list-column').forEach(e => e.remove());
      const frag = document.createDocumentFragment();
      // 先頭にsub-channelsカラムを追加
      const subCol = document.createElement('div');
      subCol.className = 'ytfrozen-list-column';
      subCol.dataset.listHash = 'sub-channels';
      // カラムヘッダー
      const subHeader = document.createElement('div');
      subHeader.textContent = '登録チャンネル';
      subHeader.style.cssText = 'font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.2);';
      subCol.appendChild(subHeader);
      // 動画リストコンテナ
      const subContent = document.createElement('div');
      subContent.className = 'ytfrozen-list-content';
      subCol.appendChild(subContent);
      frag.appendChild(subCol);
      // 各リストカラムを続けて追加
      lists.forEach(list => {
        const col = document.createElement('div');
        col.className = 'ytfrozen-list-column';
        col.dataset.listHash = list.name;
        // リストヘッダー
        const header = document.createElement('div');
        header.textContent = list.name;
        header.style.cssText = 'font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.2);';
        col.appendChild(header);
        // リストコンテンツ
        const content = document.createElement('div');
        content.className = 'ytfrozen-list-content';
        col.appendChild(content);
        frag.appendChild(col);
      });
      // カラムをrendererの直後（子要素の一番最後）に配置
      if (renderer.nextSibling) {
        wrapper.insertBefore(frag, renderer.nextSibling);
      } else {
        wrapper.appendChild(frag);
      }
      // wrapper自体にはdata-list-hashを付与しない
      
      // 動画リストを各カラムに描画（一度だけ）
      setTimeout(() => {
        if (window.YTFrozenListMovie) {
          // sub-channelsカラムに新着動画を表示（まだ描画されていない場合のみ）
          const subColContent = wrapper.querySelector('.ytfrozen-list-column[data-list-hash="sub-channels"] .ytfrozen-list-content');
          if (subColContent && !subColContent.dataset.rendered) {
            subColContent.dataset.rendered = 'true';
            window.YTFrozenListMovie.renderListMovies('sub-channels', subColContent);
          }
          
          // 各リストカラムにも対応（今後拡張予定）
          lists.forEach(list => {
            const listContent = wrapper.querySelector(`.ytfrozen-list-column[data-list-hash="${list.name}"] .ytfrozen-list-content`);
            if (listContent && !listContent.dataset.rendered) {
              listContent.dataset.rendered = 'true';
              window.YTFrozenListMovie.renderListMovies(list.name, listContent);
            }
          });
        }
      }, 100);
      
    } finally {
      isUpdating = false;
    }
  }

  // MutationObserverでsubscriptionsページのDOM変化を監視
  function observeSubsPage() {
    let lastUrl = location.href;
    let observer = null;
    let bodyObserver = null;

    let updateTimer = null;
    const scheduleRender = () => {
      if (updateTimer) return;
      updateTimer = setTimeout(() => {
        updateTimer = null;
        wrapSubsRenderer();
      }, 300); // デバウンス時間を長くしてチラつきを軽減
    };

    function startBrowseObserver() {
      const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
      if (!browse) return;
      if (observer) return;
      observer = new MutationObserver(() => {
        // 連続変化をデバウンス
        scheduleRender();
      });
      observer.observe(browse, { childList: true, subtree: true });
      wrapSubsRenderer();
    }

    function startBodyObserver() {
      if (bodyObserver) return;
      bodyObserver = new MutationObserver(() => {
        const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
        if (browse) {
          bodyObserver.disconnect();
          bodyObserver = null;
          startBrowseObserver();
        }
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
      // 念のため即時チェック
      const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
      if (browse) {
        bodyObserver.disconnect();
        bodyObserver = null;
        startBrowseObserver();
      }
    }

    // URL変化も監視（SPA遷移対策）
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (bodyObserver) {
          bodyObserver.disconnect();
          bodyObserver = null;
        }
        startBodyObserver();
      }
    }, 500);
    // 初回
    startBodyObserver();
  }
  observeSubsPage();
})();
