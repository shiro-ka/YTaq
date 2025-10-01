// YTFrozen: チャンネルリスト管理ユーティリティ
const YTFrozenListManager = {
  STORAGE_KEY: 'ytfrozen_channel_lists',
  
  // テスト用: ダミーリストを作成
  async createTestData() {
    const testLists = [
      {
        name: 'テストリスト1',
        channels: ['@example1', '@example2']
      },
      {
        name: 'テストリスト2', 
        channels: ['UC1234567890123456789', '@testchannel']
      }
    ];
    
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: testLists }, () => {
        console.log('[YTFrozenListManager] テストデータ作成完了:', testLists);
        resolve();
      });
    });
  },

  async getLists() {
    return new Promise(resolve => {
      chrome.storage.local.get([this.STORAGE_KEY], result => {
        const lists = result[this.STORAGE_KEY] || [];
        console.log('[YTFrozenListManager] リスト取得:', lists);
        resolve(lists);
      });
    });
  },

  async addList(name) {
    if (!name) return;
    const lists = await this.getLists();
    if (lists.find(l => l.name === name)) return; // 重複防止
    lists.push({ name, channels: [] });
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, () => resolve());
    });
  },

  async addChannelToList(listName, channelId) {
    if (!listName || !channelId) {
      console.warn('[YTFrozenListManager] addChannelToList: 無効なパラメータ', { listName, channelId });
      return;
    }
    const lists = await this.getLists();
    const list = lists.find(l => l.name === listName);
    if (!list) {
      console.warn('[YTFrozenListManager] addChannelToList: リストが見つかりません', listName);
      return;
    }
    
    // チャンネル情報を拡張（IDと表示名の両方を保存）
    const channelName = this.getChannelName();
    const channelInfo = {
      id: channelId,
      name: channelName,
      addedAt: Date.now()
    };
    
    // 既存の形式との互換性を保つため、文字列とオブジェクトの両方をサポート
    const existingIndex = list.channels.findIndex(ch => 
      (typeof ch === 'string' ? ch : ch.id) === channelId
    );
    
    if (existingIndex === -1) {
      list.channels.push(channelInfo);
      console.log('[YTFrozenListManager] チャンネルをリストに追加:', { listName, channelInfo, channels: list.channels });
    } else {
      // 既存エントリを更新
      list.channels[existingIndex] = channelInfo;
      console.log('[YTFrozenListManager] チャンネル情報を更新:', { listName, channelInfo });
    }
    
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, () => {
        console.log('[YTFrozenListManager] ストレージに保存完了:', lists);
        resolve();
      });
    });
  },

  async removeChannelFromList(listName, channelId) {
    if (!listName || !channelId) return;
    const lists = await this.getLists();
    const list = lists.find(l => l.name === listName);
    if (!list) return;
    list.channels = list.channels.filter(id => id !== channelId);
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, () => resolve());
    });
  },

  // 現在のチャンネルIDを取得（URLから）
  getChannelId() {
    // /channel/UCxxxx... or /@xxxx 形式に対応
    const m = location.pathname.match(/\/channel\/([\w-]+)/);
    if (m) {
      console.log('[YTFrozenListManager] チャンネルID取得 (UC形式):', m[1]);
      return m[1];
    }
    const m2 = location.pathname.match(/\/@([\w-]+)/);
    if (m2) {
      const channelId = '@' + m2[1];
      console.log('[YTFrozenListManager] チャンネルID取得 (@形式):', channelId);
      return channelId;
    }
    console.warn('[YTFrozenListManager] チャンネルIDを取得できませんでした:', location.pathname);
    return null;
  },
  
  // チャンネル名も取得する（表示名）
  getChannelName() {
    // チャンネル名を取得
    const selectors = [
      'yt-formatted-string#text.ytd-channel-name', // メインのチャンネル名
      '#channel-name yt-formatted-string',
      'ytd-channel-name #text',
      '.ytd-c4-tabbed-header-renderer #text',
      'h1.ytd-channel-name',
      '#text.ytd-channel-name',
      '.ytd-channel-name yt-formatted-string#text'
    ];
    
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent?.trim()) {
        const name = el.textContent.trim();
        console.log('[YTFrozenListManager] チャンネル名取得:', name);
        return name;
      }
    }
    
    console.warn('[YTFrozenListManager] チャンネル名を取得できませんでした');
    return null;
  },
};
window.YTFrozenListManager = YTFrozenListManager;
