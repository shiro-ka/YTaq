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
    if (!name) {
      console.warn('[YTFrozenListManager] addList: 名前が空です');
      return;
    }
    const lists = await this.getLists();
    if (lists.find(l => l.name === name)) {
      console.warn('[YTFrozenListManager] addList: 同名のリストが既に存在します:', name);
      return; // 重複防止
    }
    lists.push({ name, channels: [] });
    console.log('[YTFrozenListManager] 新しいリストを追加:', name);
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, () => {
        console.log('[YTFrozenListManager] リスト保存完了:', lists);
        resolve();
      });
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
    if (!listName || !channelId) {
      console.warn('[YTFrozenListManager] removeChannelFromList: 無効なパラメータ', { listName, channelId });
      return;
    }
    const lists = await this.getLists();
    const list = lists.find(l => l.name === listName);
    if (!list) {
      console.warn('[YTFrozenListManager] removeChannelFromList: リストが見つかりません', listName);
      return;
    }
    
    // 新形式（オブジェクト）と旧形式（文字列）の両方をサポート
    const beforeCount = list.channels.length;
    list.channels = list.channels.filter(ch => 
      (typeof ch === 'string' ? ch : ch.id) !== channelId
    );
    const afterCount = list.channels.length;
    
    console.log('[YTFrozenListManager] チャンネルをリストから削除:', { 
      listName, 
      channelId, 
      removed: beforeCount > afterCount,
      beforeCount,
      afterCount 
    });
    
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, () => {
        console.log('[YTFrozenListManager] ストレージに保存完了:', lists);
        resolve();
      });
    });
  },

  // 現在のチャンネルIDを取得（URLから）
  getChannelId() {
    // 複数のURLパターンに対応
    const patterns = [
      /\/channel\/([\w-]+)/,           // /channel/UCxxxx...
      /\/@([\w-]+)/,                   // /@username
      /\/feed\/subscriptions\/([\w-]+)/, // /feed/subscriptions/UCxxxx...
      /\/c\/([\w-]+)/,                 // /c/channelname
      /\/user\/([\w-]+)/               // /user/username
    ];
    
    for (const pattern of patterns) {
      const match = location.pathname.match(pattern);
      if (match) {
        let channelId = match[1];
        
        // @形式の場合は@を追加
        if (pattern.source.includes('@')) {
          channelId = '@' + channelId;
        }
        
        console.log('[YTFrozenListManager] チャンネルID取得:', channelId, 'from', location.pathname);
        return channelId;
      }
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
      '.ytd-channel-name yt-formatted-string#text',
      // 追加: より一般的なセレクタ
      '[id*="channel-name"] yt-formatted-string',
      'ytd-channel-name yt-formatted-string',
      'yt-formatted-string[id="text"]'
    ];
    
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent?.trim()) {
        const name = el.textContent.trim();
        console.log('[YTFrozenListManager] チャンネル名取得:', name, 'from selector:', selector);
        return name;
      }
    }
    
    // フォールバック: タイトルタグからチャンネル名を推測
    const title = document.title;
    if (title && title.includes(' - YouTube')) {
      const possibleName = title.replace(' - YouTube', '').trim();
      if (possibleName) {
        console.log('[YTFrozenListManager] チャンネル名取得 (タイトルから):', possibleName);
        return possibleName;
      }
    }
    
    console.warn('[YTFrozenListManager] チャンネル名を取得できませんでした');
    return null;
  },
};
window.YTFrozenListManager = YTFrozenListManager;
