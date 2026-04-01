'use client';

import { useMemo, useState, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, query, where, collectionGroup, doc, updateDoc, arrayUnion, arrayRemove, writeBatch, serverTimestamp, addDoc, getDocs, deleteField, getDoc } from 'firebase/firestore';
import type { Raccolta } from '@/components/raccolta-card';
import type { UnifiedMember } from '@/components/membri-raccolta-list';
import type { UserData } from '@/src/hooks/use-user-data';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Loader2, ArrowRight, Info, Archive, MoreHorizontal } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Spesa } from '@/components/add-spesa-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Tariffa } from '../../tesserati/tariffe/page';
import { triggerNotification } from '@/lib/trigger-notification';


export interface MovimentoContante {
    id: string;
    raccoltaId: string;
    memberId: string;
    phase: 'caparra' | 'saldo' | 'tesseramento';
    importo: number;
    createdAt: any;
    registeredBy: string; // UID of the admin/educator who registered the payment
    isDelivered?: boolean;
    isDeposited?: boolean;
    depositId?: string; 
    tipo?: 'raccolta' | 'deposito' | 'spesa';
    descrizione?: string;
    spesaId?: string;
    deliveredTo?: string; // UID of the user who received the cash
    isVerified?: boolean;
}

interface EducatorCashSummary {
    educatorId: string;
    educatorName: string;
    totalAmount: number;
    movementIds: string[];
}

const getTariffaForMember = (member: UnifiedMember, tariffe: Tariffa[]): Tariffa | undefined => {
    if (!member.dataNascita || !tariffe) return undefined;
    const birthYear = new Date(member.dataNascita).getFullYear();
    if (isNaN(birthYear)) return undefined;

    for (const tariffa of tariffe.sort((a, b) => a.order - b.order)) {
        const years = tariffa.description.match(/\d{4}/g);
        if (!years) continue;

        if (tariffa.id === 'adulti') {
            if (birthYear < parseInt(years[0], 10)) return tariffa;
        } else if (tariffa.id === 'acr') {
            if (birthYear > parseInt(years[0], 10)) return tariffa;
        } else if (years.length === 2) {
            const startYear = parseInt(years[0], 10);
            const endYear = parseInt(years[1], 10);
            if (birthYear >= startYear && birthYear <= endYear) return tariffa;
        }
    }
    return undefined;
};

const getCurrentMembershipYear = () => {
  const today = new Date();
  const month = today.getMonth(); // 0-11 (September is 8)
  return month >= 8 ? today.getFullYear() : today.getFullYear() - 1;
};


