/*
 * AlJoud Cafe service worker
 * Refreshes the local app shell when a new deployment is available.
 * Keeps the latest successful same-origin GET responses for offline use.
 */
const CACHE_NAME = 'aljoud-cafe-shell-v5';
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
// Firebase Messaging background support. Notification payloads are displayed by the SDK.
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAMdmUshORZe4SO6kXHhH2ZPa0bs4_ueXNU",
    authDomain: "aljoud-coffee.firebaseapp.com",
    projectId: "aljoud-coffee",
    storageBucket: "aljoud-coffee.firebasestorage.app",
    messagingSenderId: "501147188970",
    appId: "1:501147188970:web:51712e4471851b8c2da193",
    measurementId: "G-DVT5KK5TFL"
});

const aljoudMessaging = firebase.messaging();
aljoudMessaging.onBackgroundMessage((payload) => {
    // FCM automatically displays notification payloads in the background.
    // Show a notification here only for data-only messages.
    if (payload.notification) return;
    const data = payload.data || {};
    return self.registration.showNotification(data.title || 'الجود كافيه ☕', {
        body: data.body || 'عندنا شيء حلو نحب نشاركه معك ❤️',
        icon: data.icon || './logo.png',
        badge: data.badge || './logo.png',
        tag: data.tag || 'aljoud-general',
        data: { url: data.url || './index.html' }
    });
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
