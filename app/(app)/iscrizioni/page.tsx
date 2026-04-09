'use client';

import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserData } from '@/src/hooks/use-user-data';
import type { Raccolta } from '@/components/raccolta-card';
import type { Membro } from '../nucleo-familiare/page';
import { useUserData } from '@/src/hooks/use-user-data';
import { IscrizioneFamigliaCard, type PaymentSelection } from '@/components/iscrizione-famiglia-card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { Tariffa } from '../tesserati/tariffe/page';
import { PageTutorial } from '@/components/page-tutorial';
import dynamic from 'next/dynamic';

const UploadReceiptDialog = dynamic(() => 
    import('@/components/upload-receipt-dialog').then(mod => mod.UploadReceiptDialog), 
    { 
        ssr: false,
        loading: () => <div className="fixed inset-0 bg-background/80 flex items-center justify-center"><p>Caricamento...</p></div>
    }
);


export interface UnifiedMember extends Partial<Membro>, Partial<UserData> {
  id: string;
  nome?: string;
  cognome?: string;
  groupId?: string;
  familyId?: string;
  dataNascita?: string;
}


export default function IscrizioniPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { userData, isLoading: isUserLoading } = useUserData();
    const resolvedFamilyId = userData?.familyId ?? user?.uid;

    const [paymentSelections, setPaymentSelections] = useState<Record<string, PaymentSelection>>({});
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    
    
    const handleSelectionChange = useCallback((raccoltaId: string, selection: PaymentSelection) => {
        setPaymentSelections(prev => ({
            ...prev,
            [raccoltaId]: selection,
        }));
    }, []);

    const raccolteQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'raccolte'), where('archived', '!=', true));
    }, [firestore]);
    const { data: raccolte, isLoading: isLoadingRaccolte } = useCollection<Raccolta>(raccolteQuery);

    const membriQuery = useMemoFirebase(() => {
        if (!firestore || !resolvedFamilyId) return null;
        return collection(firestore, 'famiglie', resolvedFamilyId, 'membri');
    }, [firestore, resolvedFamilyId]);
    const { data: membri, isLoading: isLoadingMembri } = useCollection<Membro>(membriQuery);
    
    const tariffeQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'tariffe-tesseramento');
    }, [firestore]);
    const { data: tariffe, isLoading: isLoadingTariffe } = useCollection<Tariffa>(tariffeQuery);

    const userAndFamily = useMemo((): UnifiedMember[] => {
        if (!userData && !membri) return [];
        
        const allFamilyMembers: UnifiedMember[] = [];
        if(userData && userData.id && userData.nome && userData.cognome) {
            allFamilyMembers.push({
                id: userData.id,
                nome: userData.nome,
                cognome: userData.cognome,
                groupId: userData.groupId,
                familyId: userData.id, 
                dataNascita: userData.dataNascita
            });
        }

        if (membri) {
        membri.forEach(membro => {
            if(membro.id && membro.nome && membro.cognome) {
                allFamilyMembers.push({
                    id: membro.id,
                    nome: membro.nome,
                    cognome: membro.cognome,
                    groupId: membro.groupId,
                    familyId: userData?.id,
                    dataNascita: membro.dataNascita
                });
            }
        });
        }

        return allFamilyMembers;

    }, [userData, membri]);

    const relevantRaccolte = useMemo(() => {
        if (!raccolte || userAndFamily.length === 0) return [];
        
        const familyGroupIds = new Set(userAndFamily.map(member => member.groupId).filter(Boolean));

        return raccolte.filter(raccolta => {
            const inGroup = raccolta.gruppiId.some(groupId => familyGroupIds.has(groupId));
            if (!inGroup) return false;

            if (raccolta.tipo === 'tesseramento') {
                return true;
            }

            const activePhases = [
                raccolta.faseConferma,
                raccolta.faseCaparra,
                raccolta.faseSaldo
            ].filter(fase => fase.attiva);

            if (activePhases.length === 0) {
                return false;
            }

            return activePhases.some(fase => !fase.conclusa);
        });
    }, [raccolte, userAndFamily]);
    
    const { totalDue, membersToPayCount, paymentItems, relevantRaccolteForDialog } = useMemo(() => {
        let total = 0;
        const memberIds = new Set<string>();
        const items: { raccoltaId: string; raccoltaNome: string; memberId: string; memberName: string; phase: string; amount: string }[] = [];
        const relevantRaccolteMap = new Map<string, Raccolta>();

        for (const raccoltaId in paymentSelections) {
            const selection = paymentSelections[raccoltaId];
            const raccolta = relevantRaccolte.find(r => r.id === raccoltaId);
            if (!raccolta) continue;

            const { totalDue: raccoltaTotal, membersToPay, itemsToPay } = selection;
            if (raccoltaTotal > 0) {
                total += raccoltaTotal;
                membersToPay.forEach(member => memberIds.add(member.id));
                itemsToPay.forEach(item => {
                    items.push({
                        raccoltaId: raccolta.id,
                        raccoltaNome: raccolta.nome,
                        memberId: item.memberId,
                        memberName: item.memberName,
                        phase: item.phase,
                        amount: item.amount,
                    });
                });
                if(!relevantRaccolteMap.has(raccolta.id)) {
                relevantRaccolteMap.set(raccolta.id, raccolta);
                }
            }
        }
        
        return { 
            totalDue: total, 
            membersToPayCount: memberIds.size,
            paymentItems: items,
            relevantRaccolteForDialog: Array.from(relevantRaccolteMap.values())
        };
    }, [paymentSelections, relevantRaccolte]);

    const isLoading = isUserLoading || isLoadingRaccolte || isLoadingMembri || isLoadingTariffe;
    
    const handleOpenPaymentDialog = () => {
        if (totalDue > 0) {
            setIsUploadDialogOpen(true);
        }
    };


    if (isLoading) {
        return <p>Caricamento iscrizioni...</p>;
    }

    return (
        <div className="space-y-8 pb-32">
            {!isLoading && relevantRaccolte.length === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Nessuna Iscrizione Disponibile</CardTitle>
                        <CardDescription>
                        Al momento non ci sono raccolte fondi o attività a cui puoi iscriverti.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12 text-muted-foreground">
                            <p>Controlla più tardi o contatta un amministratore se credi ci sia un errore.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isLoading && relevantRaccolte.length > 0 && (
                <div className="space-y-8">
                    {relevantRaccolte.map(raccolta => {
                        const familyMembersForRaccolta = userAndFamily.filter(member => member.groupId && raccolta.gruppiId.includes(member.groupId));
                        if (familyMembersForRaccolta.length === 0) return null;

                        return (
                            <IscrizioneFamigliaCard 
                                key={raccolta.id}
                                raccolta={raccolta}
                                familyMembers={userAndFamily}
                                onSelectionChange={handleSelectionChange}
                                tariffe={tariffe}
                            />
                        );
                    })}
                </div>
            )}

            {totalDue > 0 && (
                <div className="fixed bottom-0 left-0 sm:left-64 right-0 p-4 border-t bg-background/95 backdrop-blur-sm">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Totale selezioni per {membersToPayCount} {membersToPayCount > 1 ? 'membri' : 'membro'}:</p>
                            <p className='text-3xl font-bold'>€{totalDue.toFixed(2)}</p>
                        </div>
                        <Button size="lg" onClick={handleOpenPaymentDialog}>
                           Paga e Carica Ricevuta <ArrowRight className='ml-2 h-4 w-4' />
                        </Button>
                    </div>
                </div>
            )}

            {isUploadDialogOpen && (
                <UploadReceiptDialog
                    isOpen={isUploadDialogOpen}
                    onOpenChange={setIsUploadDialogOpen}
                    raccolte={relevantRaccolteForDialog}
                    importoAtteso={totalDue.toFixed(2)}
                    paymentItems={paymentItems}
                    onSuccess={() => {
                        // Reset selections for all cards after a successful payment
                        setPaymentSelections({});
                        // Potresti voler forzare un re-render delle card qui se non si aggiornano
                    }}
                />
            )}

            <PageTutorial
                pageId="iscrizioni"
                steps={[
                    {
                        icon: '✍️',
                        title: 'Centro Iscrizioni e Pagamenti',
                        description: 'Da questa pagina puoi gestire tutte le iscrizioni ai campi, i tesseramenti e i pagamenti associati.',
                    },
                    {
                        icon: '💶',
                        title: 'Gestione Pagamenti',
                        description: 'Scegli le voci da saldare (quote o caparre), vedrai il totale aggiornarsi in basso. Puoi pagare per te o per i membri del tuo nucleo in un\'unica soluzione.',
                    },
                    {
                        icon: '🧾',
                        title: 'Carica la ricevuta',
                        description: 'Dopo aver cliccato "Paga e Carica Ricevuta", potrai allegare la prova di pagamento (es. screenshot del bonifico). Gli educatori la valideranno al più presto.',
                    }
                ]}
            />
        </div>
    );
}
