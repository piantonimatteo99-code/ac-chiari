'use client';

import { useEffect } from 'react';
import { useFirebaseApp, useFirestore, useUser } from '@/src/firebase';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Invisible component that:
 * 1. Registers the Firebase Messaging service worker
 * 2. Handles foreground FCM messages (shows a toast-like notification)
 * 
 * Mount this once inside the app layout.
 */
export function FcmInitializer() {
  const firebaseApp = useFirebaseApp();
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    // Only run in the browser, only when Firebase is ready, and only with a user
    if (typeof window === 'undefined' || !firebaseApp || !user) return;

    // Firebase Messaging requires HTTPS (or localhost)
    if (!('serviceWorker' in navigator)) return;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set. Push notifications disabled.');
      return;
    }

    let messaging: ReturnType<typeof getMessaging>;
    try {
      messaging = getMessaging(firebaseApp);
    } catch (err) {
      console.error('[FCM] Could not initialize messaging:', err);
      return;
    }

    // Listen for foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);
      // The in-app notification bell will update automatically via Firestore listener.
      // Optionally show a browser toast for foreground messages:
      if (Notification.permission === 'granted' && payload.notification) {
        new Notification(payload.notification.title ?? 'Notifica', {
          body: payload.notification.body,
          icon: '/ac-logo.jpg',
        });
      }
    });

    // If the user already granted permission, refresh/save the token
    if (Notification.permission === 'granted') {
      getToken(messaging, { vapidKey })
        .then(async (token) => {
          if (token && firestore && user) {
            await setDoc(
              doc(firestore, 'users', user.uid, 'fcmTokens', token.substring(0, 20)),
              { token, updatedAt: serverTimestamp(), platform: 'web' },
              { merge: true }
            );
          }
        })
        .catch((err) => console.error('[FCM] getToken error:', err));
    }

    return () => unsubscribe();
  }, [firebaseApp, user, firestore]);

  return null;
}
