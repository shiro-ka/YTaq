/* * *
  リスト（フォルダ）機能: 登録したチャンネルの動画をリスト別に表示
 * * */

(function() {

  // リストのデバッグ情報を取得
  async function getListDebugInfo(listName) {
    if (!window.YTaqListManager) return 'ListManagerなし';

    try {
      const lists = await window.YTaqListManager.getLists();
      const list = lists.find(l => l.name === listName);

      if (!list) return 'リストが存在しません';
      if (!list.channels || list.channels.length === 0) return 'チャンネル未登録';

      return `チャンネル${list.channels.length}件: ${list.channels.join(', ')}`;
    } catch (error) {
      return `エラー: ${error.message}`;
    }
  }

  // 動画要素を作成してコンテナに追加（共通処理）
  function appendVideoElement(container, video) {
    if (video.isUpcoming || video.isPremiere || video.isLive) {
      // 予定動画（コンパクト表示）
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
      // 公開済み動画（サムネイル付き）
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

  // リスト内チャンネルの新着動画を取得
  async function getListChannelVideos(listName) {
    if (!window.YTaqListManager) {
      console.warn(`[${listName}] YTaqListManagerが利用できません`);
      return [];
    }

    try {
      // リスト情報を取得
      const lists = await window.YTaqListManager.getLists();
      console.log(`[${listName}] 全リスト:`, lists);

      const list = lists.find(l => l.name === listName);
      if (!list) {
        console.warn(`[${listName}] リストが見つかりません`);
        return [];
      }

      if (!list.channels || list.channels.length === 0) {
        console.warn(`[${listName}] リストにチャンネルが登録されていません:`, list);
        return [];
      }

      console.log(`[${listName}] チャンネル数: ${list.channels.length}`, list.channels);

      const allVideos = [];

      // 各チャンネルの動画を取得
      for (const channelEntry of list.channels) {
        try {
          // 旧形式（文字列）と新形式（オブジェクト）の両方をサポート
          const channelId = typeof channelEntry === 'string' ? channelEntry : channelEntry.id;
          const channelName = typeof channelEntry === 'string' ? null : channelEntry.name;

          console.log(`[${channelId}] 動画取得開始`, channelName ? `(表示名: ${channelName})` : '');
          const channelVideos = await getChannelRecentVideos(channelId, channelName);

          // 全動画を追加（予定動画も含める）
          if (channelVideos.length > 0) {
            console.log(`[${channelId}] ${channelVideos.length}件の動画を取得`);
            allVideos.push(...channelVideos);
          } else {
            console.warn(`[${channelId}] 動画が見つかりませんでした`);
          }
        } catch (error) {
          console.warn(`[${channelEntry}] 動画取得エラー:`, error);
        }
      }

      // 投稿日時でソート（新しい順）
      allVideos.sort((a, b) => b.publishedDate - a.publishedDate);

      console.log(`[${listName}] 合計 ${allVideos.length}件の動画`);
      return allVideos;

    } catch (error) {
      console.error(`[${listName}] リスト動画取得エラー:`, error);
      return [];
    }
  }

  // 指定チャンネルの最近の動画を取得（RSS Feed使用）
  async function getChannelRecentVideos(channelId, channelName = null) {
    try {
      console.log(`[${channelId}] RSS Feedから動画取得開始`);

      // @形式のチャンネルIDはRSS Feedで使えないため、スキップ
      if (channelId.startsWith('@')) {
        console.warn(`[${channelId}] @形式のチャンネルIDはRSS Feedで使用できません。UC形式のIDが必要です。`);
        return [];
      }

      // YouTube RSS FeedのURL
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

      // RSSをfetch
      const response = await fetch(rssUrl);
      if (!response.ok) {
        console.warn(`[${channelId}] RSS Fetch失敗: ${response.status}`);
        return [];
      }

      const xmlText = await response.text();

      // XMLをパース
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // エラーチェック
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        console.error(`[${channelId}] XML解析エラー:`, parserError.textContent);
        return [];
      }

      // <entry>要素から動画情報を抽出
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
          console.warn(`[${channelId}] 動画エントリ解析エラー:`, error);
        }
      }

      console.log(`[${channelId}] RSS Feedから ${videos.length}件の動画を取得`);
      return videos;

    } catch (error) {
      console.error(`[${channelId}] RSS取得エラー:`, error);
      return [];
    }
  }

  // 日付フォーマット関数
  function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}日前`;
    if (hours > 0) return `${hours}時間前`;
    return '1時間以内';
  }

  // リスト用の動画リストを描画
  async function renderListChannelVideos(listName, container) {
    console.log(`[${listName}] リスト動画描画開始`);

    // 既に描画済みかチェック
    if (container.children.length > 0 && !container.innerHTML.includes('取得中')) {
      console.log(`[${listName}] 既に描画済み、スキップ`);
      return;
    }

    // ローディング表示
    container.innerHTML = '<div style="padding: 12px; color: #ccc;">リスト動画を取得中...</div>';

    try {
      const videos = await getListChannelVideos(listName);

      container.innerHTML = ''; // クリア

      if (videos.length === 0) {
        const debugInfo = await getListDebugInfo(listName);
        container.innerHTML = `
          <div style="padding: 12px; color: #ccc;">
            [${listName}] に動画がないか、チャンネルが登録されていません<br/>
            <small style="color: #888;">デバッグ情報: ${debugInfo}</small>
          </div>`;
        return;
      }

      // 予定動画と公開済み動画を分離
      const upcomingVideos = videos.filter(v => v.isUpcoming || v.isPremiere || v.isLive);
      const publishedVideos = videos.filter(v => !v.isUpcoming && !v.isPremiere && !v.isLive);

      // 予定動画と公開済み動画を順に追加
      [...upcomingVideos, ...publishedVideos].forEach(video => {
        appendVideoElement(container, video);
      });

    } catch (error) {
      console.error(`[${listName}] 動画リスト描画エラー:`, error);
      container.innerHTML = `<div style="padding: 12px; color: #f88;">[${listName}] の動画取得に失敗しました</div>`;
    }
  }

  // 指定リストの動画を取得してカラムに描画する関数
  async function renderListMovies(listName, container) {
    await renderListChannelVideos(listName, container);
  }

  // グローバル公開
  window.YTaqListMovie = {
    renderListMovies,
  };

  // === リストカラムを #primary に追加 ===
  let isUpdating = false;

  async function createListColumns() {
    if (isUpdating) return;

    // 登録チャンネル画面かつ #ytaq ハッシュがある場合のみ実行
    const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
    if (!browse) return;
    if (!location.hash.includes('ytaq')) return;

    // YouTubeの#primary要素を探す
    const primary = browse.querySelector('#primary.ytd-two-column-browse-results-renderer');
    if (!primary) {
      console.log('[YTaq Folder] #primary not found');
      return;
    }

    try {
      isUpdating = true;

      if (!window.YTaqListManager) {
        console.warn('[YTaq Folder] YTaqListManager が利用できません');
        return;
      }

      // リスト一覧を取得
      const lists = await window.YTaqListManager.getLists();
      console.log('[YTaq Folder] リスト:', lists);

      // 既存のカラムを取得
      const existingColumns = primary.querySelectorAll('.ytaq-list-column');
      const existingListNames = new Set(
        Array.from(existingColumns).map(col => col.dataset.listHash)
      );

      // 各リストのカラムを作成（まだ存在しないもののみ）
      for (const list of lists) {
        // 既に存在するカラムはスキップ
        if (existingListNames.has(list.name)) {
          console.log(`[YTaq Folder] カラム "${list.name}" は既に存在します`);
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

        // #primaryに追加
        primary.appendChild(column);

        console.log(`[YTaq Folder] カラム "${list.name}" を追加しました`);

        // 動画リストを描画
        setTimeout(() => {
          if (!content.dataset.rendered) {
            content.dataset.rendered = 'true';
            renderListMovies(list.name, content);
          }
        }, 100);
      }

      // 削除されたリストのカラムを削除
      for (const column of existingColumns) {
        const listName = column.dataset.listHash;
        if (!lists.find(l => l.name === listName)) {
          console.log(`[YTaq Folder] カラム "${listName}" を削除します（リストが存在しない）`);
          column.remove();
        }
      }

    } finally {
      isUpdating = false;
    }
  }

  // 定期的にチェック
  setInterval(createListColumns, 1500);

  // 初回実行
  createListColumns();
})();
