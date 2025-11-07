// YTFrozen: チャンネルアクション用ボタン自動生成

// SPA対応: URL変化を監視してボタン生成処理を再実行
(function () {
  function tryInsertButton() {
    const parent = document.querySelector('yt-flexible-actions-view-model');
    if (!parent) return;
    if (parent.querySelector('.ytfrozen-channel-action-btn')) return;
    const btn = document.createElement('button');
    btn.textContent = 'YTFrozenボタン';
    btn.className = 'ytfrozen-channel-action-btn';

    // モーダル生成関数
    function openYTFrozenModal() {
      // 既存モーダル削除
      const old = document.getElementById('ytfrozen-channel-modal');
      if (old) old.remove();
      // オーバーレイ
      const overlay = document.createElement('div');
      overlay.id = 'ytfrozen-channel-modal';

      // モーダル本体
      const modal = document.createElement('div');
      modal.className = 'ytfrozen-folder-modal';

      // 入力欄＋追加ボタン
      const inputWrap = document.createElement('div');
      inputWrap.className = 'ytfrozen-folder-input-wrap';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '新しいリスト名';

      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) return;
        if (!window.YTFrozenListManager) return;
        await window.YTFrozenListManager.addList(name);
        input.value = '';
        // リスト表示を更新
        await renderLists();
      });
      inputWrap.appendChild(input);
      inputWrap.appendChild(addBtn);
      modal.appendChild(inputWrap);

      // タイトル
      const title = document.createElement('div');
      title.className = 'ytfrozen-folder-title';
      title.textContent = 'リストに追加/削除';
      modal.appendChild(title);

      // リスト一覧＋チェックボックス
      const listWrap = document.createElement('div');
      listWrap.className = 'ytfrozen-folder-list-wrap';
      modal.appendChild(listWrap);

      async function renderLists() {
        listWrap.innerHTML = '';
        if (!window.YTFrozenListManager) return;
        const lists = await window.YTFrozenListManager.getLists();
        const channelId = window.YTFrozenListManager.getChannelId();
        lists.forEach(list => {
          const row = document.createElement('div');
          row.className = 'ytfrozen-folder-list-row';

          const label = document.createElement('label');
          label.textContent = list.name;

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          // 新形式（オブジェクト）と旧形式（文字列）の両方をサポート
          const isChannelInList = channelId && list.channels.some(ch => 
            (typeof ch === 'string' ? ch : ch.id) === channelId
          );
          cb.checked = !!isChannelInList;
          
          cb.addEventListener('change', async () => {
            if (!window.YTFrozenListManager) return;
            if (!channelId) return;
            if (cb.checked) {
              await window.YTFrozenListManager.addChannelToList(list.name, channelId);
            } else {
              await window.YTFrozenListManager.removeChannelFromList(list.name, channelId);
            }
            // 変更後にリストを再描画して状態を正しく反映
            await renderLists();
          });
          row.appendChild(label);
          row.appendChild(cb);
          listWrap.appendChild(row);
        });
      }

      // リスト追加時に再描画
      addBtn.addEventListener('click', renderLists);
      // モーダル表示時に初回描画
      renderLists();
      // 閉じるボタン
      const closeBtn = document.createElement('button');
      closeBtn.className = 'ytfrozen-folder-close-btn';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => overlay.remove());
      modal.appendChild(closeBtn);
      overlay.appendChild(modal);
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
    }

    btn.addEventListener('click', openYTFrozenModal);
    parent.appendChild(btn);
  }

  // URL変化検知
  let lastUrl = location.href;
  function checkUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(tryInsertButton, 400); // ページ描画待ち
    }
  }
  setInterval(checkUrlChange, 500);
  // 初回
  setTimeout(tryInsertButton, 400);

  // pushState/replaceStateフック
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function() {
    origPush.apply(this, arguments);
    setTimeout(checkUrlChange, 100);
  };
  history.replaceState = function() {
    origReplace.apply(this, arguments);
    setTimeout(checkUrlChange, 100);
  };
  window.addEventListener('popstate', checkUrlChange);
})();
