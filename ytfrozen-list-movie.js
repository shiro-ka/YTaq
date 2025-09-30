// YTFrozen: リスト内の動画を管理・描画するためのモジュール
// 今後、各リストカラム内に動画サムネイルや情報を描画するためのAPIをここに実装予定

(function() {
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  function ensureItemsContainer(columnEl) {
    let items = columnEl.querySelector('.ytfrozen-list-items');
    if (!items) {
      items = document.createElement('div');
      items.className = 'ytfrozen-list-items';
      columnEl.appendChild(items);
    }
    return items;
  }

  function parseRelativeTime(text) {
    if (!text) return null;
    const now = Date.now();
    const t = text.trim();
    // English
    let m = t.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      const map = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000, month: 2592000000, year: 31536000000 };
      return new Date(now - n * map[unit]);
    }
    // Japanese
    m = t.match(/(\d+)\s*(秒|分|時間|日|週|か月|ヶ月|年)前/);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2];
      const map = { '秒': 1000, '分': 60000, '時間': 3600000, '日': 86400000, '週': 604800000, 'か月': 2592000000, 'ヶ月': 2592000000, '年': 31536000000 };
      return new Date(now - n * (map[unit] || 0));
    }
    return null;
  }

  function extractPublishedDate(videoEl) {
    // Try several metadata patterns
    const timeSpan = videoEl.querySelector('#metadata-line span:nth-of-type(2)')
      || Array.from(videoEl.querySelectorAll('#metadata-line span')).find(s => /ago|前/.test(s.textContent || ''))
      || Array.from(videoEl.querySelectorAll('span.inline-metadata-item')).find(s => /ago|前/.test(s.textContent || ''))
      || videoEl.querySelector('a#video-title[aria-label]');
    const t = timeSpan?.textContent || timeSpan?.getAttribute('aria-label') || '';
    return parseRelativeTime(t);
  }

  function extractVideoInfo(videoEl) {
    const a = videoEl.querySelector('a#video-title') || videoEl.querySelector('a#thumbnail');
    const title = (videoEl.querySelector('#video-title')?.textContent || a?.title || a?.ariaLabel || '').trim();
    const href = a?.href || '';
    const date = extractPublishedDate(videoEl);
    return { title, href, date };
  }

  function renderList(itemsContainer, videos) {
    itemsContainer.textContent = '';
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    ul.style.margin = '8px 0 0 0';
    itemsContainer.appendChild(ul);
    videos.forEach(v => {
      const li = document.createElement('li');
      li.style.margin = '6px 0';
      const a = document.createElement('a');
      a.href = v.href;
      a.textContent = v.title || '(タイトルなし)';
      a.style.color = 'var(--yt-spec-text-primary, #fff)';
      a.style.textDecoration = 'none';
      a.target = '_blank';
      ul.appendChild(li);
      li.appendChild(a);
    });
  }

  async function renderSubChannels(rendererEl, columnEl) {
    if (!rendererEl || !columnEl) return;
    const itemsContainer = ensureItemsContainer(columnEl);
    // Collect videos from current DOM
    const videoNodes = rendererEl.querySelectorAll('ytd-item-section-renderer ytd-video-renderer');
    const now = Date.now();
    const recents = [];
    videoNodes.forEach(v => {
      const info = extractVideoInfo(v);
      if (!info.href || !info.date) return;
      if (now - info.date.getTime() <= THREE_DAYS_MS) recents.push(info);
    });
    // Sort newest first by date
    recents.sort((a, b) => b.date - a.date);
    // Limit a bit
    renderList(itemsContainer, recents.slice(0, 30));
  }

  // 例: 指定リストの動画を取得してカラムに描画する（拡張予定）
  async function renderListMovies(listName, container) {
    const itemsContainer = ensureItemsContainer(container);
    itemsContainer.textContent = '';
    const ph = document.createElement('div');
    ph.textContent = `[${listName}] の動画リスト（今後実装）`;
    ph.style.color = '#ccc';
    itemsContainer.appendChild(ph);
  }

  window.YTFrozenListMovie = {
    renderSubChannels,
    renderListMovies,
  };
})();
