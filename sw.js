/*
 * AlJoud Cafe service worker
 * Refreshes the local app shell when a new deployment is available.
 * Keeps the latest successful same-origin GET responses for offline use.
 */
const CACHE_NAME = 'aljoud-cafe-shell-v4';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './notifications-config.js',
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

// Handles remote push payloads once a secure push sender is connected.
self.addEventListener('push', (event) => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; }
    catch (error) { payload = { body: event.data ? event.data.text() : '' }; }
    const title = payload.title || 'الجود كافيه ☕';
    const options = {
        body: payload.body || 'عندنا شيء حلو نحب نشاركه معك ❤️',
        icon: payload.icon || './logo.png',
        badge: payload.badge || './logo.png',
        tag: payload.tag || 'aljoud-general',
        data: { url: payload.url || './index.html' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || './index.html', self.location.origin);
    if (target.origin !== self.location.origin) return;
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) { existing.navigate(target.href); return existing.focus(); }
        return self.clients.openWindow(target.href);
    }));
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
