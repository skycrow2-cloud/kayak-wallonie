// Fichiers du site : réseau d'abord, copie en cache pour le hors-ligne. Tuiles et bibliothèques externes : non gérées.
const C = 'kayak-v35';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'kayak.svg']))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const key = u.pathname.endsWith('data.json') ? 'data.json' : e.request;
  // cache: 'no-cache' : toujours revalider auprès de GitHub (sinon l'APK et Safari gardent l'ancienne page ~10 min)
  e.respondWith(fetch(e.request.mode === 'navigate' ? new Request(u.href, { cache:'no-cache', credentials:'same-origin' }) : new Request(e.request, { cache:'no-cache' })).then(r => { if (r.ok) { const k = r.clone(); caches.open(C).then(c => c.put(key, k)); } return r; })
    .catch(() => caches.match(key).then(r => r || caches.match('index.html'))));
});
