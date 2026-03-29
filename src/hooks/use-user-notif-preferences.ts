'use client';

import { useMemo } from 'react';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/src/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { NOTIFICA_TYPE_DEFINITIONS, type NotificaEventType } from '@/lib/notification-types';

export interface UserNotifPreference {
  id: NotificaEventType;
  enabled: boolean;
}

/**
 * Hook to read and update the current user's notification preferences.
 * Stored at: users/{uid}/notificationPreferences/{eventTypeId}
 */
export function useUserNotifPreferences() {
  const firestore = useFirestore();
  const { user } = useUser();

  const prefQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'notificationPreferences');
  }, [firestore, user]);

  const { data: prefsData, isLoading } = useCollection<UserNotifPreference>(prefQuery);

  const prefsMap = useMemo(() => {
    const map = new Map<NotificaEventType, boolean>();
    if (prefsData) prefsData.forEach(p => map.set(p.id, p.enabled));
    return map;
  }, [prefsData]);

  /**
   * Get effective preference for a type.
   * If user never set it, it inherits the global default.
   */
  const isEnabled = (id: NotificaEventType): boolean => {
    if (prefsMap.has(id)) return prefsMap.get(id)!;
    const def = NOTIFICA_TYPE_DEFINITIONS.find(d => d.id === id);
    return def?.defaultEnabled ?? true;
  };

  const setPreference = async (id: NotificaEventType, enabled: boolean) => {
    if (!firestore || !user) return;
    await setDoc(
      doc(firestore, 'users', user.uid, 'notificationPreferences', id),
      { id, enabled },
      { merge: true }
    );
  };

  const resetToDefaults = async () => {
    if (!firestore || !user || !prefsData) return;
    const batch = writeBatch(firestore);
    prefsData.forEach(p => {
      batch.delete(doc(firestore, 'users', user.uid, 'notificationPreferences', p.id));
    });
    await batch.commit();
  };

  return { prefsMap, isEnabled, setPreference, resetToDefaults, isLoading };
}
