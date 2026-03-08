'use client';
import { useParams } from 'next/navigation';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from '@/src/firebase';
import { collection, query, where, doc, writeBatch, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useUserData } from '@/src/hooks/use-user-data';
import type { Progetto } from '../page';
import type { Membro } from '../../nucleo-familiare/page';
import type { Group } from '../../admin/gestione-gruppi/tutti-i-gruppi/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Pencil } from 'lucide-react';
import type { Raccolta } from '@/components/raccolta-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NuovaRaccoltaDialog } from '@/components/nuova-raccolta-dialog';
import { Accordion } from '@/components/ui/accordion';
import { RaccoltaCard } from '@/components/raccolta-card';

export default function ProgettoDettaglioPage() {
    const params = useParams();
    const { slug } = params;
    const firestore = useFirestore();
    const { user } = useUser();
    const { userData, isLoading: isUserLoading } = useUserData();
    const [isSavingGroups, setIsSavingGroups] = useState(false);
    const [isRaccoltaDialogOpen, setIsRaccoltaDialogOpen] = useState(false);

    // Fetch the project by slug
    const progettoQuery = useMemoFirebase(() => {
        if (!firestore || !slug) return null;
        return query(collection(firestore, 'progetti'), where('slug', '==', slug));
    }, [firestore, slug]);

    const { data: progettiData, isLoading: isLoadingProgetto } = useCollection<Progetto>(progettoQuery);
    const progetto = useMemo(() => progettiData?.[0], [progettiData]);
    
    // Fetch the associated fundraiser if it exists
    const raccoltaDocRef = useMemoFirebase(() => {
        if (!firestore || !progetto?.raccoltaId) return null;
        return doc(firestore, 'raccolte', progetto.raccoltaId);
    }, [firestore, progetto?.raccoltaId]);
    const { data: raccoltaData, isLoading: isLoadingRaccolta } = useDoc<Raccolta>(raccoltaDocRef);

    // Fetch all groups for the group management tab
    const allGroupsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'gruppi') : null, [firestore]);
    const { data: allGroups, isLoading: isLoadingAllGroups } = useCollection<Group>(allGroupsQuery);

    const [selectedGruppi, setSelectedGruppi] = useState<string[]>([]);

    useEffect(() => {
        if(progetto?.groupIds) {
            setSelectedGruppi(progetto.groupIds);
        }
    }, [progetto?.groupIds]);


    // --- PERMISSION LOGIC ---
    const myGroupsQuery = useMemoFirebase(() =>
        (user && userData?.roles?.includes('educatore'))
        ? query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid))
        : null,
    [firestore, user, userData]);
    const { data: myGroups, isLoading: isLoadingGroups } = useCollection<Group>(myGroupsQuery);

    const membriQuery = useMemoFirebase(() => {
        if (!firestore || !user || !userData?.roles?.includes('genitore')) return null;
        return collection(firestore, 'famiglie', user.uid, 'membri');
    }, [firestore, user, userData]);
    const { data: membri, isLoading: isLoadingMembri } = useCollection<Membro>(membriQuery);
    
    const userAndFamilyMembers = useMemo((): (typeof userData | Membro)[] => {
        if (!userData && !membri) return [];
        const allFamilyMembers = [];
        if (userData) allFamilyMembers.push(userData);
        if (membri) allFamilyMembers.push(...membri);
        return allFamilyMembers;
    }, [userData, membri]);

    const hasPermission = useMemo(() => {
        if (isLoadingProgetto || isUserLoading || isLoadingGroups || isLoadingMembri) return false;
        if (!progetto || !userData || !user) return false;
        if (userData.roles?.includes('admin')) return true;
        
        if (userData.roles?.includes('educatore')) {
            if (!myGroups) return false; 
            const educatorGroupIds = new Set(myGroups.map(g => g.id));
            return progetto.groupIds.some(gid => educatorGroupIds.has(gid));
        }

        if (userData.roles?.includes('genitore')) {
            if (!userAndFamilyMembers) return false; 
            const familyGroupIds = new Set(userAndFamilyMembers.map(m => (m as any).groupId).filter(Boolean));
            return progetto.groupIds.some(gid => familyGroupIds.has(gid));
        }
        return false;
    }, [progetto, userData, user, myGroups, userAndFamilyMembers, isLoadingProgetto, isUserLoading, isLoadingGroups, isLoadingMembri]);
    // --- END PERMISSION LOGIC ---
    
    const canEdit = useMemo(() => {
        if (!userData) return false;
        return userData.roles?.includes('admin') || userData.roles?.includes('educatore');
    }, [userData]);

    const handleLinkRaccoltaToProgetto = useCallback(async (raccoltaId: string) => {
        if (!firestore || !progetto) return;
        try {
            const batch = writeBatch(firestore);

            const progettoDocRef = doc(firestore, 'progetti', progetto.id);
            batch.update(progettoDocRef, { raccoltaId: raccoltaId });

            const eventQuery = query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id));
            const eventSnapshot = await getDocs(eventQuery);
            if (!eventSnapshot.empty) {
                const eventDocRef = eventSnapshot.docs[0].ref;
                batch.update(eventDocRef, { raccoltaId: raccoltaId });
            }
            await batch.commit();
        } catch (error) {
            console.error("Error linking fundraiser to project:", error);
        }
    }, [firestore, progetto]);

    const handleGroupToggle = (groupId: string, isChecked: boolean) => {
        setSelectedGruppi(prev => 
            isChecked ? [...prev, groupId] : prev.filter(id => id !== groupId)
        );
    };

    const handleSaveGroups = useCallback(async () => {
        if (!firestore || !progetto) return;
        setIsSavingGroups(true);
        try {
            const batch = writeBatch(firestore);
            
            // Update Project
            const progettoDocRef = doc(firestore, 'progetti', progetto.id);
            batch.update(progettoDocRef, { groupIds: selectedGruppi });

            // Update linked Event
            const eventQuery = query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id));
            const eventSnapshot = await getDocs(eventQuery);
            if (!eventSnapshot.empty) {
                const eventDocRef = eventSnapshot.docs[0].ref;
                batch.update(eventDocRef, { groupIds: selectedGruppi });
            }

            // If a raccolta is linked, update it too
            if (progetto.raccoltaId) {
                const raccoltaDocRef = doc(firestore, 'raccolte', progetto.raccoltaId);
                batch.update(raccoltaDocRef, { gruppiId: selectedGruppi });
            }

            await batch.commit();
            // Add toast notification for success
        } catch (error) {
            console.error("Error saving groups:", error);
            // Add toast notification for error
        } finally {
            setIsSavingGroups(false);
        }
    }, [firestore, progetto, selectedGruppi]);

    const isLoading = isUserLoading || isLoadingProgetto;

    if (isLoading) {
        return <div>Caricamento...</div>;
    }

    if (!progetto || !hasPermission) {
        return <div>Progetto non trovato o non hai i permessi per visualizzarlo.</div>;
    }

    // Render page
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-bold">{progetto.name}</h1>
            
            <NuovaRaccoltaDialog 
                isOpen={isRaccoltaDialogOpen}
                onOpenChange={setIsRaccoltaDialogOpen}
                raccoltaToEdit={raccoltaData}
                initialData={!raccoltaData && progetto ? { nome: `Raccolta per: ${progetto.name}`, gruppiId: progetto.groupIds } : undefined}
                onSaveSuccess={handleLinkRaccoltaToProgetto}
            />

            <Tabs defaultValue="generale" className="w-full">
                <TabsList>
                    <TabsTrigger value="generale">Generale</TabsTrigger>
                    <TabsTrigger value="iscrizioni" disabled={!canEdit}>Iscrizioni</TabsTrigger>
                    <TabsTrigger value="gruppi" disabled={!canEdit}>Gruppi</TabsTrigger>
                    <TabsTrigger value="piano" disabled={!canEdit}>Piano Impegni</TabsTrigger>
                </TabsList>

                <TabsContent value="generale" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Descrizione Progetto</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <p className="text-sm text-muted-foreground">
                                {progetto.description || "Nessuna descrizione per questo progetto."}
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="iscrizioni" className="mt-4">
                     {isLoadingRaccolta ? (
                        <p>Caricamento...</p>
                    ) : raccoltaData ? (
                        <Accordion type="single" collapsible className="w-full">
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
                </TabsContent>

                <TabsContent value="gruppi" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Gruppi Coinvolti</CardTitle>
                            <CardDescription>
                                Seleziona i gruppi che parteciperanno a questo progetto.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <ScrollArea className="h-64 rounded-md border p-4">
                                {isLoadingAllGroups ? <p>Caricamento gruppi...</p> : (
                                    <div className="space-y-2">
                                        {allGroups && allGroups.length > 0 ? allGroups.map(group => (
                                            <div key={group.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`group-${group.id}`}
                                                    checked={selectedGruppi.includes(group.id)}
                                                    onCheckedChange={(checked) => handleGroupToggle(group.id, !!checked)}
                                                />
                                                <Label htmlFor={`group-${group.id}`} className="text-sm font-medium leading-none">
                                                    {group.name}
                                                </Label>
                                            </div>
                                        )) : <p className="text-sm text-muted-foreground">Nessun gruppo trovato.</p>}
                                    </div>
                                )}
                            </ScrollArea>
                            <div className='flex justify-end'>
                                <Button onClick={handleSaveGroups} disabled={isSavingGroups}>
                                    {isSavingGroups && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salva Modifiche Gruppi
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                 <TabsContent value="piano" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Piano Impegni</CardTitle>
                            <CardDescription>
                                Definisci le scadenze e le attività per la realizzazione del progetto. (In Sviluppo)
                            </CardDescription>
                        </CardHeader>
                         <CardContent>
                           <p className="text-center text-muted-foreground p-8">
                                Funzionalità in arrivo.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
