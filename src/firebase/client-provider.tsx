'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/src/firebase/provider';
import { initializeFirebase } from '@/src/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
  databaseId: string;
}

export function FirebaseClientProvider({ children, databaseId }: FirebaseClientProviderProps) {
  const resolvedDbId = useMemo(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const subdomain = parts[0].toLowerCase();
        const tenantSubdomain = subdomain === 'www' ? parts[1].toLowerCase() : subdomain;
        if (tenantSubdomain === 'acbrescia') {
          return 'acbrescia';
        }
      }
    }
    return databaseId;
  }, [databaseId]);

  // Initialize Firebase once with the databaseId determined client/server-side from the tenant.
  const { firebaseApp, auth, firestore, storage, functions } = useMemo(
    () => initializeFirebase(resolvedDbId),
    [resolvedDbId]
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
