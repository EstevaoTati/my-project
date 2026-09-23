/* =====================================================================
   PRECIOUS — offline shell.

   Scope is pinned to /precious at registration time, so this worker never
   touches the marketing site. It caches the assistant's shell so the app
   opens instantly and still boots with no connection — the microphone,
   the recogniser and the synthesiser are all local. Only the reasoning
   turn needs the network, and that request is never cached.
   ===================================================================== */
var CACHE = 'precious-shell-v3';
var SHELL = [
  '/precious',
  '/precious.css?v=3',
  '/precious.js?v=3',
  '/precious-reactor.js?v=3',
  '/tech.css?v=1',
  '/precious.webmanifest',
  '/assets/precious-icon.svg',
  '/assets/precious-icon-192.png',
  '/assets/precious-icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // addAll fails the whole install if one entry 404s; add individually
      // so a single missing file cannot leave the app without a shell.
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  // The reasoning endpoint and anything key-gated must always hit the
  // network: a cached answer would be a stale answer, spoken as fact.
  if (url.pathname.indexOf('/.netlify/') === 0) return;

  // Navigations: network first, cached shell as the fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put('/precious', copy); });
        return response;
      }).catch(function () {
        return caches.match('/precious').then(function (hit) {
          return hit || caches.match('/precious.html');
        });
      })
    );
    return;
  }

  // Static assets: cache first, refreshed in the background.
  event.respondWith(
    caches.match(request).then(function (hit) {
      var network = fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
