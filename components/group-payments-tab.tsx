'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Accordion } from '@/components/ui/accordion';
import { Coins } from 'lucide-react';
import { RaccoltaCard } from '@/components/raccolta-card';
import type { Raccolta } from '@/components/raccolta-card';

interface GroupPaymentsTabProps {
  groupId: string;
  memberIds: string[];
}

export function GroupPaymentsTab({ groupId }: GroupPaymentsTabProps) {
  const firestore = useFirestore();

  const raccoltaQuery = useMemoFirebase(() => {
    if (!firestore || !groupId) return null;
    return query(
      collection(firestore, 'raccolte'),
      where('gruppiId', 'array-contains', groupId),
      where('archived', '==', false)
    );
  }, [firestore, groupId]);

  const { data: raccolte, isLoading } = useCollection<Raccolta>(raccoltaQuery);

  const activeRaccolte = useMemo(() => {
    if (!raccolte) return [];
    return [...raccolte].sort((a, b) => {
      const aTime = a.createdAt?.toDate?.()?.getTime() ?? 0;
      const bTime = b.createdAt?.toDate?.()?.getTime() ?? 0;
      return bTime - aTime;
    });
  }, [raccolte]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Coins className="h-5 w-5 animate-pulse" />
        <span>Caricamento raccolte...</span>
      </div>
    );
  }

  if (activeRaccolte.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center gap-3">
        <Coins className="h-10 w-10 opacity-30" />
        <div>
          <p className="font-medium text-sm">Nessuna raccolta attiva per questo gruppo</p>
          <p className="text-xs mt-1">
            Le raccolte fondi associate al gruppo appariranno qui con la possibilità di gestire i pagamenti.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="space-y-3">
      {activeRaccolte.map(raccolta => (
        <RaccoltaCard
          key={raccolta.id}
          raccolta={raccolta}
          onEdit={() => {}}
        />
      ))}
    </Accordion>
  );
}
