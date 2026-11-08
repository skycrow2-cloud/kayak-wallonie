// Fichiers du site : réseau d'abord, copie en cache pour le hors-ligne. Tuiles et bibliothèques externes : non gérées.
const C = 'kayak-v5';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'icon.svg']))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const key = u.pathname.endsWith('data.json') ? 'data.json' : e.request;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const k = r.clone(); caches.open(C).then(c => c.put(key, k)); } return r; })
    .catch(() => caches.match(key).then(r => r || caches.match('index.html'))));
});
