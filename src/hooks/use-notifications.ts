'use client';

import { useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, where, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';

export interface Notifica {
  id: string;
  title: string;
  body: string;
  type: 'pagamento' | 'evento' | 'iscrizione' | 'magazzino' | 'generale' | 'feedback';
  href?: string;
  letta: boolean;
  createdAt: any;
  userId?: string; // undefined = broadcast a tutti
}

export function useNotifications() {
  const firestore = useFirestore();
  const { user } = useUser();

  const notifQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'notifiche'),
      where('userId', 'in', [user.uid, '__broadcast__']),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
  }, [firestore, user]);

  const { data: notifiche, isLoading } = useCollection<Notifica>(notifQuery);

  const unreadCount = useMemo(
    () => notifiche?.filter(n => !n.letta).length ?? 0,
    [notifiche]
  );

  const markAsRead = async (id: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'notifiche', id), { letta: true });
  };

  const markAllAsRead = async () => {
    if (!firestore || !notifiche) return;
    const unread = notifiche.filter(n => !n.letta);
    if (unread.length === 0) return;
    const batch = writeBatch(firestore);
    unread.forEach(n => batch.update(doc(firestore, 'notifiche', n.id), { letta: true }));
    await batch.commit();
  };

  return { notifiche: notifiche ?? [], unreadCount, isLoading, markAsRead, markAllAsRead };
}
