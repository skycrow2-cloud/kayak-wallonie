// Données : réseau d'abord (dernière version en cache si hors ligne). Reste : cache d'abord.
const C = 'kayak-v3';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'icon.svg']))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('tile.openstreetmap.org')) return;
  if (u.pathname.endsWith('data.json') || e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(C).then(c => c.put(u.pathname.endsWith('data.json') ? 'data.json' : e.request, k)); return r; })
      .catch(() => caches.match(u.pathname.endsWith('data.json') ? 'data.json' : e.request).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const k = res.clone(); caches.open(C).then(c => c.put(e.request, k)); } return res; })));
});
