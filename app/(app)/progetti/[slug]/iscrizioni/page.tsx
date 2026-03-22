'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from '@/src/firebase';
import { collection, query, where, doc, writeBatch, getDocs } from 'firebase/firestore';
import { useMemo, useCallback, useState } from 'react';
import { useUserData } from '@/src/hooks/use-user-data';
import type { Progetto } from '../../page';
import type { Raccolta } from '@/components/raccolta-card';
import { RaccoltaCard } from '@/components/raccolta-card';
import { Accordion } from '@/components/ui/accordion';
import { NuovaRaccoltaDialog } from '@/components/nuova-raccolta-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';

export default function ProgettoIscrizioniPage() {
    const params = useParams();
    const { slug } = params;
    const firestore = useFirestore();
    const { user } = useUser();
    const { userData } = useUserData();

    const [isRaccoltaDialogOpen, setIsRaccoltaDialogOpen] = useState(false);

    // Fetch the project by slug
    const progettoQuery = useMemoFirebase(() => {
        if (!firestore || !slug) return null;
        return query(collection(firestore, 'progetti'), where('slug', '==', slug));
    }, [firestore, slug]);
    const { data: progettiData, isLoading: isLoadingProgetto } = useCollection<Progetto>(progettoQuery);
    const progetto = useMemo(() => progettiData?.[0], [progettiData]);

    // Fetch the associated fundraiser
    const raccoltaDocRef = useMemoFirebase(() => {
        if (!firestore || !progetto?.raccoltaId) return null;
        return doc(firestore, 'raccolte', progetto.raccoltaId);
    }, [firestore, progetto?.raccoltaId]);
    const { data: raccoltaData, isLoading: isLoadingRaccolta } = useDoc<Raccolta>(raccoltaDocRef);

    const canEdit = useMemo(() => {
        if (!userData) return false;
        return userData.roles?.includes('admin') || userData.roles?.includes('educatore');
    }, [userData]);

    const handleLinkRaccoltaToProgetto = useCallback(async (raccoltaId: string) => {
        if (!firestore || !progetto) return;
        try {
            const { doc: firestoreDoc, updateDoc, writeBatch: wb } = await import('firebase/firestore');
            const batch = writeBatch(firestore);
            const progettoDocRef = firestoreDoc(firestore, 'progetti', progetto.id);
            batch.update(progettoDocRef, { raccoltaId });
            const eventQuery = query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id));
            const eventSnapshot = await getDocs(eventQuery);
            if (!eventSnapshot.empty) {
                batch.update(eventSnapshot.docs[0].ref, { raccoltaId });
            }
            await batch.commit();
        } catch (error) {
            console.error("Error linking fundraiser:", error);
        }
    }, [firestore, progetto]);

    if (isLoadingProgetto) {
        return <div className="p-8 text-muted-foreground">Caricamento...</div>;
    }

    if (!progetto) {
        return <div className="p-8 text-muted-foreground">Progetto non trovato.</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/progetti/${slug}`}>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <p className="text-sm text-muted-foreground">
                        <Link href={`/progetti/${slug}`} className="hover:underline">{progetto.name}</Link>
                        {' '}&rsaquo; Iscrizioni
                    </p>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" />
                        Gestione Iscrizioni
                    </h1>
                </div>
            </div>

            <NuovaRaccoltaDialog
                isOpen={isRaccoltaDialogOpen}
                onOpenChange={setIsRaccoltaDialogOpen}
                raccoltaToEdit={raccoltaData}
                initialData={!raccoltaData && progetto ? { nome: `Raccolta per: ${progetto.name}`, gruppiId: progetto.groupIds } : undefined}
                onSaveSuccess={handleLinkRaccoltaToProgetto}
            />

            {isLoadingRaccolta ? (
                <p className="text-muted-foreground">Caricamento raccolta...</p>
            ) : raccoltaData ? (
                <Accordion type="single" collapsible className="w-full" defaultValue={raccoltaData.id}>
                    <RaccoltaCard raccolta={raccoltaData} onEdit={() => setIsRaccoltaDialogOpen(true)} />
                </Accordion>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Gestione Iscrizioni e Raccolta Fondi</CardTitle>
                        <CardDescription>
                            Collega o gestisci una raccolta fondi per le iscrizioni a questo progetto.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => setIsRaccoltaDialogOpen(true)} disabled={!canEdit}>
                            Crea Raccolta Fondi
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
