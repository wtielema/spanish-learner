const CACHE_NAME = 'spanish-learner-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/router.js',
  '/js/db.js',
  '/js/srs.js',
  '/js/cards.js',
  '/js/session.js',
  '/js/screens/dashboard.js',
  '/js/screens/practice.js',
  '/js/screens/browse.js',
  '/js/screens/settings.js',
  '/data/nouns.json',
  '/data/verbs.json',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
