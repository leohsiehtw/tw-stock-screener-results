var VER = '20261111-a7109e32';
var SHELL = 'twss-shell-' + VER;
var DATA = 'twss-data';
var PRE = ['./', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
var DAYS = ["history/20261111.json", "history/20261110.json", "history/20261109.json", "history/20261106.json", "history/20261105.json"];
function warm(name, list) {
  return caches.open(name).then(function (c) {
    return Promise.all(list.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () { }); }));
  });
}
self.addEventListener('install', function (e) {
  e.waitUntil(Promise.all([warm(SHELL, PRE), warm(DATA, ['history/index.json'].concat(DAYS))]).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('twss-') === 0 && k !== SHELL && k !== DATA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return caches.open(DATA); }).then(function (c) {
    return c.keys().then(function (rs) {
      var old = rs.filter(function (r) { return r.url.indexOf('index.json') < 0; });
      return Promise.all(old.slice(0, Math.max(0, old.length - 130)).map(function (r) { return c.delete(r); }));
    });
  }).then(function () { return self.clients.claim(); }));
});
function bye() {
  caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('twss-') === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.registration.unregister(); });
}
function store(name, r, res) {
  if (res.ok) { var cp = res.clone(); caches.open(name).then(function (c) { return c.put(r, cp); }); }
  return res;
}
function nav(r, shell) {
  var timer = 0;
  var net = fetch(r).then(function (res) {
    clearTimeout(timer);
    if (!shell) { return res; }
    if (res.status === 404 || res.status === 410) { bye(); return res; }
    return store(SHELL, './', res);
  });
  var slow = new Promise(function (ok, no) {
    timer = setTimeout(function () { caches.match('./').then(function (m) { if (m) { ok(m); } else { no(); } }); }, 3e3);
  });
  return Promise.race([net, slow]).catch(function () {
    return caches.match('./').then(function (m) { return m || net; });
  });
}
function netFirst(r) {
  return fetch(r).then(function (res) { return store(DATA, r, res); }).catch(function () {
    return caches.match(r).then(function (m) { return m || Response.error(); });
  });
}
function stale(r) {
  return caches.open(DATA).then(function (c) {
    return c.match(r).then(function (m) {
      var net = fetch(r).then(function (res) { return store(DATA, r, res); });
      net.catch(function () { });
      return m || net;
    });
  });
}
function first(r) {
  return caches.match(r).then(function (m) { return m || fetch(r).then(function (res) { return store(SHELL, r, res); }); });
}
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') { return; }
  var sc = self.registration.scope;
  if (r.url.indexOf(sc) !== 0) { return; }
  var p = r.url.slice(sc.length).split('?')[0].split('#')[0];
  if (r.destination === 'document' || p === '' || p === 'index.html') { e.respondWith(nav(r, p === '' || p === 'index.html')); }
  else if (p === 'history/index.json') { e.respondWith(netFirst(r)); }
  else if (/^history\/[0-9]{8}\.json$/.test(p)) { e.respondWith(stale(r)); }
  else if (p === 'manifest.webmanifest' || p.indexOf('icons/') === 0) { e.respondWith(first(r)); }
});
