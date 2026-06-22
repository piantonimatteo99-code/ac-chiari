'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/src/firebase/provider';
import { initializeFirebase } from '@/src/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
  databaseId: string;
}

export function FirebaseClientProvider({ children, databaseId }: FirebaseClientProviderProps) {
  // Initialize Firebase once with the databaseId determined server-side from the tenant.
  // This ensures the correct Firestore instance is used from the very first render,
  // without relying on client-side cookies that may be stale or missing.
  const { firebaseApp, auth, firestore, storage, functions } = useMemo(
    () => initializeFirebase(databaseId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally static: Firebase can only be initialized once per page load
  );

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
