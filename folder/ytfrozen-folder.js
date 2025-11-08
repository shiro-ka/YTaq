// YTFrozen: チャンネルリスト管理 & アクション用ボタン自動生成

// === リスト管理ユーティリティ ===
const YTFrozenListManager = {
  STORAGE_KEY: 'ytfrozen_channel_lists',

  async getLists() {
    return new Promise(resolve => {
      chrome.storage.local.get([this.STORAGE_KEY], result => {
        const lists = result[this.STORAGE_KEY] || [];
        resolve(lists);
      });
    });
  },

  async addList(name) {
    if (!name) {
      console.warn('[YTFrozenListManager] addList: 名前が空です');
      return;
    }
    const lists = await this.getLists();
    if (lists.find(l => l.name === name)) {
      console.warn('[YTFrozenListManager] addList: 同名のリストが既に存在します:', name);
      return;
    }
    lists.push({ name, channels: [] });
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, resolve);
    });
  },

  async addChannelToList(listName, channelId) {
    if (!listName || !channelId) {
      console.warn('[YTFrozenListManager] addChannelToList: 無効なパラメータ');
      return;
    }
    const lists = await this.getLists();
    const list = lists.find(l => l.name === listName);
    if (!list) {
      console.warn('[YTFrozenListManager] addChannelToList: リストが見つかりません');
      return;
    }

    const channelName = this.getChannelName();
    const channelInfo = {
      id: channelId,
      name: channelName,
      addedAt: Date.now()
    };

    const existingIndex = list.channels.findIndex(ch =>
      (typeof ch === 'string' ? ch : ch.id) === channelId
    );

    if (existingIndex === -1) {
      list.channels.push(channelInfo);
    } else {
      list.channels[existingIndex] = channelInfo;
    }

    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, resolve);
    });
  },

  async removeChannelFromList(listName, channelId) {
    if (!listName || !channelId) {
      console.warn('[YTFrozenListManager] removeChannelFromList: 無効なパラメータ');
      return;
    }
    const lists = await this.getLists();
    const list = lists.find(l => l.name === listName);
    if (!list) {
      console.warn('[YTFrozenListManager] removeChannelFromList: リストが見つかりません');
      return;
    }

    list.channels = list.channels.filter(ch =>
      (typeof ch === 'string' ? ch : ch.id) !== channelId
    );

    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, resolve);
    });
  },

  // 現在のチャンネルIDを取得（URLから）
  getChannelId() {
    const patterns = [
      /\/channel\/([\w-]+)/,
      /\/@([\w-]+)/,
      /\/feed\/subscriptions\/([\w-]+)/,
      /\/c\/([\w-]+)/,
      /\/user\/([\w-]+)/
    ];

    for (const pattern of patterns) {
      const match = location.pathname.match(pattern);
      if (match) {
        let channelId = match[1];
        if (pattern.source.includes('@')) {
          channelId = '@' + channelId;
        }
        return channelId;
      }
    }
    return null;
  },

  // チャンネル名を取得（表示名）
  getChannelName() {
    const selectors = [
      'yt-formatted-string#text.ytd-channel-name',
      '#channel-name yt-formatted-string',
      'ytd-channel-name #text',
      '.ytd-c4-tabbed-header-renderer #text',
      'h1.ytd-channel-name',
      '#text.ytd-channel-name',
      '.ytd-channel-name yt-formatted-string#text',
      '[id*="channel-name"] yt-formatted-string',
      'ytd-channel-name yt-formatted-string',
      'yt-formatted-string[id="text"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent?.trim()) {
        return el.textContent.trim();
      }
    }

    const title = document.title;
    if (title && title.includes(' - YouTube')) {
      const possibleName = title.replace(' - YouTube', '').trim();
      if (possibleName) return possibleName;
    }
    return null;
  },
};
window.YTFrozenListManager = YTFrozenListManager;

// === UI: チャンネルページにボタン追加 ===
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
