/**
 * AC Chiari — Unified Service Worker
 * Handles both:
 *  1. Native Web Push (W3C PushManager) — works on iOS 16.4+ PWA, Android, Desktop
 *  2. Firebase Cloud Messaging background messages (Chrome/Android fallback)
 *
 * This file MUST be served from the root: /sw.js
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

// ─── Firebase Messaging fallback (Chrome/Android) ────────────────────────────
// Only runs if the Firebase compat scripts are imported (they won't be on iOS).
try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

  const firebaseConfig = {
    apiKey: 'AIzaSyBQM55rxYKOc7-H0amuUbr2lc39Gxva5Kw',
    authDomain: 'ac-chiari-import-2024.firebaseapp.com',
    projectId: 'ac-chiari-import-2024',
    storageBucket: 'ac-chiari-import-2024.firebasestorage.app',
    messagingSenderId: '901135690459',
    appId: '1:901135690459:web:bf13c0ff2d857b991c7afe',
  };

  if (!self.firebase?.apps?.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Nuova notifica – AC Chiari';
    const options = {
      body: payload.notification?.body || '',
      icon: '/ac-logo.jpg',
      badge: '/ac-logo.jpg',
      data: payload.data,
      tag: payload.data?.notificationId || 'ac-chiari-fcm',
    };
    self.registration.showNotification(title, options);
  });
} catch (_) {
  // Firebase not available on this browser — native Web Push only
}
