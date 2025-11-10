// YTFrozen: チャンネルリスト管理ユーティリティ
// 設定画面やコンテンツスクリプトから共通で使用可能

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

  async removeList(name) {
    if (!name) {
      console.warn('[YTFrozenListManager] removeList: 名前が空です');
      return;
    }
    const lists = await this.getLists();
    const filtered = lists.filter(l => l.name !== name);
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: filtered }, resolve);
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

// グローバルに公開
window.YTFrozenListManager = YTFrozenListManager;
