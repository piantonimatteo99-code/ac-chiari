'use client';

import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import type { Group } from '../../admin/gestione-gruppi/tutti-i-gruppi/page';
import { slugify } from '@/lib/utils';

export default function GruppoDettaglioPage() {
  const firestore = useFirestore();
  const params = useParams();
  const { user } = useUser();
  const { slug } = params;

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Query only for the groups the current educator is assigned to.
    // This is secure and respects Firestore rules.
    return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
  }, [firestore, user]);

  const { data: userGroups, isLoading } = useCollection<Group>(groupsQuery);

  const group = useMemo(() => {
    if (!userGroups || !slug) return null;
    // Find the specific group by slug from the user's groups.
    return userGroups.find(g => slugify(g.name) === slug);
  }, [userGroups, slug]);

  if (isLoading) {
    return <div>Caricamento gruppo...</div>;
  }

  if (!group) {
    return <div>Gruppo non trovato o non hai i permessi per visualizzarlo.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{group.name}</h1>
      <p className="text-muted-foreground">Dettagli e gestione del gruppo.</p>
      {/* Future components for managing group members will go here */}
    </div>
  );
}
