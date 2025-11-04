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
      
      // 公開日時取得
      const timeSelectors = [
        '#metadata-line span:last-child',
        'ytd-video-meta-block #metadata-line span:last-child',
        '.ytd-video-meta-block span:last-child',
        '[aria-label*="前"]'
      ];
      
      let timeEl = null;
      for (const selector of timeSelectors) {
        timeEl = videoElement.querySelector(selector);
        if (timeEl && timeEl.textContent?.trim()) break;
      }
      
      // 最低限のデータが取得できない場合はnull
      if (!titleEl || !titleEl.textContent?.trim()) {
        console.warn('タイトルが取得できませんでした');
        return null;
      }
      
      const title = titleEl.textContent.trim();
      const channel = channelEl ? channelEl.textContent.trim() : '不明なチャンネル';
      const publishedText = timeEl ? timeEl.textContent.trim() : '';
      const url = titleEl.href || '';
      
      // ライブ・プレミア公開の検出（リスト用のみで使用）
      const isLive = videoElement.querySelector('.badge-style-type-live, [aria-label*="ライブ"], [aria-label*="LIVE"]');
      const isPremiere = videoElement.querySelector('.badge-style-type-premiere, [aria-label*="プレミア"], [aria-label*="PREMIERE"]');
      const isUpcoming = publishedText.includes('予定') || publishedText.includes('プレミア公開') || publishedText.includes('ライブ配信予定');
      
      // サムネイルは動画IDから中間サムネイルURLを生成
      const videoId = extractVideoId(url);
      // mq2.jpg: 動画の中間サムネイル（ytfrozen-thumbnail-replacer.js参照）
      const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/mq2.jpg` : '';
      
      return {
        title,
        channel,
        thumbnail,
        publishedText,
        publishedDate: parsePublishedDate(publishedText),
        url,
        videoId,
        isLive: !!isLive,
        isPremiere: !!isPremiere,
        isUpcoming
      };
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
      
      videos.forEach(video => {
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
          
          // リスト用ではライブ・プレミア・予定動画を除外
          const filteredVideos = channelVideos.filter(video => {
            const shouldExclude = video.isLive || video.isPremiere || video.isUpcoming;
            if (shouldExclude) {
              console.log(`[${channelId}] [除外] ライブ/プレミア/予定動画: ${video.title}`);
            }
            return !shouldExclude;
          });
          
          if (filteredVideos.length > 0) {
            console.log(`[${channelId}] ${filteredVideos.length}件の動画を取得 (除外後)`);
            allVideos.push(...filteredVideos);
          } else {
            console.warn(`[${channelId}] 動画が見つかりませんでした (除外後)`);
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
  
  // 指定チャンネルの最近の動画を取得
  async function getChannelRecentVideos(channelId, channelName = null) {
    try {
      // チャンネルページのURLを生成
      let channelUrl;
      if (channelId.startsWith('@')) {
        channelUrl = `https://www.youtube.com/${channelId}/videos`;
      } else {
        channelUrl = `https://www.youtube.com/channel/${channelId}/videos`;
      }
      
      // 新しいタブでチャンネルページを一時的に開いて動画情報を取得
      // （実際のYouTube APIが使えない制約のため、DOM解析で取得）
      
      // より実用的なアプローチ: YouTube検索を利用
      return await getVideosFromChannelSearch(channelId, channelName);
      
    } catch (error) {
      console.warn(`チャンネル[${channelId}]の動画取得に失敗:`, error);
      return [];
    }
  }
  
  // YouTube検索を使ってチャンネル動画を取得
  async function getVideosFromChannelSearch(channelId, channelName = null) {
    try {
      console.log(`[${channelId}] 動画検索開始`);
      
      // まず登録チャンネル動画から検索
      const now = Date.now();
      let allSubscriptionVideos;
      
      if (videoCache && (now - cacheTime) < CACHE_DURATION) {
        allSubscriptionVideos = videoCache;
      } else {
        allSubscriptionVideos = await getSubscriptionVideos();
      }
      
      console.log(`[${channelId}] 登録チャンネル動画総数: ${allSubscriptionVideos.length}`);
      
      // デバッグ: 最初の5件の動画データを確認
      console.log(`[${channelId}] 動画データサンプル:`, allSubscriptionVideos.slice(0, 5).map(v => ({
        title: v.title,
        channel: v.channel,
        url: v.url
      })));
      
      // チャンネルIDに基づいてフィルタリング
      let channelVideos = [];
      
      if (channelId.startsWith('@')) {
        const channelName = channelId.substring(1);
        console.log(`[${channelId}] @形式チャンネル名で検索: ${channelName}`);
        
        channelVideos = allSubscriptionVideos.filter(video => {
          if (!video.channel) return false;
          
          const videoChannelLower = video.channel.toLowerCase();
          const channelNameLower = channelName.toLowerCase();
          
          const match = (
            videoChannelLower.includes(channelNameLower) ||
            video.url.includes(channelId) ||
            video.url.includes(`/@${channelName}`) ||
            // 正規化した名前での比較も追加
            video.channel.replace(/[^\w]/g, '').toLowerCase().includes(channelName.replace(/[^\w]/g, '').toLowerCase())
          );
          
          if (match) {
            console.log(`[${channelId}] 一致した動画:`, { title: video.title, channel: video.channel, url: video.url });
          }
          
          // デバッグ: STUDIO CHOOMを含むチャンネルを特別に確認
          if (videoChannelLower.includes('studio') && videoChannelLower.includes('choom')) {
            console.log(`[${channelId}] STUDIO CHOOM候補:`, { 
              channel: video.channel, 
              searchName: channelName,
              match: match
            });
          }
          
          return match;
        });
      } else {
        console.log(`[${channelId}] UC形式チャンネルIDで検索`);
        
        channelVideos = allSubscriptionVideos.filter(video => {
          const match = video.url.includes(`/channel/${channelId}`);
          if (match) {
            console.log(`[${channelId}] 一致した動画:`, { title: video.title, channel: video.channel, url: video.url });
          }
          return match;
        });
      }
      
      console.log(`[${channelId}] フィルタリング結果: ${channelVideos.length}件`);
      
        // 登録チャンネルに見つからない場合は、より柔軟な検索を試す
        if (channelVideos.length === 0) {
          console.log(`[${channelId}] 登録チャンネルに見つからないため、柔軟検索を実行`);
          
          // チャンネル名での部分一致検索（より柔軟に）
          if (channelId.startsWith('@')) {
            const searchName = channelId.substring(1).toLowerCase();
            
            // 保存されたチャンネル名も検索に使用
            const searchNames = [searchName];
            if (channelName) {
              searchNames.push(channelName.toLowerCase());
            }
            
            channelVideos = allSubscriptionVideos.filter(video => {
              if (!video.channel) return false;
              
              const videoChannelLower = video.channel.toLowerCase();
              const videoChannelNormalized = videoChannelLower.replace(/[^\w]/g, ''); // 英数字のみ
              
              for (const name of searchNames) {
                // 複数のパターンで検索
                const patterns = [
                  name,                                 // そのまま
                  name.replace(/\s+/g, ''),            // スペースを除去
                  name.replace(/[^\w]/g, ''),          // 英数字のみ
                ];
                
                for (const pattern of patterns) {
                  const patternNormalized = pattern.replace(/[^\w]/g, '');
                  
                  // 両方向で部分一致をチェック
                  if (videoChannelLower.includes(pattern) || 
                      pattern.includes(videoChannelLower) ||
                      videoChannelNormalized.includes(patternNormalized) ||
                      patternNormalized.includes(videoChannelNormalized)) {
                    console.log(`[${channelId}] パターン "${pattern}" で一致: ${video.channel}`);
                    return true;
                  }
                  
                  // 特別ケース: STUDIOCHOOMとSTUDIO CHOOMのような場合
                  if (patternNormalized.length > 3 && videoChannelNormalized.includes(patternNormalized)) {
                    console.log(`[${channelId}] 正規化パターン "${patternNormalized}" で一致: ${video.channel}`);
                    return true;
                  }
                }
              }
              
              return false;
            });
          }
          
          console.log(`[${channelId}] 柔軟検索結果: ${channelVideos.length}件`);
          
          // それでも見つからない場合、全チャンネル名をログ出力
          if (channelVideos.length === 0) {
            const uniqueChannels = [...new Set(allSubscriptionVideos.map(v => v.channel))];
            console.log(`[${channelId}] 利用可能なチャンネル名一覧:`, uniqueChannels);
          }
        }      return channelVideos.slice(0, 10); // チャンネルあたり最大10件
      
    } catch (error) {
      console.warn(`チャンネル検索取得エラー[${channelId}]:`, error);
      return [];
    }
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
      
      videos.forEach(video => {
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
