const CACHE_NAME = 'pkb-offline-suite-v8';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './default-logo.js',
    './default-logo.jpg',
    './manifest.json',
    './icon.svg',
    './vendor/html2pdf.bundle.min.js',
    './vendor/signature_pad.umd.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return fetch(event.request).then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return response;
            }).catch(() => cached || caches.match('./index.html'));
        })
    );
});
