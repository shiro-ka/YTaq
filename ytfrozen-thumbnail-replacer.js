// すべてのYouTubeサムネイル画像を動画の中間フレーム（mq2.jpg）に差し替える
function replaceAllThumbnailsToMiddleFrame() {
  const imgs = document.querySelectorAll('img[src*="i.ytimg.com/vi/"]');
  imgs.forEach(img => {
    const m = img.src.match(/\/vi\/([\w-]{11})\//);
    if (m) {
      const videoId = m[1];
      const newUrl = `https://i.ytimg.com/vi/${videoId}/mq2.jpg`;
      if (img.src !== newUrl) {
        img.src = newUrl;
      }
    }
  });
}

// 動的追加にも対応
const thumbObserver = new MutationObserver(replaceAllThumbnailsToMiddleFrame);
thumbObserver.observe(document.body, { childList: true, subtree: true });
replaceAllThumbnailsToMiddleFrame();
