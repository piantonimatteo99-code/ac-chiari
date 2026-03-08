'use client';

import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { Group } from '../admin/gestione-gruppi/tutti-i-gruppi/page';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { slugify } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';

export default function MieiGruppiPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();

  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData) return null;
    
    const isEducatore = userData.roles?.includes('educatore');
    const isAdmin = userData.roles?.includes('admin');

    // Only admins or educators can query groups
    if (isAdmin) {
        return collection(firestore, 'gruppi');
    }
    
    if (isEducatore) {
        return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
    }
    
    // For any other role, do not execute a query
    return null;

  }, [firestore, user, userData]);

  const { data: myGroups, isLoading } = useCollection<Group>(myGroupsQuery);


  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">I Miei Gruppi</h1>
      </div>

      {isLoading && <p>Caricamento dei tuoi gruppi...</p>}

      {!isLoading && (!myGroups || myGroups.length === 0) && (
        <Card className="flex flex-col items-center justify-center p-10 text-center">
            <CardHeader>
                <CardTitle>Nessun gruppo assegnato</CardTitle>
                <CardDescription>
                    {userData?.roles?.includes('admin')
                      ? "Nessun gruppo è stato ancora creato. Inizia dalla sezione 'Gestione Gruppi'."
                      : "Al momento non sei assegnato a nessun gruppo o non hai i permessi per visualizzare questa sezione. Contatta un amministratore."
                    }
                </CardDescription>
            </CardHeader>
        </Card>
      )}

      {!isLoading && myGroups && myGroups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {myGroups.map(group => (
            <Link href={`/miei-gruppi/${slugify(group.name)}`} key={group.id}>
              <Card className="hover:border-primary transition-colors h-full flex flex-col justify-between">
                <CardHeader>
                  <CardTitle>{group.name}</CardTitle>
                  <CardDescription>Gestisci il gruppo, i componenti e le attività.</CardDescription>
                </CardHeader>
                <div className="flex justify-end p-4">
                    <ArrowRight className="h-5 w-5 text-muted-foreground"/>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
