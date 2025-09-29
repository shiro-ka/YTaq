// YTFrozen: チャンネルリスト管理ユーティリティ
const YTFrozenListManager = {
  STORAGE_KEY: 'ytfrozen_channel_lists',

  async getLists() {
    return new Promise(resolve => {
      chrome.storage.local.get([this.STORAGE_KEY], result => {
        resolve(result[this.STORAGE_KEY] || []);
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
    if (!listName || !channelId) return;
    const lists = await this.getLists();
    const list = lists.find(l => l.name === listName);
    if (!list) return;
    if (!list.channels.includes(channelId)) list.channels.push(channelId);
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: lists }, () => resolve());
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
    if (m) return m[1];
    const m2 = location.pathname.match(/\/@([\w-]+)/);
    if (m2) return '@' + m2[1];
    return null;
  },
};
window.YTFrozenListManager = YTFrozenListManager;
