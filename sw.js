/* 五十音冲刺 · Service Worker
 * 作用：首次联网打开后把游戏缓存到手机，之后断网 / 电脑关机都能玩。
 * 以后修改了游戏内容：把下面 CACHE 里的 v1 改成 v2（或更大），用户再打开两次才会拿到新版。
 */

const CACHE = 'gojuon-v1';

const ASSETS = [
  './%E4%BA%94%E5%8D%81%E9%9F%B3%E5%86%B2%E5%88%BA.html', /* 五十音冲刺.html */
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        /* 单个文件失败不影响整体安装 */
        return cache.add(url).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf('gojuon-') === 0 && key !== CACHE) {
          return caches.delete(key);
        }
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  /* 只接管本站资源，外部请求原样放行 */
  if (url.origin !== self.location.origin) return;

  /* 页面导航：优先网络（保证能拿到新版），失败则回退缓存 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        if (!res.redirected) {
          caches.open(CACHE).then(function (cache) {
            return cache.put(req, copy);
          }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          return caches.match('./%E4%BA%94%E5%8D%81%E9%9F%B3%E5%86%B2%E5%88%BA.html');
        });
      })
    );
    return;
  }

  /* 静态资源：缓存优先，未命中再请求网络并顺手缓存 */
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            return cache.put(req, copy);
          }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return new Response('离线且未缓存', {
          status: 504,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