export default function PagamentiContantiPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { userData } = useUserData();
    const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

    const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});


    const cashRaccolteQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'raccolte'), where('accettaContanti', '==', true), where('archived', '==', false));
    }, [firestore]);

    const { data: raccolte, isLoading: isLoadingRaccolte } = useCollection<Raccolta>(cashRaccolteQuery);

    const membersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collectionGroup(firestore, 'membri');
    }, [firestore]);
    const { data: membersData, isLoading: isLoadingMembers } = useCollection<UnifiedMember>(membersQuery, { includeRef: true });

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: usersData, isLoading: isLoadingUsers } = useCollection<UserData & { groupId?: string, groupName?: string }>(usersQuery);
    
    const cashMovementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'movimenti-contanti'), where('tipo', '==', 'raccolta'));
    }, [firestore]);
    const { data: cashMovements, isLoading: isLoadingCashMovements } = useCollection<MovimentoContante>(cashMovementsQuery);

    const pageSettingsQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return collection(firestore, 'page-settings');
    }, [firestore]);
    const { data: pageSettings } = useCollection<any>(pageSettingsQuery);
    
    const accountingRoleUsersQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return query(collection(firestore, 'ruoli-educatori'), where('accessiblePages', 'array-contains', '/contabilita/conto'));
    }, [firestore]);
    const { data: accountingRoles } = useCollection<any>(accountingRoleUsersQuery);

    const tariffeQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'tariffe-tesseramento');
    }, [firestore]);
    const { data: tariffe, isLoading: isLoadingTariffe } = useCollection<Tariffa>(tariffeQuery);

    const allMembers = useMemo(() => {
        if (!membersData && !usersData) return [];
        const combinedList: UnifiedMember[] = [];
        const processedIds = new Set<string>();

        const addToList = (member: UnifiedMember) => {
            if (member.id && !processedIds.has(member.id)) {
                combinedList.push(member);
                processedIds.add(member.id);
            }
        };

        usersData?.forEach(user => {
            addToList({
                id: user.id,
                nome: user.nome || '',
                cognome: user.cognome || '',
                groupId: user.groupId,
                groupName: user.groupName,
                familyId: user.id,
                ...user
            });
        });

        membersData?.forEach(member => {
            const familyId = member.ref?.parent.parent?.id;
            addToList({
                id: member.id,
                nome: member.nome || '',
                cognome: member.cognome || '',
                groupId: member.groupId,
                groupName: member.groupName,
                familyId: familyId,
                ...member
            });
        });
        
        return combinedList;
    }, [usersData, membersData]);

    const cashiers = useMemo(() => {
        if (!usersData || !pageSettings || !accountingRoles) return [];

        const accountingUserIds = new Set<string>();
        
        // Admins
        usersData.forEach(u => {
            if(u.roles.includes('admin')) {
                accountingUserIds.add(u.id);
            }
        });

        // Educators with specific role
        const accountingPageSetting = pageSettings.find(p => p.id === 'contabilita-conto');
        if(accountingPageSetting?.requiresEducatorRoleCheck) {
            accountingRoles?.forEach(role => {
                role.assignedEducators.forEach((id: string) => accountingUserIds.add(id));
            });
        }
        
        return usersData.filter(u => accountingUserIds.has(u.id));

    }, [usersData, pageSettings, accountingRoles]);

    const educatorCashSummary = useMemo((): EducatorCashSummary[] => {
        if (!cashMovements || !usersData) return [];

        const summaryMap = new Map<string, EducatorCashSummary>();

        usersData.forEach(user => {
             summaryMap.set(user.id, {
                educatorId: user.id,
                educatorName: user.displayName,
                totalAmount: 0,
                movementIds: [],
            });
        });

        cashMovements.forEach(mov => {
            if (!mov.isDelivered) {
                const summary = summaryMap.get(mov.registeredBy);
                if(summary) {
                    summary.totalAmount += mov.importo;
                    summary.movementIds.push(mov.id);
                }
            }
        });
        
        return Array.from(summaryMap.values()).filter(s => s.totalAmount > 0);

    }, [cashMovements, usersData]);

    const getTargetGroupMembers = (raccolta: Raccolta) => {
        const targetGroupIds = new Set(raccolta.gruppiId);
        return allMembers
            .filter(member => member.groupId && targetGroupIds.has(member.groupId))
            .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''));
    };
    
    const handleSearchChange = (raccoltaId: string, value: string) => {
        setSearchTerms(prev => ({
            ...prev,
            [raccoltaId]: value,
        }));
    };
    
    const getMemberDocRef = async (memberId: string): Promise<any | null> => {
        if (!firestore || !memberId) return null;
        
        const userDocRef = doc(firestore, 'users', memberId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            return userDocRef;
        }

        const membersSnapshot = await getDocs(collectionGroup(firestore, 'membri'));
        const memberDoc = membersSnapshot.docs.find(doc => doc.id === memberId);

        if (memberDoc) {
            return memberDoc.ref;
        }

        console.error("Could not find document reference for member:", memberId);
        return null;
    };


    const handlePaymentToggle = useCallback(async (raccolta: Raccolta, memberId: string, phase: 'caparra' | 'saldo', shouldPay: boolean, importo: number) => {
        if (!firestore || !userData?.id) return;

        const processingKey = `${raccolta.id}-${phase}-${memberId}`;
        setIsProcessing(prev => ({...prev, [processingKey]: true}));

        const batch = writeBatch(firestore);
        const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);
        const fieldToUpdate = `${phase}PaidIds`;
        
        batch.update(raccoltaDocRef, {
            [fieldToUpdate]: shouldPay ? arrayUnion(memberId) : arrayRemove(memberId)
        });

        if (shouldPay) {
            const movimentoRef = collection(firestore, 'movimenti-contanti');
            batch.set(doc(movimentoRef), {
                raccoltaId: raccolta.id,
                memberId: memberId,
                phase: phase,
                importo: importo,
                createdAt: serverTimestamp(),
                registeredBy: userData.id,
                isDelivered: false,
                isDeposited: false,
                tipo: 'raccolta'
            });
        } else {
            const movimentiRef = collection(firestore, 'movimenti-contanti');
            const q = query(movimentiRef, 
                where("raccoltaId", "==", raccolta.id), 
                where("memberId", "==", memberId), 
                where("phase", "==", phase)
            );
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }

        try {
            await batch.commit();

            // Invio email al capofamiglia in background solo se si segna come pagato
            if (shouldPay) {
                const member = allMembers.find(m => m.id === memberId);
                const familyHeadId = member?.familyId || memberId;
                const memberName = member ? `${member.nome} ${member.cognome}` : memberId;
                const phaseLabel = phase === 'caparra' ? 'Caparra' : 'Saldo';

                fetch('/api/send-payment-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        familyHeadId,
                        paymentItems: [{
                            memberName,
                            raccoltaNome: raccolta.nome,
                            phase: phaseLabel,
                            amount: String(importo),
                        }],
                        paymentMethod: 'contanti',
                    }),
                }).catch(e => console.warn('Errore invio email pagamento:', e));

                triggerNotification({
                    eventType: 'pagamento_ricevuto',
                    title: `Nuovo Incasso in Contanti (${userData.displayName})`,
                    body: `Registrato pagamento in contanti per ${raccolta.nome} (Membro: ${memberName}, Fase: ${phaseLabel}, Importo: €${importo.toFixed(2)})`,
                    href: '/contabilita/contanti-depositi',
                    userId: '__admin_broadcast__'
                });
            }
        } catch (error) {
            console.error(`Error updating ${phase} payment:`, error);
        } finally {
            setIsProcessing(prev => ({...prev, [processingKey]: false}));
        }
    }, [firestore, userData, allMembers]);

    const handleDeliver = async (summary: EducatorCashSummary, cashierId: string) => {
        if(!firestore) return;
        const key = `${summary.educatorId}-deliver`;
        setIsProcessing(prev => ({ ...prev, [key]: true }));
        
        const batch = writeBatch(firestore);
        summary.movementIds.forEach(movId => {
            const movRef = doc(firestore, 'movimenti-contanti', movId);
            batch.update(movRef, { isDelivered: true, deliveredTo: cashierId });
        });
        
        try {
            await batch.commit();
        } catch (error) {
            console.error(`Error delivering cash for ${summary.educatorName}:`, error);
        } finally {
            setIsProcessing(prev => ({ ...prev, [key]: false }));
        }
    };

    const getFamilyMemberCountForRaccolta = (raccolta: Raccolta) => {
        const counts: Record<string, number> = {};
        if (!raccolta.confermatiIds) return counts;

        allMembers.forEach(member => {
            if (member.familyId && raccolta.confermatiIds.includes(member.id)) {
                counts[member.familyId] = (counts[member.familyId] || 0) + 1;
            }
        });
        return counts;
    };
    
    const isLoading = isLoadingRaccolte || isLoadingMembers || isLoadingUsers || isLoadingCashMovements || isLoadingTariffe;

    if (isLoading) {
        return <p>Caricamento...</p>;
    }

    return (
        <div className='space-y-8 pb-32'>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Gestione Pagamenti in Contanti</h2>
                    <p className="text-muted-foreground">Registra manually i pagamenti in contanti e gestisci i rimborsi spese.</p>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Riepilogo Contanti da Consegnare</CardTitle>
                    <CardDescription>Elenco dei contanti raccolti dagli educatori e non ancora consegnati.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome Educatore</TableHead>
                                <TableHead className="text-right">Quantità Raccolta</TableHead>
                                <TableHead className="text-right">Azione</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {educatorCashSummary.length > 0 ? (
                                educatorCashSummary.map(summary => {
                                    const isDelivering = isProcessing[`${summary.educatorId}-deliver`];

                                    return (
                                        <TableRow key={summary.educatorId}>
                                            <TableCell>{summary.educatorName}</TableCell>
                                            <TableCell className="text-right font-bold">€{summary.totalAmount.toFixed(2)}</TableCell>
                                             <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button disabled={isDelivering}>
                                                            {isDelivering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                            Consegna a...
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuLabel>Seleziona Cassiere</DropdownMenuLabel>
                                                        {cashiers.map(cashier => (
                                                            <DropdownMenuItem key={cashier.id} onSelect={() => handleDeliver(summary, cashier.id)}>
                                                                {cashier.displayName}
                                                            </DropdownMenuItem>
                                                        ))}
                                                        {cashiers.length === 0 && <DropdownMenuItem disabled>Nessun cassiere trovato</DropdownMenuItem>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                             </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">Nessun contante da consegnare.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

             {!raccolte || raccolte.length === 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Nessuna Raccolta Abilitata</CardTitle>
                        <CardDescription>
                           Non ci sono raccolte fondi attive che accettano pagamenti in contanti.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12 text-muted-foreground">
                            <p>Per registrare pagamenti, prima abilita l'opzione "Accetta Contanti" in una raccolta fondi.</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Accordion type="multiple" className="space-y-4">
                    {raccolte.map(raccolta => {
                        const targetMembers = getTargetGroupMembers(raccolta);
                        const familyCounts = getFamilyMemberCountForRaccolta(raccolta);
                        
                        const searchTerm = searchTerms[raccolta.id] || '';
                        const filteredMembers = searchTerm
                            ? targetMembers.filter(member => 
                                `${member.nome} ${member.cognome}`.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            : targetMembers;

                        return (
                            <AccordionItem value={raccolta.id} key={raccolta.id} className="border rounded-lg bg-card text-card-foreground shadow-sm">
                                <AccordionTrigger className="p-6 hover:no-underline [&[data-state=open]>svg]:rotate-0">
                                     <div className="flex flex-row items-center justify-between w-full">
                                        <div className='space-y-1 text-left'>
                                            <h3 className="text-2xl font-semibold leading-none tracking-tight">{raccolta.nome}</h3>
                                            <p className="text-sm text-muted-foreground">{targetMembers.length} membri coinvolti</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-6 pt-4">
                                    <div className="space-y-4">
                                        <Input 
                                            placeholder="Cerca membro per nome..."
                                            value={searchTerm}
                                            onChange={(e) => handleSearchChange(raccolta.id, e.target.value)}
                                            className="max-w-sm"
                                        />
                                        {raccolta.tipo === 'tesseramento' ? (
                                            (() => {
                                                const allMembersSorted = [...targetMembers].sort((a, b) => {
                                                    if (a.familyId !== b.familyId) {
                                                        return (a.familyId || '').localeCompare(b.familyId || '');
                                                    }
                                                    return new Date(b.dataNascita!).getTime() - new Date(a.dataNascita!).getTime();
                                                });
                                                const membersByFamilyForFee = allMembersSorted.reduce((acc, member) => {
                                                    const familyId = member.familyId || member.id;
                                                    if (!acc[familyId]) {
                                                        acc[familyId] = [];
                                                    }
                                                    acc[familyId].push(member);
                                                    return acc;
                                                }, {} as Record<string, UnifiedMember[]>);

                                                const membersWithFeesFinal = allMembersSorted.map(member => {
                                                    const familyId = member.familyId || member.id;
                                                    const familyMembers = membersByFamilyForFee[familyId];
                                                    const numMembers = familyMembers.length;
                                                    const memberIndexInFamily = familyMembers.findIndex(m => m.id === member.id);
                                                    const tariffa = getTariffaForMember(member, tariffe || []);
                                                    if (!tariffa) return { ...member, fee: 0 };
                                                    let fee: number;
                                                    if (numMembers <= 1) { fee = tariffa.quotaIntera; }
                                                    else if (numMembers <= 3) { fee = tariffa.quotaScontata; }
                                                    else { if (memberIndexInFamily >= 3) { fee = tariffa.gratuita; } else { fee = tariffa.quotaScontata; } }
                                                    
                                                    if (typeof fee !== 'number') {
                                                        fee = 0;
                                                    }

                                                    return { ...member, fee };
                                                }).filter(m => filteredMembers.some(fm => fm.id === m.id));


                                                const handleTesseramentoPaymentToggle = async (memberId: string, shouldPay: boolean, fee: number) => {
                                                    if (!firestore || !userData?.id) return;
                                                    
                                                    const memberDocRef = await getMemberDocRef(memberId);
                                                    if(!memberDocRef) {
                                                        console.error("Could not find member document to update tesseramento status");
                                                        return;
                                                    }
                                                    
                                                    const processingKey = `${raccolta.id}-tesseramento-${memberId}`;
                                                    setIsProcessing(prev => ({ ...prev, [processingKey]: true }));
                                                    const batch = writeBatch(firestore);
                                                    const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);
                                                    batch.update(raccoltaDocRef, { tesseratiIds: shouldPay ? arrayUnion(memberId) : arrayRemove(memberId) });
                                                    
                                                    const currentMembershipYear = getCurrentMembershipYear();

                                                    if (shouldPay) {
                                                        const movimentoRef = collection(firestore, 'movimenti-contanti');
                                                        batch.set(doc(movimentoRef), { raccoltaId: raccolta.id, memberId: memberId, phase: 'tesseramento', importo: fee, createdAt: serverTimestamp(), registeredBy: userData.id, isDelivered: false, isDeposited: false, tipo: 'raccolta' });
                                                        batch.update(memberDocRef, { tesseramento: currentMembershipYear });
                                                    } else {
                                                        const movimentiRef = collection(firestore, 'movimenti-contanti');
                                                        const q = query(movimentiRef, where("raccoltaId", "==", raccolta.id), where("memberId", "==", memberId), where("phase", "==", 'tesseramento'));
                                                        const querySnapshot = await getDocs(q);
                                                        querySnapshot.forEach(doc => { batch.delete(doc.ref); });
                                                        batch.update(memberDocRef, { tesseramento: deleteField() });
                                                    }
                                                    try {
                                                        await batch.commit();
                                                        // Invio email al capofamiglia in background solo se si segna come pagato
                                                        if (shouldPay) {
                                                            const member = allMembers.find(m => m.id === memberId);
                                                            const familyHeadId = member?.familyId || memberId;
                                                            const memberName = member ? `${member.nome} ${member.cognome}` : memberId;
                                                            fetch('/api/send-payment-email', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    familyHeadId,
                                                                    paymentItems: [{
                                                                        memberName,
                                                                        raccoltaNome: raccolta.nome,
                                                                        phase: 'Tesseramento',
                                                                        amount: String(fee),
                                                                    }],
                                                                    paymentMethod: 'contanti',
                                                                }),
                                                            }).catch(e => console.warn('Errore invio email pagamento:', e));

                                                            triggerNotification({
                                                                eventType: 'pagamento_ricevuto',
                                                                title: `Nuovo Incasso Tesseramento (${userData.displayName})`,
                                                                body: `Registrato pagamento tesseramento per ${raccolta.nome} (Membro: ${memberName}, Importo: €${fee.toFixed(2)})`,
                                                                href: '/contabilita/contanti-depositi',
                                                                userId: '__admin_broadcast__'
                                                            });
                                                        }
                                                    }
                                                    catch (error) { console.error(`Error updating tesseramento payment:`, error); }
                                                    finally { setIsProcessing(prev => ({ ...prev, [processingKey]: false })); }
                                                };

                                                return (
                                                    <Table>
                                                        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Gruppo</TableHead><TableHead>Quota Tesseramento</TableHead></TableRow></TableHeader>
                                                        <TableBody>
                                                            {membersWithFeesFinal.map(member => {
                                                                const isPaid = raccolta.tesseratiIds?.includes(member.id);
                                                                const isProcessingTesseramento = isProcessing[`${raccolta.id}-tesseramento-${member.id}`];
                                                                return (
                                                                    <TableRow key={member.id}>
                                                                        <TableCell>{member.nome} {member.cognome}</TableCell>
                                                                        <TableCell>{member.groupName}</TableCell>
                                                                        <TableCell>
                                                                            {isPaid ? (
                                                                                <div className="flex items-center gap-2 text-green-600 font-medium">
                                                                                    <CheckCircle2 className="h-5 w-5" /> €{(member.fee || 0).toFixed(2)}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Checkbox checked={isPaid} onCheckedChange={(checked) => handleTesseramentoPaymentToggle(member.id, !!checked, member.fee)} disabled={isProcessingTesseramento} />
                                                                                    <span>€{(member.fee || 0).toFixed(2)}</span>
                                                                                </div>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                );
                                            })()
                                        ) : (
                                             <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Nome</TableHead>
                                                        <TableHead>Gruppo</TableHead>
                                                        <TableHead>Importo Pagato</TableHead>
                                                        {raccolta.faseCaparra.attiva && <TableHead>Caparra</TableHead>}
                                                        {raccolta.faseSaldo.attiva && <TableHead>Saldo</TableHead>}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredMembers.length > 0 ? (
                                                        filteredMembers.map(member => {
                                                            const isConfirmed = raccolta.confermatiIds?.includes(member.id);
                                                            const isCaparraPaid = raccolta.caparraPaidIds?.includes(member.id);
                                                            const isSaldoPaid = raccolta.saldoPaidIds?.includes(member.id);
                                                            
                                                            const caparraImporto = parseFloat(raccolta.faseCaparra.importo) || 0;
                                                            let saldoImporto = parseFloat(raccolta.faseSaldo.importo) || 0;
                                                            if (raccolta.faseSaldo.tariffaFratelliAttiva && member.familyId && (familyCounts[member.familyId] || 0) >= 2) {
                                                                saldoImporto = parseFloat(raccolta.faseSaldo.importoTariffaFratelli || '0') || saldoImporto;
                                                            }
                                                            
                                                            const isProcessingCaparra = isProcessing[`${raccolta.id}-caparra-${member.id}`];
                                                            const isProcessingSaldo = isProcessing[`${raccolta.id}-saldo-${member.id}`];

                                                            let paidAmount = 0;
                                                            if(isCaparraPaid) paidAmount += caparraImporto;
                                                            if(isSaldoPaid) paidAmount += saldoImporto;

                                                            return (
                                                                <TableRow key={member.id}>
                                                                    <TableCell>{member.nome} {member.cognome}</TableCell>
                                                                    <TableCell>{member.groupName}</TableCell>
                                                                    <TableCell className="font-medium">
                                                                        €{paidAmount.toFixed(2)}
                                                                    </TableCell>
                                                                    {raccolta.faseCaparra.attiva && (
                                                                        <TableCell>
                                                                            {isCaparraPaid ? (
                                                                                <div className="flex items-center gap-2 text-green-600 font-medium">
                                                                                    <CheckCircle2 className="h-5 w-5" /> €{caparraImporto.toFixed(2)}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Checkbox
                                                                                        checked={isCaparraPaid}
                                                                                        onCheckedChange={(checked) => handlePaymentToggle(raccolta, member.id, 'caparra', !!checked, caparraImporto)}
                                                                                        disabled={!isConfirmed || isProcessingCaparra}
                                                                                    />
                                                                                    <span>€{caparraImporto.toFixed(2)}</span>
                                                                                </div>
                                                                            )}
                                                                        </TableCell>
                                                                    )}
                                                                    {raccolta.faseSaldo.attiva && (
                                                                        <TableCell>
                                                                            {isSaldoPaid ? (
                                                                                <div className="flex items-center gap-2 text-green-600 font-medium">
                                                                                    <CheckCircle2 className="h-5 w-5" /> €{saldoImporto.toFixed(2)}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Checkbox
                                                                                        checked={isSaldoPaid}
                                                                                        onCheckedChange={(checked) => handlePaymentToggle(raccolta, member.id, 'saldo', !!checked, saldoImporto)}
                                                                                        disabled={!isConfirmed || isProcessingSaldo}
                                                                                    />
                                                                                    <span>€{saldoImporto.toFixed(2)}</span>
                                                                                </div>
                                                                            )}
                                                                        </TableCell>
                                                                    )}
                                                                </TableRow>
                                                            )
                                                        })
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="h-24 text-center">
                                                                {searchTerm ? "Nessun membro trovato per la ricerca." : "Nessun membro nei gruppi target per questa raccolta."}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            )}
        </div>
    )
}
