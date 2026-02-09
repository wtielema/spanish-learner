const CACHE_NAME = 'spanish-learner-v7';
const ASSETS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/router.js',
  'js/db.js',
  'js/srs.js',
  'js/cards.js',
  'js/session.js',
  'js/verb-session.js',
  'js/screens/dashboard.js',
  'js/screens/practice.js',
  'js/screens/browse.js',
  'js/screens/settings.js',
  'js/screens/conjugation-ref.js',
  'js/screens/progress.js',
  'data/nouns.json',
  'data/verbs.json',
  'data/verb-patterns.json',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
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

// Network-first: try network, fall back to cache (for offline use)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
