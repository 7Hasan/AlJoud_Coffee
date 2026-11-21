/* Isolated Web Push test worker for AlJoud.
 * Its scope is limited to /AlJoud_Coffee/webpush-lab/ and does not replace sw.js.
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
  } catch (_) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'اختبار إشعارات الجود ☕';
  const options = {
    body: payload.body || 'وصل أول إشعار عبر مسار Web Push.',
    icon: '../logo.png',
    badge: '../logo.png',
    tag: 'aljoud-webpush-lab',
    data: { url: './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./', self.location.href);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.navigate(target.href);
      return existing.focus();
    }
    return self.clients.openWindow(target.href);
  }));
});
