'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/src/firebase/provider';
import { initializeFirebase } from '@/src/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // By calling initializeFirebase here, we ensure that on the client,
  // the app is initialized once with the complete configuration, including storageBucket.
  const { firebaseApp, auth, firestore, storage, functions } = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
      storage={storage}
      functions={functions}
    >
      {children}
    </FirebaseProvider>
  );
}
