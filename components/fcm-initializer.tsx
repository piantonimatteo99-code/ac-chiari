'use client';

import { useEffect } from 'react';
import { useFirebaseApp, useFirestore, useUser } from '@/src/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Invisible component that:
 * 1. Checks if FCM is supported (not on Safari/iOS < 16.4)
 * 2. Registers the Firebase Messaging service worker via DYNAMIC import
 * 3. Handles foreground FCM messages
 *
 * Using dynamic import prevents the firebase/messaging module from being
 * loaded on browsers that don't support it (Safari, iOS), which would crash the app.
 */
export function FcmInitializer() {
  const firebaseApp = useFirebaseApp();
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    if (typeof window === 'undefined' || !firebaseApp || !user) return;

    // Must have service worker support
    if (!('serviceWorker' in navigator)) return;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] VAPID key not set. Push notifications disabled.');
      return;
    }

    let cleanup: (() => void) | undefined;

    // Dynamically import firebase/messaging to avoid crashing on Safari/iOS
    import('firebase/messaging')
      .then(async ({ getMessaging, getToken, onMessage, isSupported }) => {
        // isSupported() is async and returns false on unsupported browsers (Safari < 16.4, iOS)
        const supported = await isSupported().catch(() => false);
        if (!supported) {
          console.info('[FCM] Push notifications not supported in this browser.');
          return;
        }

        let messaging;
        try {
          messaging = getMessaging(firebaseApp);
        } catch (err) {
          console.error('[FCM] Could not initialize messaging:', err);
          return;
        }

        // Listen for foreground messages
        const unsubscribe = onMessage(messaging, (payload) => {
          if (Notification.permission === 'granted' && payload.notification) {
            new Notification(payload.notification.title ?? 'Notifica – AC Chiari', {
              body: payload.notification.body,
              icon: '/ac-logo.jpg',
            });
          }
        });
        cleanup = unsubscribe;

        // If permission already granted, refresh and save the token
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
      })
      .catch((err) => {
        // Module load failure (e.g. old Safari) — silently ignore
        console.info('[FCM] firebase/messaging not available:', err?.message);
      });

    return () => {
      if (cleanup) cleanup();
    };
  }, [firebaseApp, user, firestore]);

  return null;
}
