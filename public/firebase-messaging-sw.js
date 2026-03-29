// Firebase Cloud Messaging Service Worker
// This file MUST be in /public so it's served at the root of the site.
// Service Workers cannot access Next.js environment variables,
// so the Firebase config is hardcoded here (these are PUBLIC keys, safe to expose).

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBQM55rxYKOc7-H0amuUbr2lc39Gxva5Kw",
  authDomain: "ac-chiari-import-2024.firebaseapp.com",
  projectId: "ac-chiari-import-2024",
  storageBucket: "ac-chiari-import-2024.firebasestorage.app",
  messagingSenderId: "901135690459",
  appId: "1:901135690459:web:bf13c0ff2d857b991c7afe",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages (when app is not focused)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message:', payload);

  const notificationTitle = payload.notification?.title || 'Nuova notifica – AC Chiari';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/ac-logo.jpg',
    badge: '/ac-logo.jpg',
    data: payload.data,
    tag: payload.data?.notificationId || 'ac-chiari-notifica',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Apri' },
      { action: 'dismiss', title: 'Ignora' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const href = event.notification.data?.href || '/dashboard';
  const urlToOpen = new URL(href, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
