'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { NuovaRaccoltaDialog } from '@/components/nuova-raccolta-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Raccolta } from '@/components/raccolta-card';
import { RaccoltaCard } from '@/components/raccolta-card';
import { Accordion } from '@/components/ui/accordion';

export default function RaccoltePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRaccolta, setEditingRaccolta] = useState<Raccolta | null>(null);
  const firestore = useFirestore();

  const raccolteQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Query to get only non-archived collections
    return query(collection(firestore, 'raccolte'), where('archived', '==', false));
  }, [firestore]);

  const { data: raccolte, isLoading } = useCollection<Raccolta>(raccolteQuery);
  
  const handleAddNew = () => {
    setEditingRaccolta(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (raccolta: Raccolta) => {
    setEditingRaccolta(raccolta);
    setIsDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
            <h2 className="text-xl font-semibold">Raccolte attive</h2>
            <p className="text-muted-foreground">Elenco di tutte le raccolte fondi in corso o pianificate.</p>
        </div>
        <Button onClick={handleAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Aggiungi Raccolta
        </Button>
      </div>

      <NuovaRaccoltaDialog 
        isOpen={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        raccoltaToEdit={editingRaccolta}
      />

      {isLoading && <p>Caricamento raccolte...</p>}
      
      {!isLoading && (!raccolte || raccolte.length === 0) && (
        <Card>
            <CardHeader>
                <CardTitle>Nessuna Raccolta Attiva</CardTitle>
                <CardDescription>Crea una nuova raccolta per iniziare a gestire le iscrizioni e i pagamenti.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                    <p>Nessuna raccolta fondi attiva. Inizia creandone una nuova.</p>
                </div>
            </CardContent>
        </Card>
      )}

      {!isLoading && raccolte && raccolte.length > 0 && (
         <Accordion type="multiple" className="space-y-4">
             {raccolte.map(raccolta => (
                <RaccoltaCard key={raccolta.id} raccolta={raccolta} onEdit={() => handleEdit(raccolta)} />
            ))}
        </Accordion>
      )}

    </div>
  );
}
