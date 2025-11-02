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
    btn.style.margin = '0 8px';
    btn.style.padding = '6px 16px';
    btn.style.background = '#88c0d0';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '14px';

    // モーダル生成関数
    function openYTFrozenModal() {
      // 既存モーダル削除
      const old = document.getElementById('ytfrozen-channel-modal');
      if (old) old.remove();
      // オーバーレイ
      const overlay = document.createElement('div');
      overlay.id = 'ytfrozen-channel-modal';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.background = 'rgba(0,0,0,0.45)';
      overlay.style.zIndex = '99999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      // モーダル本体
      const modal = document.createElement('div');
      modal.style.background = '#2e3440';
      modal.style.color = '#fff';
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 4px 32px #0008';
      modal.style.padding = '32px 40px';
      modal.style.minWidth = '240px';
      modal.style.fontSize = '1.2em';
      modal.style.position = 'relative';
      // 入力欄＋追加ボタン
      const inputWrap = document.createElement('div');
      inputWrap.style.display = 'flex';
      inputWrap.style.alignItems = 'center';
      inputWrap.style.marginBottom = '16px';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '新しいリスト名';
      input.style.flex = '1';
      input.style.padding = '6px 10px';
      input.style.borderRadius = '6px';
      input.style.border = '1px solid #888';
      input.style.marginRight = '8px';
      input.style.fontSize = '1em';
      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.style.padding = '6px 16px';
      addBtn.style.background = '#88c0d0';
      addBtn.style.color = '#fff';
      addBtn.style.border = 'none';
      addBtn.style.borderRadius = '6px';
      addBtn.style.cursor = 'pointer';
      addBtn.style.fontSize = '1.1em';
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
      title.textContent = 'リストに追加/削除';
      title.style.fontWeight = 'bold';
      title.style.fontSize = '1.2em';
      title.style.marginBottom = '12px';
      modal.appendChild(title);

      // リスト一覧＋チェックボックス
      const listWrap = document.createElement('div');
      listWrap.style.marginTop = '10px';
      listWrap.style.display = 'flex';
      listWrap.style.flexDirection = 'column';
      modal.appendChild(listWrap);

      async function renderLists() {
        listWrap.innerHTML = '';
        if (!window.YTFrozenListManager) return;
        const lists = await window.YTFrozenListManager.getLists();
        const channelId = window.YTFrozenListManager.getChannelId();
        lists.forEach(list => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.marginBottom = '6px';
          const label = document.createElement('label');
          label.style.flex = '1';
          label.style.cursor = 'pointer';
          label.textContent = list.name;
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.style.marginLeft = '12px';
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
      closeBtn.textContent = '×';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '8px';
      closeBtn.style.right = '12px';
      closeBtn.style.background = 'none';
      closeBtn.style.border = 'none';
      closeBtn.style.color = '#fff';
      closeBtn.style.fontSize = '1.3em';
      closeBtn.style.cursor = 'pointer';
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
