/*
 * AlJoud Cafe service worker
 * Caches the local app shell and provides an offline fallback for the home page.
 * External CDN assets are left to the browser's normal network/cache behavior.
 */
const CACHE_NAME = 'aljoud-cafe-shell-v2';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './logo.png'
];

// Install: save the essential local files before activating this worker.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Activate: remove older app-shell caches, then take control of open pages.
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

// Fetch: use the network when available and keep successful same-origin GETs cached.
// If the user is offline, serve the cached request or the cached home page.
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
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
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
