// Service worker de Parlotte : garde l'interface en cache pour qu'elle s'ouvre vite
// (les messages, eux, arrivent toujours en direct par le serveur).
const CACHE = 'parlotte-v3';
const SHELL = ['/', '/index.html', '/app.js', '/styles.css', '/search.js', '/voix.js', '/presence.js', '/espaces.js', '/fonts/figtree-latin-wght-normal.woff2', '/fonts/bricolage-grotesque-latin-wght-normal.woff2', '/manifest.webmanifest', '/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/uploads/') || url.pathname === '/ws') return;
  // Réseau d'abord (toujours la dernière version), cache si le serveur ne répond pas.
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
