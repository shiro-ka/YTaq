// ytfrozen-iframe-api.js
// YouTube IFrame Player APIのローカルコピー（公式CDNからの直読み不可対策）
// 公式の https://www.youtube.com/iframe_api の内容をここに配置する必要があります。
// 必要に応じて、公式からダウンロードし、このファイルに貼り付けてください。

// window.YT, window.YTConfig を必ず初期化
if (!window.YT) window.YT = { loading: 0, loaded: 0 };
if (!window.YTConfig) window.YTConfig = { host: "https://www.youtube.com" };

(function(){
  var scriptUrl = 'https://www.youtube.com/s/player/a61444a1/www-widgetapi.vflset/www-widgetapi.js';
  if(!window.YT.loading){
    window.YT.loading=1;
    (function(){
      var l=[];
      window.YT.ready=function(f){if(window.YT.loaded)f();else l.push(f)};
      window.onYTReady=function(){window.YT.loaded=1;var i=0;for(;i<l.length;i++)try{l[i]()}catch(e){}};
      window.YT.setConfig=function(c){var k;for(k in c)if(c.hasOwnProperty(k))window.YTConfig[k]=c[k]};
      var a=document.createElement("script");
      a.type="text/javascript";
      a.id="www-widgetapi-script";
      a.src=scriptUrl;
      a.async=true;
      var b=document.getElementsByTagName("script")[0];
      b.parentNode.insertBefore(a,b)
    })()
  }
})();
