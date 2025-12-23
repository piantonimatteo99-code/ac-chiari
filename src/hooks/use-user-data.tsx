'use client';

import { useMemo } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/src/firebase';
import { doc } from 'firebase/firestore';

// Define the type for user data from firestore
export interface UserData {
    id: string;
    displayName: string;
    email: string;
    roles: ('admin' | 'utente' | 'educatore')[];
    createdAt: any; // Can be a Timestamp object
    
    // Anagrafica
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    codiceFiscale?: string;
    luogoNascita?: string;
    via?: string;
    numeroCivico?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
    telefonoPrincipale?: string;
    telefonoSecondario?: string;
}

/**
 * Hook to get the current user's custom data from the 'users' collection in Firestore.
 * @returns An object containing the user data, loading state, and any errors.
 */
export function useUserData() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userData, isLoading: isDataLoading, error } = useDoc<UserData>(userDocRef);

  const isLoading = isAuthLoading || isDataLoading;

  return { userData, isLoading, error };
}
