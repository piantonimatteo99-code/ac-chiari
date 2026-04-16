'use client';

import { useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, where, limit, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';

export interface Notifica {
  id: string;
  title: string;
  body: string;
  type: 'pagamento' | 'evento' | 'iscrizione' | 'magazzino' | 'generale' | 'feedback';
  href?: string;
  letta: boolean;
  createdAt: any;
  userId?: string;
}

export function useNotifications() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();

  const isAdmin = userData?.roles?.includes('admin');

  // Query 1: notifications for the specific logged-in user
  const userNotifQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'notifiche'),
      where('userId', '==', user.uid),
      limit(20)
    );
  }, [firestore, user]);

  // Query 2: broadcast notifications for all users
  const broadcastNotifQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'notifiche'),
      where('userId', '==', '__broadcast__'),
      limit(15)
    );
  }, [firestore]);

  // Query 3: admin-only broadcast notifications (only fetched if admin)
  const adminNotifQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(
      collection(firestore, 'notifiche'),
      where('userId', '==', '__admin_broadcast__'),
      limit(15)
    );
  }, [firestore, isAdmin]);

  const { data: userNotifiche, isLoading: isLoadingUser } = useCollection<Notifica>(userNotifQuery);
  const { data: broadcastNotifiche, isLoading: isLoadingBroadcast } = useCollection<Notifica>(broadcastNotifQuery);
  const { data: adminNotifiche, isLoading: isLoadingAdmin } = useCollection<Notifica>(adminNotifQuery);

  // Merge and sort all notifications client-side, dedup by id
  const notifiche = useMemo(() => {
    const all = [
      ...(userNotifiche ?? []),
      ...(broadcastNotifiche ?? []),
      ...(adminNotifiche ?? []),
    ];
    // Deduplicate by id
    const seen = new Set<string>();
    const deduped = all.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
    // Sort by createdAt descending
    return deduped.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    }).slice(0, 30);
  }, [userNotifiche, broadcastNotifiche, adminNotifiche]);

  const isLoading = isLoadingUser || isLoadingBroadcast || isLoadingAdmin;

  const unreadCount = useMemo(
    () => notifiche.filter(n => !n.letta).length,
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

  const deleteNotifica = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, 'notifiche', id));
  };

  const deleteAllNotifiche = async () => {
    if (!firestore || !user || !notifiche.length) return;
    const batch = writeBatch(firestore);
    notifiche.forEach(n => {
      if (n.userId === user.uid) {
        // Personal notifications: delete
        batch.delete(doc(firestore, 'notifiche', n.id));
      } else if (!n.letta) {
        // Broadcast notifications: just mark as read (shared doc, can't delete)
        batch.update(doc(firestore, 'notifiche', n.id), { letta: true });
      }
    });
    await batch.commit();
  };

  return { notifiche, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotifica, deleteAllNotifiche };
}

