/*
 * AlJoud Cafe service worker
 * Refreshes the local app shell when a new deployment is available.
 * Keeps the latest successful same-origin GET responses for offline use.
 */
const CACHE_NAME = 'aljoud-cafe-shell-v3';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('aljoud-cafe-shell-') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const requestUrl = new URL(request.url);

    if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.ok) {
                    const responseCopy = response.clone();
                    event.waitUntil(
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.put(request, responseCopy))
                    );
                }
                return response;
            })
            .catch(async () => {
                const cachedResponse = await caches.match(request);
                if (cachedResponse) return cachedResponse;

                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }

                return Response.error();
            })
    );
});
