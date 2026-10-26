'use strict';
var VERSION = 'fihrist-shell-732a5f4be4';
var FONTS = 'fihrist-fonts';
var SHELL = ['index.html', 'css/app.css', 'js/data.js', 'js/core.js', 'js/strings.js', 'js/app.js', 'js/ui.js', 'favicon.svg'];
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (cache) {
    return cache.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('fihrist-shell-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fonts(req) {
  return caches.open(FONTS).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      });
      if (hit) { net.catch(function () {}); return hit; }
      return net.catch(function () { return Response.error(); });
    });
  });
}

function shell(req) {
  var key = req.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : req;
  return caches.open(VERSION).then(function (cache) {
    return cache.match(key, { ignoreSearch: true }).then(function (hit) { return hit || fetch(req); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (FONT_HOSTS.indexOf(url.hostname) !== -1) { e.respondWith(fonts(req)); return; }
  if (url.origin !== self.location.origin) return;
  if (/\.json$/.test(url.pathname)) return;
  e.respondWith(shell(req));
});
