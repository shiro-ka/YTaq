/* * *
  登録チャンネルの新着動画を取得して表示
 * * */

(function() {
  
  // 登録チャンネルの新着動画を取得（直近3日分）
  async function getSubscriptionVideos() {
    const videos = [];
    
    try {
      // まず追加の動画を読み込むためにスクロール
      await loadMoreVideos();
      
      // 複数のセレクタパターンで動画要素を取得
      const selectors = [
        'ytd-browse[page-subtype="subscriptions"] ytd-video-renderer',
        'ytd-browse[page-subtype="subscriptions"] ytd-rich-item-renderer ytd-video-renderer',
        'ytd-two-column-browse-results-renderer[page-subtype="subscriptions"] ytd-video-renderer',
        'ytd-item-section-renderer ytd-video-renderer'
      ];
      
      let videoElements = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          videoElements = Array.from(elements);
          console.log(`Found ${elements.length} videos with selector: ${selector}`);
          break;
        }
      }
      
      console.log(`Total video elements found: ${videoElements.length}`);
      
      // バッチ処理で安全に処理
      const batchSize = 10;
      for (let i = 0; i < videoElements.length; i += batchSize) {
        const batch = videoElements.slice(i, i + batchSize);
        
        for (const videoEl of batch) {
          try {
            const videoData = extractVideoData(videoEl);
            if (videoData) {
              // 日付フィルタリング（エラーがあっても続行）
              try {
                if (isWithinDays(videoData.publishedDate, 3)) {
                  videos.push(videoData);
                }
              } catch (dateError) {
                console.warn('日付解析エラー、動画を追加:', videoData.title, dateError);
                videos.push(videoData); // 日付解析失敗でも追加
              }
            }
          } catch (extractError) {
            console.warn('動画データ抽出エラー:', extractError);
            continue; // 個別の動画エラーは無視して続行
          }
        }
        
        // バッチ間で少し待機（DOMへの負荷軽減）
        if (i + batchSize < videoElements.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      console.log(`Processed ${videos.length} videos`);
      
    } catch (error) {
      console.error('登録チャンネル動画の取得に失敗:', error);
    }
    
    return videos.slice(0, 50); // 最大50件に制限
  }
  
  // 追加の動画を読み込むためにスクロール
  async function loadMoreVideos() {
    const maxScrolls = 5; // 最大5回スクロール
    const scrollDelay = 800; // 各スクロール間の待機時間
    
    for (let i = 0; i < maxScrolls; i++) {
      const beforeCount = document.querySelectorAll('ytd-browse[page-subtype="subscriptions"] ytd-video-renderer').length;
      
      // ページの下部にスクロール
      window.scrollTo(0, document.body.scrollHeight);
      
      // 読み込み待機
      await new Promise(resolve => setTimeout(resolve, scrollDelay));
      
      const afterCount = document.querySelectorAll('ytd-browse[page-subtype="subscriptions"] ytd-video-renderer').length;
      
      console.log(`Scroll ${i + 1}: ${beforeCount} -> ${afterCount} videos`);
      
      // 新しい動画が読み込まれなかった場合は終了
      if (afterCount === beforeCount) {
        console.log('No more videos loaded, stopping scroll');
        break;
      }
    }
    
    // スクロール位置を元に戻す
    window.scrollTo(0, 0);
  }
  
  // 動画要素からデータを抽出
  function extractVideoData(videoElement) {
    try {
      // 複数のセレクタパターンでタイトルを取得
      const titleSelectors = [
        '#video-title',
        'a#video-title',
        '.ytd-video-renderer #video-title',
        'h3 a',
        '[aria-label*="動画"]'
      ];
      
      let titleEl = null;
      for (const selector of titleSelectors) {
        titleEl = videoElement.querySelector(selector);
        if (titleEl && titleEl.textContent?.trim()) break;
      }
      
      // チャンネル名の取得
      const channelSelectors = [
        '#channel-name a',
        '#text a',
        '.ytd-channel-name a',
        'ytd-channel-name a',
        '[href*="/channel/"]',
        '[href*="/@"]'
      ];
      
      let channelEl = null;
      for (const selector of channelSelectors) {
        channelEl = videoElement.querySelector(selector);
        if (channelEl && channelEl.textContent?.trim()) break;
      }
      
      // 公開日時取得（メタデータから直接取得）
      const metadataBlock = videoElement.querySelector('ytd-video-meta-block');
      let publishedText = '';

      if (metadataBlock) {
        // #metadata-line内の最後のspanを取得（公開日時が入っている）
        const metadataLine = metadataBlock.querySelector('#metadata-line');
        if (metadataLine) {
          const spans = metadataLine.querySelectorAll('span.inline-metadata-item');
          if (spans.length > 0) {
            // 最後のspanが公開日時
            publishedText = spans[spans.length - 1].textContent?.trim() || '';
          }
        }
      }
      
      // 最低限のデータが取得できない場合はnull
      if (!titleEl || !titleEl.textContent?.trim()) {
        console.warn('タイトルが取得できませんでした');
        return null;
      }
      
      const title = titleEl.textContent.trim();
      const channel = channelEl ? channelEl.textContent.trim() : '不明なチャンネル';
      const url = titleEl.href || '';
      
      // ライブ・プレミア公開の検出（より厳格に）
      let hasLiveBadge = false;
      let hasPremiereBadge = false;
      let hasUpcomingBadge = false;

      // バッジ要素を全て取得（ytd-badge-supported-rendererのみ）
      const allBadges = videoElement.querySelectorAll('ytd-badge-supported-renderer');

      // デバッグ: バッジの詳細情報を出力
      const badgeDebugInfo = [];

      for (const badge of allBadges) {
        // Shadow DOMからバッジラベルを取得
        let badgeLabel = '';

        // #label要素を探す（Shadow DOM内）
        const labelEl = badge.querySelector('#label');
        if (labelEl) {
          badgeLabel = labelEl.textContent?.trim() || '';
        }

        // aria-labelも確認
        const ariaLabel = badge.getAttribute('aria-label')?.toLowerCase() || '';
        const badgeText = badgeLabel.toLowerCase();

        // デバッグ情報を収集
        badgeDebugInfo.push({
          label: badgeLabel,
          ariaLabel: ariaLabel,
          tagName: badge.tagName
        });

        // 予定（Upcoming）のバッジを優先的にチェック
        if (ariaLabel.includes('予定') || ariaLabel.includes('scheduled') ||
            ariaLabel.includes('upcoming') ||
            badgeText.includes('予定') || badgeText.includes('scheduled') ||
            badgeText.includes('upcoming')) {
          hasUpcomingBadge = true;
          continue; // 予定の場合は次のバッジへ
        }

        // ライブ配信中（進行中）のバッジ
        if (badgeText === 'live' || badgeText === 'ライブ' || badgeText === 'live now' ||
            ariaLabel.includes('live now') || ariaLabel.includes('ライブ配信中') ||
            badgeText.includes('ライブ配信中')) {
          hasLiveBadge = true;
        }

        // プレミア公開のバッジ（予定でない場合）
        if (badgeText.includes('premiere') || badgeText.includes('プレミア') ||
            badgeText.includes('プレミア公開') || ariaLabel.includes('premiere') ||
            ariaLabel.includes('プレミア')) {
          hasPremiereBadge = true;
        }
      }

      // 公開日時テキストからの判定（より厳格に）
      const publishedLower = publishedText.toLowerCase();
      const hasScheduledText = publishedText.includes('予定') ||
                              publishedText.includes('プレミア公開') ||
                              publishedText.includes('ライブ配信予定') ||
                              publishedText.includes('公開予定') ||
                              publishedLower.includes('scheduled') ||
                              publishedLower.includes('premieres') ||
                              publishedLower.includes('waiting') ||
                              publishedLower.includes('starts') ||
                              /\d{1,2}月\d{1,2}日/.test(publishedText) || // 日付形式（例: 12月25日）
                              /\d{1,2}\/\d{1,2}/.test(publishedText) || // 日付形式（例: 12/25）
                              /\d{4}\/\d{1,2}\/\d{1,2}/.test(publishedText); // 日付形式（例: 2025/12/25）

      // 公開済み動画は必ず「○○前」という形式になる
      const isPublished = publishedText.includes('前') || publishedText.includes('ago');

      // 予定動画の判定：公開済みでない かつ (予定テキストがある または 予定バッジがある)
      const isUpcoming = !isPublished && (hasScheduledText || hasUpcomingBadge);

      // ライブ・プレミアは予定でない場合のみtrue
      const isLive = hasLiveBadge && !isUpcoming;
      const isPremiere = hasPremiereBadge && !isUpcoming;
      
      // サムネイルは動画IDから中間サムネイルURLを生成
      const videoId = extractVideoId(url);
      // mq2.jpg: 動画の中間サムネイル（ytfrozen-thumbnail-replacer.js参照）
      const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/mq2.jpg` : '';
      
      const videoData = {
        title,
        channel,
        thumbnail,
        publishedText,
        publishedDate: parsePublishedDate(publishedText),
        url,
        videoId,
        isLive,
        isPremiere,
        isUpcoming
      };

      // デバッグ: 予定動画またはライブ・プレミア検出時にログ出力
      if (isUpcoming || isLive || isPremiere || allBadges.length > 0) {
        console.log('[YTFrozen Movie] 動画分析:', {
          title: title.substring(0, 40) + '...',
          publishedText,
          'バッジ数': allBadges.length,
          'バッジ詳細': badgeDebugInfo,
          isPublished,
          hasScheduledText,
          hasUpcomingBadge,
          hasLiveBadge,
          hasPremiereBadge,
          '→ isUpcoming': isUpcoming,
          '→ isLive': isLive,
          '→ isPremiere': isPremiere
        });
      }

      return videoData;
    } catch (error) {
      console.error('動画データ抽出エラー:', error, videoElement);
      return null;
    }
  }
  
  // 公開日時のパース
  function parsePublishedDate(publishedText) {
    const now = new Date();
    
    if (!publishedText) return now;
    
    try {
      // 複数の日付パターンに対応
      const patterns = [
        /(\d+)\s*(分|時間|日|週間|か月|年)前/,
        /(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i,
        /(\d+)\s*([分時日週月年])\s*前/
      ];
      
      for (const pattern of patterns) {
        const match = publishedText.match(pattern);
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2];
          
          switch (unit) {
            case '分':
            case 'minute':
              return new Date(now - value * 60 * 1000);
            case '時間':
            case 'hour':
              return new Date(now - value * 60 * 60 * 1000);
            case '日':
            case 'day':
              return new Date(now - value * 24 * 60 * 60 * 1000);
            case '週間':
            case 'week':
              return new Date(now - value * 7 * 24 * 60 * 60 * 1000);
            case 'か月':
            case 'month':
              return new Date(now - value * 30 * 24 * 60 * 60 * 1000);
            case '年':
            case 'year':
              return new Date(now - value * 365 * 24 * 60 * 60 * 1000);
          }
        }
      }
    } catch (error) {
      console.warn('日付パースエラー:', publishedText, error);
    }
    
    return now; // デフォルト値
  }
  
  // 指定日数以内かチェック
  function isWithinDays(date, days) {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return date >= threshold;
  }
  
  // 動画IDを抽出
  function extractVideoId(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : '';
  }
  
  // 動画データキャッシュ（5分間有効）
  let videoCache = null;
  let cacheTime = 0;
  const CACHE_DURATION = 5 * 60 * 1000; // 5分
  
  // リストのデバッグ情報を取得
  async function getListDebugInfo(listName) {
    if (!window.YTFrozenListManager) return 'ListManagerなし';
    
    try {
      const lists = await window.YTFrozenListManager.getLists();
      const list = lists.find(l => l.name === listName);
      
      if (!list) return 'リストが存在しません';
      if (!list.channels || list.channels.length === 0) return 'チャンネル未登録';
      
      return `チャンネル${list.channels.length}件: ${list.channels.join(', ')}`;
    } catch (error) {
      return `エラー: ${error.message}`;
    }
  }
  
  // sub-channelsカラム用の動画リストを描画
  async function renderSubChannelVideos(container) {
    console.log('[YTFrozen Movie] renderSubChannelVideos called', container);

    // 既に描画済みかチェック
    if (container.children.length > 0 && !container.innerHTML.includes('取得中')) {
      console.log('[YTFrozen Movie] Already rendered, skipping');
      return;
    }

    // ローディング表示
    container.innerHTML = '<div style="padding: 12px; color: #ccc;">新着動画を取得中...</div>';

    try {
      // キャッシュチェック
      const now = Date.now();
      let videos;

      if (videoCache && (now - cacheTime) < CACHE_DURATION) {
        console.log('[YTFrozen Movie] Using cached videos:', videoCache.length);
        videos = videoCache;
      } else {
        console.log('[YTFrozen Movie] Fetching new videos...');
        videos = await getSubscriptionVideos();
        videoCache = videos;
        cacheTime = now;
        console.log('[YTFrozen Movie] Fetched videos:', videos.length);
      }

      container.innerHTML = ''; // クリア

      if (videos.length === 0) {
        console.log('[YTFrozen Movie] No videos found');
        container.innerHTML = '<div style="padding: 12px; color: #ccc;">新着動画がありません</div>';
        return;
      }

      console.log('[YTFrozen Movie] Rendering', videos.length, 'videos');

      // 予定動画と公開済み動画を分離
      const upcomingVideos = videos.filter(v => v.isUpcoming || v.isPremiere || v.isLive);
      const publishedVideos = videos.filter(v => !v.isUpcoming && !v.isPremiere && !v.isLive);

      // 予定動画セクション
      if (upcomingVideos.length > 0) {
        const upcomingSection = document.createElement('div');
        upcomingSection.className = 'ytfrozen-upcoming-section';
        upcomingSection.textContent = `予定 (${upcomingVideos.length})`;
        container.appendChild(upcomingSection);

        upcomingVideos.forEach(video => {
          const videoDiv = document.createElement('div');
          videoDiv.className = 'ytfrozen-upcoming-item';

          const titleDiv = document.createElement('div');
          titleDiv.className = 'ytfrozen-video-title';
          titleDiv.textContent = video.title;
          videoDiv.appendChild(titleDiv);

          const metaDiv = document.createElement('div');
          metaDiv.className = 'ytfrozen-video-meta';

          const channelDiv = document.createElement('div');
          channelDiv.className = 'ytfrozen-video-channel';
          channelDiv.textContent = video.channel;
          metaDiv.appendChild(channelDiv);

          const dateDiv = document.createElement('div');
          dateDiv.className = 'ytfrozen-video-date';
          dateDiv.textContent = video.publishedText;
          metaDiv.appendChild(dateDiv);

          videoDiv.appendChild(metaDiv);

          // クリック時にポップアップで動画を表示
          videoDiv.addEventListener('click', () => {
            if (video.videoId && window.YTFrozenPopup) {
              window.YTFrozenPopup.showVideoPopup(video.videoId, video.title);
            } else if (video.url) {
              window.open(video.url, '_blank');
            }
          });

          container.appendChild(videoDiv);
        });
      }

      // 公開済み動画セクション
      if (publishedVideos.length > 0) {
        const publishedSection = document.createElement('div');
        publishedSection.className = 'ytfrozen-published-section';
        publishedSection.textContent = `公開済み (${publishedVideos.length})`;
        container.appendChild(publishedSection);

        publishedVideos.forEach(video => {
          const videoDiv = document.createElement('div');
          videoDiv.className = 'ytfrozen-video-item';

          const img = document.createElement('img');
          img.src = video.thumbnail;
          videoDiv.appendChild(img);

          const infoDiv = document.createElement('div');
          infoDiv.style.flex = '1';
          infoDiv.style.minWidth = '0';

          const titleDiv = document.createElement('div');
          titleDiv.className = 'ytfrozen-video-title';
          titleDiv.textContent = video.title;
          infoDiv.appendChild(titleDiv);

          const channelDiv = document.createElement('div');
          channelDiv.className = 'ytfrozen-video-channel';
          channelDiv.textContent = video.channel;
          infoDiv.appendChild(channelDiv);

          const dateDiv = document.createElement('div');
          dateDiv.className = 'ytfrozen-video-date';
          dateDiv.textContent = video.publishedText;
          infoDiv.appendChild(dateDiv);

          videoDiv.appendChild(infoDiv);

          // クリック時にポップアップで動画を表示
          videoDiv.addEventListener('click', () => {
            if (video.videoId && window.YTFrozenPopup) {
              window.YTFrozenPopup.showVideoPopup(video.videoId, video.title);
            } else if (video.url) {
              window.open(video.url, '_blank');
            }
          });

          container.appendChild(videoDiv);
        });
      }

    } catch (error) {
      console.error('動画リスト描画エラー:', error);
      container.innerHTML = '<div style="padding: 12px; color: #f88;">動画の取得に失敗しました</div>';
    }
  }
  
  // リスト内チャンネルの新着動画を取得
  async function getListChannelVideos(listName) {
    if (!window.YTFrozenListManager) {
      console.warn(`[${listName}] YTFrozenListManagerが利用できません`);
      return [];
    }
    
    try {
      // リスト情報を取得
      const lists = await window.YTFrozenListManager.getLists();
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
      return allVideos.slice(0, 50); // 最大50件
      
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

      // 予定動画セクション
      if (upcomingVideos.length > 0) {
        const upcomingSection = document.createElement('div');
        upcomingSection.className = 'ytfrozen-upcoming-section';
        upcomingSection.textContent = `予定 (${upcomingVideos.length})`;
        container.appendChild(upcomingSection);

        upcomingVideos.forEach(video => {
          const videoDiv = document.createElement('div');
          videoDiv.className = 'ytfrozen-upcoming-item';

          const titleDiv = document.createElement('div');
          titleDiv.className = 'ytfrozen-video-title';
          titleDiv.textContent = video.title;
          videoDiv.appendChild(titleDiv);

          const metaDiv = document.createElement('div');
          metaDiv.className = 'ytfrozen-video-meta';

          const channelDiv = document.createElement('div');
          channelDiv.className = 'ytfrozen-video-channel';
          channelDiv.textContent = video.channel;
          metaDiv.appendChild(channelDiv);

          const dateDiv = document.createElement('div');
          dateDiv.className = 'ytfrozen-video-date';
          dateDiv.textContent = video.publishedText;
          metaDiv.appendChild(dateDiv);

          videoDiv.appendChild(metaDiv);

          // クリック時にポップアップで動画を表示
          videoDiv.addEventListener('click', () => {
            if (video.videoId && window.YTFrozenPopup) {
              window.YTFrozenPopup.showVideoPopup(video.videoId, video.title);
            } else if (video.url) {
              window.open(video.url, '_blank');
            }
          });

          container.appendChild(videoDiv);
        });
      }

      // 公開済み動画セクション
      if (publishedVideos.length > 0) {
        const publishedSection = document.createElement('div');
        publishedSection.className = 'ytfrozen-published-section';
        publishedSection.textContent = `公開済み (${publishedVideos.length})`;
        container.appendChild(publishedSection);

        publishedVideos.forEach(video => {
          const videoDiv = document.createElement('div');
          videoDiv.className = 'ytfrozen-video-item';

          const img = document.createElement('img');
          img.src = video.thumbnail;
          videoDiv.appendChild(img);

          const infoDiv = document.createElement('div');
          infoDiv.style.flex = '1';
          infoDiv.style.minWidth = '0';

          const titleDiv = document.createElement('div');
          titleDiv.className = 'ytfrozen-video-title';
          titleDiv.textContent = video.title;
          infoDiv.appendChild(titleDiv);

          const channelDiv = document.createElement('div');
          channelDiv.className = 'ytfrozen-video-channel';
          channelDiv.textContent = video.channel;
          infoDiv.appendChild(channelDiv);

          const dateDiv = document.createElement('div');
          dateDiv.className = 'ytfrozen-video-date';
          dateDiv.textContent = video.publishedText;
          infoDiv.appendChild(dateDiv);

          videoDiv.appendChild(infoDiv);

          // クリック時にポップアップで動画を表示
          videoDiv.addEventListener('click', () => {
            if (video.videoId && window.YTFrozenPopup) {
              window.YTFrozenPopup.showVideoPopup(video.videoId, video.title);
            } else if (video.url) {
              window.open(video.url, '_blank');
            }
          });

          container.appendChild(videoDiv);
        });
      }

    } catch (error) {
      console.error(`[${listName}] 動画リスト描画エラー:`, error);
      container.innerHTML = `<div style="padding: 12px; color: #f88;">[${listName}] の動画取得に失敗しました</div>`;
    }
  }

  // 指定リストの動画を取得してカラムに描画する関数
  async function renderListMovies(listName, container) {
    if (listName === 'sub-channels') {
      await renderSubChannelVideos(container);

    } else {
      // リスト用の動画描画
      await renderListChannelVideos(listName, container);
    }
  }

  // グローバル公開
  window.YTFrozenListMovie = {
    renderListMovies,
    getSubscriptionVideos,
  };
})();
