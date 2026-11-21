/* AlJoud Web Push service worker.
 * Runs under /webpush/ so it does not replace the existing Firebase service worker.
 */
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'الجود كافيه ☕';
    const options = {
        body: payload.body || 'عندنا شيء حلو نحب نشاركه معك ❤️',
        icon: '../logo.png',
        badge: '../logo.png',
        tag: payload.tag || 'aljoud-webpush',
        data: { url: payload.url || '../index.html' }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || '../index.html', self.registration.scope);
    if (target.origin !== self.location.origin) return;

    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) {
            existing.navigate(target.href);
            return existing.focus();
        }
        return self.clients.openWindow(target.href);
    }));
});
