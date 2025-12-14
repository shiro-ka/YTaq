// YTaq: チャンネルページにリスト管理ボタンを追加するUI
// 依存: ytaq-folder-manager.js (YTaqListManager)

// === UI: チャンネルページにボタン追加 ===
// SPA対応: URL変化を監視してボタン生成処理を再実行
(function () {
  function tryInsertButton() {
    const parent = document.querySelector('yt-flexible-actions-view-model');
    if (!parent) return;
    if (parent.querySelector('.ytaq-channel-action-btn')) return;
    const btn = document.createElement('button');
    btn.textContent = 'YTaqボタン';
    btn.className = 'ytaq-channel-action-btn';

    // モーダル生成関数
    function openYTaqModal() {
      // 既存モーダル削除
      const old = document.getElementById('ytaq-channel-modal');
      if (old) old.remove();
      // オーバーレイ
      const overlay = document.createElement('div');
      overlay.id = 'ytaq-channel-modal';

      // モーダル本体
      const modal = document.createElement('div');
      modal.className = 'ytaq-folder-modal';

      // 入力欄＋追加ボタン
      const inputWrap = document.createElement('div');
      inputWrap.className = 'ytaq-folder-input-wrap';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '新しいリスト名';

      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) return;
        if (!window.YTaqListManager) return;
        await window.YTaqListManager.addList(name);
        input.value = '';
        // リスト表示を更新
        await renderLists();
      });
      inputWrap.appendChild(input);
      inputWrap.appendChild(addBtn);
      modal.appendChild(inputWrap);

      // タイトル
      const title = document.createElement('div');
      title.className = 'ytaq-folder-title';
      title.textContent = 'リストに追加/削除';
      modal.appendChild(title);

      // リスト一覧＋チェックボックス
      const listWrap = document.createElement('div');
      listWrap.className = 'ytaq-folder-list-wrap';
      modal.appendChild(listWrap);

      async function renderLists() {
        listWrap.innerHTML = '';
        if (!window.YTaqListManager) return;
        const lists = await window.YTaqListManager.getLists();
        const channelId = window.YTaqListManager.getChannelId();
        lists.forEach(list => {
          const row = document.createElement('div');
          row.className = 'ytaq-folder-list-row';

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
            if (!window.YTaqListManager) return;
            if (!channelId) return;
            if (cb.checked) {
              await window.YTaqListManager.addChannelToList(list.name, channelId);
            } else {
              await window.YTaqListManager.removeChannelFromList(list.name, channelId);
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
      closeBtn.className = 'ytaq-folder-close-btn';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => overlay.remove());
      modal.appendChild(closeBtn);
      overlay.appendChild(modal);
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
    }

    btn.addEventListener('click', openYTaqModal);
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
