'use client';

import { useMemo } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/src/firebase';
import { doc } from 'firebase/firestore';

// Define the type for user data from firestore
export interface UserData {
    id: string;
    displayName: string;
    email: string;
    roles: ('admin' | 'utente' | 'educatore' | 'genitore')[];
    createdAt: any; // Can be a Timestamp object
    
    // Personal data, might be distinct from family data
    nome?: string;
    cognome?: string;

    // familyId: UID of the family head (capofamiglia).
    // If not set, the user IS the family head (familyId == uid).
    familyId?: string;

    // Address data might be here, but we now store it in the 'famiglie' collection
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
    archived?: boolean;
    groupId?: string;
    groupName?: string;
    tesseramento?: number;
}

/**
 * Hook to get the current user's custom data from the 'users' collection in Firestore.
 * Also exposes `resolvedFamilyId`: the family head's UID (= user.uid if not linked to another family).
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

  // Resolve: if familyId is set and != uid, use it; otherwise use own uid as family head
  const resolvedFamilyId = useMemo(() => {
    if (!user) return null;
    return userData?.familyId ?? user.uid;
  }, [userData, user]);

  return { userData, isLoading, error, resolvedFamilyId };
}
