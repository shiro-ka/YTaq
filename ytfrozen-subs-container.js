// YTFrozen: 登録チャンネル画面のytd-two-column-browse-results-rendererをラップ
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
    const listHash = JSON.stringify(lists.map(l => l.name));
    if (wrapper.__ytfrozenListSig === listHash) {
      return; // リストに変化がなければ再描画しない
    }

    try {
      isUpdating = true;
      // 既存カラムをクリア
      wrapper.querySelectorAll('.ytfrozen-list-column').forEach(e => e.remove());
      const frag = document.createDocumentFragment();
      // 先頭にsub-channelsカラムを追加
      const subCol = document.createElement('div');
      subCol.className = 'ytfrozen-list-column';
      subCol.textContent = 'sub-channels';
      subCol.dataset.listHash = 'sub-channels';
      frag.appendChild(subCol);
      // 直近3日分の登録チャンネル新着を描画
      try {
        if (window.YTFrozenListMovie && typeof window.YTFrozenListMovie.renderSubChannels === 'function') {
          window.YTFrozenListMovie.renderSubChannels(renderer, subCol);
        }
      } catch (e) {
        console.warn('YTFrozen: renderSubChannels failed', e);
      }
      // 各リストカラムを続けて追加
      lists.forEach(list => {
        const col = document.createElement('div');
        col.className = 'ytfrozen-list-column';
        col.textContent = list.name;
        col.dataset.listHash = listHash;
        frag.appendChild(col);
      });
      // カラムをrendererの直後（子要素の一番最後）に配置
      if (renderer.nextSibling) {
        wrapper.insertBefore(frag, renderer.nextSibling);
      } else {
        wrapper.appendChild(frag);
      }
      // 属性ではなく要素プロパティでシグネチャを保持（MutationObserverを発火させない）
      wrapper.__ytfrozenListSig = listHash;
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
      // 直近の変化から一定時間（静穏期間）経過してから1回だけ実行
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        updateTimer = null;
        wrapSubsRenderer();
      }, 600);
    };

    function startBrowseObserver() {
      const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
      if (!browse) return;
      if (observer) return;
      observer = new MutationObserver((mutationList) => {
        // 自分のコンテナ内の変化のみなら無視して過剰再描画を防ぐ
        const wrapper = browse.querySelector('.ytfrozen-subs-container');
        if (wrapper && mutationList.length > 0) {
          const onlyInsideWrapper = mutationList.every(m => wrapper === m.target || wrapper.contains(m.target));
          if (onlyInsideWrapper) return;
        }
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
