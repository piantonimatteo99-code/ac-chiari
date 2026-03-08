'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Raccolta } from '@/components/raccolta-card';
import { RaccoltaCard } from '@/components/raccolta-card';
import { Accordion } from '@/components/ui/accordion';

export default function StoricoPage() {
  const firestore = useFirestore();

  const archivedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'raccolte'), where('archived', '==', true));
  }, [firestore]);

  const { data: archivedRaccolte, isLoading } = useCollection<Raccolta>(archivedQuery);

  return (
    <div>
        <div className="mb-8">
            <h2 className="text-xl font-semibold">Raccolte concluse</h2>
            <p className="text-muted-foreground">Elenco di tutte le raccolte fondi concluse e archiviate.</p>
        </div>

        {isLoading && <p>Caricamento storico...</p>}

        {!isLoading && (!archivedRaccolte || archivedRaccolte.length === 0) ? (
        <Card>
            <CardHeader>
                <CardTitle>Nessuna Raccolta Archiviata</CardTitle>
                <CardDescription>Lo storico è vuoto. Le raccolte appaiono qui dopo essere state archiviate.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                    <p>Nessuna raccolta fondi archiviata trovata.</p>
                </div>
            </CardContent>
        </Card>
      ) : null}

       {!isLoading && archivedRaccolte && archivedRaccolte.length > 0 && (
         <Accordion type="multiple" className="space-y-4">
             {archivedRaccolte.map(raccolta => (
                <RaccoltaCard key={raccolta.id} raccolta={raccolta} onEdit={() => {}} />
            ))}
        </Accordion>
      )}
    </div>
  );
}
