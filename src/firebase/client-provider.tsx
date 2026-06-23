'use client';

import React, { useState, useEffect, useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/src/firebase/provider';
import { initializeFirebase } from '@/src/firebase';
import { getTenantFromHostname } from '@/lib/tenants';

interface FirebaseClientProviderProps {
  children: ReactNode;
  databaseId: string;
}

/** Mappa tenantId → Firestore databaseId (stesso mapping del server in layout.tsx) */
function getDatabaseIdForTenant(tenantId: string): string {
  if (tenantId === 'acbrescia') return 'acbrescia';
  return '(default)';
}

/**
 * Risolve il databaseId corretto basandosi sull'hostname del browser.
 * Usa databaseId (prop dal server) come valore iniziale SSR-safe,
 * poi sovrascrive con il valore rilevato lato client dopo il mount.
 */
function resolveClientDatabaseId(databaseId: string): string {
  if (typeof window === 'undefined') return databaseId;
  const hostname = window.location.hostname;
  const tenant = getTenantFromHostname(hostname);
  return getDatabaseIdForTenant(tenant.id);
}

export function FirebaseClientProvider({ children, databaseId }: FirebaseClientProviderProps) {
  // Inizia con il valore passato dal server (corretto grazie a x-tenant-id nel middleware)
  const [resolvedDbId, setResolvedDbId] = useState<string>(databaseId);

  // Dopo il mount, verifica l'hostname del browser e correggi se necessario
  useEffect(() => {
    const clientDbId = resolveClientDatabaseId(databaseId);
    if (clientDbId !== resolvedDbId) {
      console.log(`[Firebase] Aggiornamento databaseId: ${resolvedDbId} → ${clientDbId} (rilevato da hostname)`);
      setResolvedDbId(clientDbId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Firebase con il databaseId corretto
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
