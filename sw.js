
const CACHE_NAME = 'poly-insight-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Handle push events from the server if applicable in future
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.text() : 'New Strategy Alert!';
  event.waitUntil(
    self.registration.showNotification('NBA Poly-Insight', {
      body: data,
      icon: 'https://cdn-icons-png.flaticon.com/512/732/732233.png'
    })
  );
});
