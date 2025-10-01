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
        videoId
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
  
  // sub-channelsカラム用の動画リストを描画
  async function renderSubChannelVideos(container) {
    // 既に描画済みかチェック
    if (container.children.length > 0 && !container.innerHTML.includes('取得中')) {
      return;
    }
    
    // ローディング表示
    container.innerHTML = '<div style="padding: 12px; color: #ccc;">新着動画を取得中...</div>';
    
    try {
      // キャッシュチェック
      const now = Date.now();
      let videos;
      
      if (videoCache && (now - cacheTime) < CACHE_DURATION) {
        videos = videoCache;
      } else {
        videos = await getSubscriptionVideos();
        videoCache = videos;
        cacheTime = now;
      }
      
      container.innerHTML = ''; // クリア
      
      if (videos.length === 0) {
        container.innerHTML = '<div style="padding: 12px; color: #ccc;">新着動画がありません</div>';
        return;
      }
      
      videos.forEach(video => {
        const videoDiv = document.createElement('div');
        videoDiv.className = 'ytfrozen-video-item';

        const img = document.createElement('img');
        img.src = video.thumbnail;
        // サムネイル用クラスはCSSで統一
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
          if (video.videoId && window.YTFrozenSubsPopup) {
            window.YTFrozenSubsPopup.showVideoPopup(video.videoId, video.title);
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
  
  // 指定リストの動画を取得してカラムに描画する関数
  async function renderListMovies(listName, container) {
    if (listName === 'sub-channels') {
      await renderSubChannelVideos(container);
    } else {
      // 他のリスト用の実装（今後追加予定）
      const placeholder = document.createElement('div');
      placeholder.textContent = `[${listName}] の動画リスト（実装予定）`;
      placeholder.style.padding = '8px 0';
      placeholder.style.color = '#ccc';
      container.appendChild(placeholder);
    }
  }

  // グローバル公開
  window.YTFrozenListMovie = {
    renderListMovies,
    getSubscriptionVideos,
  };
})();
