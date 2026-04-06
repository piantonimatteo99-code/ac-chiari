/**
 * AC Chiari — Native Web Push Service Worker
 * Handles W3C PushManager push events (iOS 16.4+ PWA, Android Chrome, Desktop).
 *
 * NOTE: FCM is intentionally NOT imported here to avoid double notifications.
 * Firebase background messages are handled separately by firebase-messaging-sw.js
 * only for pure FCM devices (Android without a native WebPush subscription).
 */

// ─── Native Web Push: push event ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'AC Chiari', body: event.data.text() };
  }

  const title = payload.title || 'AC Chiari';
  const options = {
    body: payload.body || '',
    icon: '/ac-logo.jpg',
    badge: '/ac-logo.jpg',
    tag: payload.tag || 'ac-chiari',
    data: { href: payload.href || '/dashboard' },
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const href = event.notification.data?.href || '/dashboard';
  const urlToOpen = new URL(href, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(urlToOpen);
            return;
          }
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      })
  );
});
