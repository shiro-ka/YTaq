(function() {

  async function getLists() {
    const data = await window.YTaqFolders.get();
    return data.folders.map(f => ({
      name: f.name,
      channels: f.channels.map(id => ({ id, name: (data.channels[id] || {}).name || null }))
    }));
  }
  async function getListDebugInfo(listName) {

    try {
      const lists = await getLists();
      const list = lists.find(l => l.name === listName);

      if (!list) return 'リストが存在しません';
      if (!list.channels || list.channels.length === 0) return 'チャンネル未登録';

      return `チャンネル${list.channels.length}件: ${list.channels.join(', ')}`;
    } catch (error) {
      return `エラー: ${error.message}`;
    }
  }

  function appendVideoElement(container, video) {
    if (video.isUpcoming || video.isPremiere || video.isLive) {
      const videoDiv = document.createElement('div');
      videoDiv.className = 'ytaq-upcoming-item';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'ytaq-video-title';
      titleDiv.textContent = video.title;
      videoDiv.appendChild(titleDiv);

      const metaDiv = document.createElement('div');
      metaDiv.className = 'ytaq-video-meta';

      const channelDiv = document.createElement('div');
      channelDiv.className = 'ytaq-video-channel';
      channelDiv.textContent = video.channel;
      metaDiv.appendChild(channelDiv);

      const dateDiv = document.createElement('div');
      dateDiv.className = 'ytaq-video-date';
      dateDiv.textContent = video.publishedText;
      metaDiv.appendChild(dateDiv);

      videoDiv.appendChild(metaDiv);

      videoDiv.addEventListener('click', () => {
        if (video.videoId && window.YTaqPopup) {
          window.YTaqPopup.showVideoPopup(video.videoId, video.title);
        } else if (video.url) {
          window.open(video.url, '_blank');
        }
      });

      container.appendChild(videoDiv);
    } else {
      const videoDiv = document.createElement('div');
      videoDiv.className = 'ytaq-video-item';

      const img = document.createElement('img');
      img.src = video.thumbnail;
      videoDiv.appendChild(img);

      const infoDiv = document.createElement('div');
      infoDiv.style.flex = '1';
      infoDiv.style.minWidth = '0';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'ytaq-video-title';
      titleDiv.textContent = video.title;
      infoDiv.appendChild(titleDiv);

      const channelDiv = document.createElement('div');
      channelDiv.className = 'ytaq-video-channel';
      channelDiv.textContent = video.channel;
      infoDiv.appendChild(channelDiv);

      const dateDiv = document.createElement('div');
      dateDiv.className = 'ytaq-video-date';
      dateDiv.textContent = video.publishedText;
      infoDiv.appendChild(dateDiv);

      videoDiv.appendChild(infoDiv);

      videoDiv.addEventListener('click', () => {
        if (video.videoId && window.YTaqPopup) {
          window.YTaqPopup.showVideoPopup(video.videoId, video.title);
        } else if (video.url) {
          window.open(video.url, '_blank');
        }
      });

      container.appendChild(videoDiv);
    }
  }

  async function getListChannelVideos(listName) {

    try {
      const lists = await getLists();
      window.YTaq.log(`[${listName}] 全リスト:`, lists);

      const list = lists.find(l => l.name === listName);
      if (!list) {
        window.YTaq.warn(`[${listName}] リストが見つかりません`);
        return [];
      }

      if (!list.channels || list.channels.length === 0) {
        window.YTaq.warn(`[${listName}] リストにチャンネルが登録されていません:`, list);
        return [];
      }

      window.YTaq.log(`[${listName}] チャンネル数: ${list.channels.length}`, list.channels);

      const allVideos = [];

      for (const channelEntry of list.channels) {
        try {
          const channelId = typeof channelEntry === 'string' ? channelEntry : channelEntry.id;
          const channelName = typeof channelEntry === 'string' ? null : channelEntry.name;

          window.YTaq.log(`[${channelId}] 動画取得開始`, channelName ? `(表示名: ${channelName})` : '');
          const channelVideos = await getChannelRecentVideos(channelId, channelName);

          if (channelVideos.length > 0) {
            window.YTaq.log(`[${channelId}] ${channelVideos.length}件の動画を取得`);
            allVideos.push(...channelVideos);
          } else {
            window.YTaq.warn(`[${channelId}] 動画が見つかりませんでした`);
          }
        } catch (error) {
          window.YTaq.warn(`[${channelEntry}] 動画取得エラー:`, error);
        }
      }

      allVideos.sort((a, b) => b.publishedDate - a.publishedDate);

      window.YTaq.log(`[${listName}] 合計 ${allVideos.length}件の動画`);
      return allVideos;

    } catch (error) {
      console.error(`[${listName}] リスト動画取得エラー:`, error);
      return [];
    }
  }

  async function getChannelRecentVideos(channelId, channelName = null) {
    try {
      window.YTaq.log(`[${channelId}] RSS Feedから動画取得開始`);

      if (channelId.startsWith('@')) {
        window.YTaq.warn(`[${channelId}] @形式のチャンネルIDはRSS Feedで使用できません。UC形式のIDが必要です。`);
        return [];
      }

      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

      const response = await fetch(rssUrl);
      if (!response.ok) {
        window.YTaq.warn(`[${channelId}] RSS Fetch失敗: ${response.status}`);
        return [];
      }

      const xmlText = await response.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        console.error(`[${channelId}] XML解析エラー:`, parserError.textContent);
        return [];
      }

      const entries = xmlDoc.querySelectorAll('entry');
      const videos = [];

      for (const entry of entries) {
        try {
          const videoId = entry.querySelector('yt\\:videoId, videoId')?.textContent;
          const title = entry.querySelector('title')?.textContent;
          const published = entry.querySelector('published')?.textContent;
          const author = entry.querySelector('author name')?.textContent || channelName || 'Unknown';

          if (!videoId) continue;

          videos.push({
            videoId: videoId,
            title: title || 'Untitled',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            channel: author,
            publishedDate: published ? new Date(published) : new Date(),
            publishedText: published ? formatDate(new Date(published)) : '不明',
            isLive: false,
            isPremiere: false,
            isUpcoming: false
          });
        } catch (error) {
          window.YTaq.warn(`[${channelId}] 動画エントリ解析エラー:`, error);
        }
      }

      window.YTaq.log(`[${channelId}] RSS Feedから ${videos.length}件の動画を取得`);
      return videos;

    } catch (error) {
      console.error(`[${channelId}] RSS取得エラー:`, error);
      return [];
    }
  }

  function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}日前`;
    if (hours > 0) return `${hours}時間前`;
    return '1時間以内';
  }

  async function renderListChannelVideos(listName, container) {
    window.YTaq.log(`[${listName}] リスト動画描画開始`);

    if (container.children.length > 0 && !container.innerHTML.includes('取得中')) {
      window.YTaq.log(`[${listName}] 既に描画済み、スキップ`);
      return;
    }

    container.innerHTML = '<div style="padding: 12px; color: #ccc;">リスト動画を取得中...</div>';

    try {
      const videos = await getListChannelVideos(listName);

      container.innerHTML = '';

      if (videos.length === 0) {
        const debugInfo = await getListDebugInfo(listName);
        container.innerHTML = `
          <div style="padding: 12px; color: #ccc;">
            [${listName}] に動画がないか、チャンネルが登録されていません<br/>
            <small style="color: #888;">デバッグ情報: ${debugInfo}</small>
          </div>`;
        return;
      }

      const upcomingVideos = videos.filter(v => v.isUpcoming || v.isPremiere || v.isLive);
      const publishedVideos = videos.filter(v => !v.isUpcoming && !v.isPremiere && !v.isLive);

      [...upcomingVideos, ...publishedVideos].forEach(video => {
        appendVideoElement(container, video);
      });

    } catch (error) {
      console.error(`[${listName}] 動画リスト描画エラー:`, error);
      container.innerHTML = `<div style="padding: 12px; color: #f88;">[${listName}] の動画取得に失敗しました</div>`;
    }
  }

  async function renderListMovies(listName, container) {
    await renderListChannelVideos(listName, container);
  }

  window.YTaqListMovie = {
    renderListMovies,
  };

  let isUpdating = false;

  async function createListColumns() {
    if (isUpdating) return;

    const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
    if (!browse) return;
    if (!location.hash.includes('ytaq')) return;

    const primary = browse.querySelector('#primary.ytd-two-column-browse-results-renderer');
    if (!primary) {
      window.YTaq.log('[YTaq Folder] #primary not found');
      return;
    }

    try {
      isUpdating = true;

      const lists = await getLists();
      window.YTaq.log('[YTaq Folder] リスト:', lists);

      const existingColumns = primary.querySelectorAll('.ytaq-list-column');
      const existingListNames = new Set(
        Array.from(existingColumns).map(col => col.dataset.listHash)
      );

      for (const list of lists) {
        if (existingListNames.has(list.name)) {
          window.YTaq.log(`[YTaq Folder] カラム "${list.name}" は既に存在します`);
          continue;
        }

        const column = document.createElement('div');
        column.className = 'ytaq-list-column';
        column.dataset.listHash = list.name;

        const header = document.createElement('div');
        header.className = 'ytaq-header';
        header.textContent = list.name;
        column.appendChild(header);

        const content = document.createElement('div');
        content.className = 'ytaq-list-content';
        column.appendChild(content);

        primary.appendChild(column);

        window.YTaq.log(`[YTaq Folder] カラム "${list.name}" を追加しました`);

        setTimeout(() => {
          if (!content.dataset.rendered) {
            content.dataset.rendered = 'true';
            renderListMovies(list.name, content);
          }
        }, 100);
      }

      for (const column of existingColumns) {
        const listName = column.dataset.listHash;
        if (!lists.find(l => l.name === listName)) {
          window.YTaq.log(`[YTaq Folder] カラム "${listName}" を削除します（リストが存在しない）`);
          column.remove();
        }
      }

    } finally {
      isUpdating = false;
    }
  }

  function setup() {
    if (!location.pathname.startsWith('/feed/subscriptions')) return;
    if (!location.hash.includes('ytaq')) return;
    window.YTaq.waitFor(
      'ytd-browse[page-subtype="subscriptions"] #primary.ytd-two-column-browse-results-renderer',
      createListColumns
    );
  }

  window.YTaq.ready(setup);
  window.YTaq.onNavigate(setup);
  window.YTaq.onStorageChange('ytaq_folders', setup);

  window.YTaq.onMutation(() => {
    if (!location.pathname.startsWith('/feed/subscriptions')) return;
    if (!location.hash.includes('ytaq')) return;
    if (document.querySelector('.ytaq-list-column')) return;
    setup();
  });
})();
