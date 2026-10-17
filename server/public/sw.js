// Service worker de Parlotte : garde l'interface en cache pour qu'elle s'ouvre vite
// (les messages, eux, arrivent toujours en direct par le serveur).
const CACHE = 'parlotte-v15';
const SHELL = ['/', '/index.html', '/app.js', '/styles.css', '/search.js', '/voix.js', '/presence.js', '/espaces.js', '/stories.js', '/reglages.js', '/profils.js', '/evenements.js', '/appels.js', '/nav16.js', '/parametres.js', '/media16.js', '/vendor/qrcode.js', '/push16.js', '/look17.js', '/extra17.js', '/cam18.js', '/srv18.js', '/fin18.js', '/fun18.js', '/v19.js', '/mobile.js', '/fonts/figtree-latin-wght-normal.woff2', '/fonts/bricolage-grotesque-latin-wght-normal.woff2', '/manifest.webmanifest', '/icon-192.png'];
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

// ---------------------------------------------------------------- Notifications push (appli fermée)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Parlotte', body: e.data && e.data.text() }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    // Parlotte déjà ouverte et visible : pas besoin de notification
    if (!d.call && list.some(c => c.visibilityState === 'visible' && c.focused)) return;
    return self.registration.showNotification(d.title || 'Parlotte', {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: d.icon || '/icon-192.png', badge: '/icon-192.png',
      data: { url: d.url || '/' }, requireInteraction: !!d.call, vibrate: d.call ? [300, 150, 300, 150, 300] : [80, 40, 80],
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { c.postMessage({ open: url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
