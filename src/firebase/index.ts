'use client';

import { firebaseConfig } from '@/src/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'
import { getStorage } from "firebase/storage";
import { getFunctions } from 'firebase/functions';

export function initializeFirebase(databaseId?: string) {
  // If an app is already initialized, use it. Otherwise, initialize a new one with the full config.
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getSdks(app, databaseId);
}

export function getSdks(firebaseApp: FirebaseApp, databaseId?: string) {
  const dbId = databaseId && databaseId !== '(default)' ? databaseId : undefined;
  // Ensure that getStorage is called with the app instance that includes the storageBucket config.
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    // When dbId is undefined, getFirestore uses the default database.
    // Explicitly passing '(default)' can create a separate instance and cause conflicts.
    firestore: dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp),
    storage: getStorage(firebaseApp),
    functions: getFunctions(firebaseApp, 'us-central1'),
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';