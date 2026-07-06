'use client';

import { useMemo, useState } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { FaseRaccolta } from '@/components/nuova-raccolta-dialog';
import { MoreVertical, CheckCircle2, XCircle, Archive, Pencil, ArchiveRestore, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { doc, updateDoc, collection, collectionGroup, query, where, arrayUnion, arrayRemove, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import { useUserData } from '@/src/hooks/use-user-data';
import { MembriRaccoltaList, type UnifiedMember } from '@/components/membri-raccolta-list';
import type { UserData } from '@/src/hooks/use-user-data';
import type { MovimentoContante } from '@/app/(app)/contabilita/pagamenti-contanti/page';


export interface Partecipante {
    memberId: string;
    confirmedAt?: any;
    receiptCaparraUrl?: string;
    paidCaparraAt?: any;
    receiptSaldoUrl?: string;
    paidSaldoAt?: any;
}

export interface PaymentDetails {
    paymentId: string;
    receiptUrl: string;
    timestamp: any;
    analysisData: any; // The full extracted data from AI
    originalAnalysisData?: any; // The original data if it was edited
    isVerified?: boolean; // Final verification flag
}

export interface TariffaPersonalizzata {
    groupId: string;
    importoConferma?: string; // undefined = usa il default della fase
    importoCaparra?: string;
    importoSaldo?: string;
}

export interface Raccolta {
    id: string;
    nome: string;
    tipo?: 'standard' | 'tesseramento';
    gruppiId: string[];
    accettaBonifico?: boolean;
    accettaContanti?: boolean;
    iban?: string;
    beneficiario?: string;
    faseConferma: FaseRaccolta;
    faseCaparra: FaseRaccolta;
    faseSaldo: FaseRaccolta;
    createdAt: any;
    archived: boolean;
    confermatiIds?: string[];
    caparraPaidIds?: string[];
    saldoPaidIds?: string[];
    tesseratiIds?: string[];
    partecipanti?: Partecipante[];
    paymentDetails?: {
        caparra?: { [memberId: string]: PaymentDetails };
        saldo?: { [memberId: string]: PaymentDetails };
        tesseramento?: { [memberId: string]: PaymentDetails };
    };
    payments?: { [paymentId: string]: PaymentDetails };
    tariffePersonalizzate?: TariffaPersonalizzata[];
}

interface RaccoltaCardProps {
    raccolta: Raccolta;
    onEdit: () => void;
    /** Quando impostato, mostra solo i membri di questo gruppo specifico */
    filterGroupId?: string;
}

const renderStatusIcon = (attiva: boolean) => {
    return attiva ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />;
};


const formatDate = (date: any) => {
    if (!date) return '-';
    let jsDate;
    if (date.toDate) { 
        jsDate = date.toDate();
    } else if (date instanceof Date) { 
        jsDate = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
        jsDate = new Date(date);
    } else {
        return '-';
    }
    
    if (isNaN(jsDate.getTime())) {
        return '-';
    }
    
    return format(jsDate, 'dd/MM/yyyy', { locale: it });
}

export function RaccoltaCard({ raccolta, onEdit, filterGroupId }: RaccoltaCardProps) {
    const firestore = useFirestore();
    const { userData } = useUserData();

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
    
    const movimentiContantiQuery = useMemoFirebase(() => {
        if (!firestore || raccolta.tipo !== 'tesseramento') return null;
        return query(collection(firestore, 'movimenti-contanti'), where('raccoltaId', '==', raccolta.id), where('tipo', '==', 'raccolta'), where('phase', '==', 'tesseramento'));
    }, [firestore, raccolta.id, raccolta.tipo]);
    const { data: movimentiContantiTesseramento, isLoading: isLoadingMovimentiContanti } = useCollection<MovimentoContante>(movimentiContantiQuery);

    const importedMembersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'imported-members');
    }, [firestore]);
    const { data: importedMembersData, isLoading: isLoadingImported } = useCollection<any>(importedMembersQuery);

    const groupsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'gruppi');
    }, [firestore]);
    const { data: groupsData } = useCollection<Group>(groupsQuery);

    // Ruoli educatori dell'utente corrente (per verificare accesso contabilità)
    const myEducatorRolesQuery = useMemoFirebase(() => {
        const uid = userData?.id ?? '';
        if (!firestore || !uid) return null;
        return query(collection(firestore, 'ruoli-educatori'), where('assignedEducators', 'array-contains', uid));
    }, [firestore, userData?.id]);
    const { data: myEducatorRolesData } = useCollection<{ accessiblePages?: string[] }>(myEducatorRolesQuery);


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
                familyId: user.id, // User is their own family head
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

        // Mappa ghostId -> Group ricavata dai memberIds dei gruppi
        const ghostGroupMap = new Map<string, Group>();
        groupsData?.forEach(group => {
            (group.memberIds ?? []).forEach(mid => ghostGroupMap.set(mid, group));
        });

        importedMembersData?.forEach(imported => {
            if (imported.matchedWith) return; // già matchato, non mostrarlo come ghost
            const resolvedGroup = ghostGroupMap.get(imported.id);

            // familyId virtuale basato sull'indirizzo → sconto fratelli per ghost stessa famiglia
            const addressKey = [imported.via, imported.numeroCivico, imported.citta]
                .map((s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ''))
                .filter(Boolean)
                .join('_');
            const virtualFamilyId = addressKey ? `ghost:${addressKey}` : undefined;

            addToList({
                id: imported.id,
                nome: imported.nome || '',
                cognome: imported.cognome || '',
                groupId: resolvedGroup?.id,
                groupName: resolvedGroup?.name || imported.gruppo || '',
                familyId: virtualFamilyId,
                isPlaceholder: true,
                ...imported
            });
        });
        
        return combinedList;

    }, [usersData, membersData, importedMembersData, groupsData]);

    const targetGroupMembers = useMemo(() => {
        const targetGroupIds = new Set(raccolta.gruppiId);
        return allMembers
            .filter(member => {
                if (!member.groupId || !targetGroupIds.has(member.groupId)) return false;
                // Se filterGroupId è impostato, mostra solo i membri di quel gruppo
                if (filterGroupId && member.groupId !== filterGroupId) return false;
                return true;
            })
            .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''));
    }, [allMembers, raccolta.gruppiId, filterGroupId]);


    const isLoading = isLoadingMembers || isLoadingUsers || isLoadingMovimentiContanti;

    // ── Rilevamento educatore e suoi gruppi ──────────────────────────────────
    const isAdmin = userData?.roles?.includes('admin') ?? false;
    const isEducatore = userData?.roles?.includes('educatore') ?? false;
    const currentUserId = userData?.id ?? '';

    // Gruppi in cui l'utente corrente è educatore
    const myEducatorGroupIds = useMemo(() => {
        if (!groupsData || !currentUserId) return new Set<string>();
        return new Set(
            groupsData
                .filter(g => (g.educatorIds ?? []).includes(currentUserId))
                .map(g => g.id)
        );
    }, [groupsData, currentUserId]);

    // Educatore con accesso alla contabilità delle raccolte attive
    const hasAccountingAccess = useMemo(() => {
        if (!myEducatorRolesData) return false;
        return myEducatorRolesData.some(role =>
            (role.accessiblePages ?? []).includes('/contabilita/raccolte')
        );
    }, [myEducatorRolesData]);

    const canManageGhosts = isAdmin || isEducatore;
    // Admin o educatori con accesso contabilità possono gestire TUTTI i partecipanti di TUTTI i gruppi
    const canManageAll = isAdmin || hasAccountingAccess;

    // ── Dialog pagamento ghost ────────────────────────────────────────────────
    type GhostAction = 'conferma' | 'caparra' | 'saldo';
    const [ghostDialog, setGhostDialog] = useState<{
        ghostId: string;
        ghostName: string;
        phase: GhostAction;
        currentValue: boolean; // stato attuale (true = già pagato/confermato)
        amount: number;
        isPlaceholder?: boolean;
    } | null>(null);
    const [isDialogProcessing, setIsDialogProcessing] = useState(false);

    // ── Calcolo importo membro con tariffe personalizzate e sconto fratelli retroattivo ──────
    const calculateMemberPaymentAmount = (memberId: string, phase: 'caparra' | 'saldo'): number => {
        const member = allMembers.find(m => m.id === memberId);
        const faseData = phase === 'caparra' ? raccolta.faseCaparra : raccolta.faseSaldo;

        // Verifica se c'è una tariffa personalizzata per il gruppo del membro
        const customTariff = raccolta.tariffePersonalizzate?.find(t => t.groupId === member?.groupId);
        const customImporto = phase === 'caparra' ? customTariff?.importoCaparra : customTariff?.importoSaldo;
        const hasCustomImporto = customTariff !== undefined && customImporto !== undefined && customImporto !== '';

        const fullPrice = hasCustomImporto
            ? (parseFloat(customImporto!) >= 0 ? parseFloat(customImporto!) : parseFloat(faseData?.importo) || 0)
            : (parseFloat(faseData?.importo) || 0);

        // Con tariffa personalizzata a 0, non applicare sconto fratelli (già 0)
        if (hasCustomImporto && fullPrice === 0) return 0;

        // Se non c'è sconto fratelli attivo o il membro non ha familyId, prezzo pieno
        if (!member?.familyId || !faseData?.tariffaFratelliAttiva) return fullPrice;

        const discountedPrice = parseFloat(faseData.importoTariffaFratelli || '0') || fullPrice;

        // Conta i fratelli dello stesso nucleo familiare già pagati
        const paidIds = new Set(
            phase === 'caparra' ? (raccolta.caparraPaidIds ?? []) : (raccolta.saldoPaidIds ?? [])
        );
        const paidSiblingsCount = allMembers.filter(m =>
            m.isPlaceholder === member.isPlaceholder && m.familyId === member.familyId && m.id !== memberId && paidIds.has(m.id)
        ).length;

        // Formula retroattiva:
        // n=0 (primo a pagare): prezzo pieno
        // n=1 (secondo): (2 × scontato) - pieno
        // n≥2 (terzo+): scontato
        if (paidSiblingsCount === 0) return fullPrice;
        if (paidSiblingsCount === 1) return Math.max(0, 2 * discountedPrice - fullPrice);
        return discountedPrice;
    };
    // Alias retrocompatibile
    const calculateGhostPaymentAmount = calculateMemberPaymentAmount;

    const handleRequestGhostAction = (ghostId: string, ghostName: string, phase: GhostAction, currentValue: boolean, isPlaceholder?: boolean) => {
        const amount = (phase === 'caparra' || phase === 'saldo')
            ? calculateMemberPaymentAmount(ghostId, phase)
            : 0;
        setGhostDialog({ ghostId, ghostName, phase, currentValue, amount, isPlaceholder });
    };

    const handleGhostConfirm = async (ghostId: string, confirm: boolean) => {
        if (!firestore) return;
        const raccoltaRef = doc(firestore, 'raccolte', raccolta.id);
        await updateDoc(raccoltaRef, {
            confermatiIds: confirm ? arrayUnion(ghostId) : arrayRemove(ghostId),
        });
    };

    const handleGhostMarkPaid = async (ghostId: string, phase: 'caparra' | 'saldo', paid: boolean, importoOverride?: number) => {
        if (!firestore) return;
        const raccoltaRef = doc(firestore, 'raccolte', raccolta.id);
        const field = phase === 'caparra' ? 'caparraPaidIds' : 'saldoPaidIds';
        // Usa importo calcolato con sconto fratelli (o quello standard)
        const importo = importoOverride ?? calculateGhostPaymentAmount(ghostId, phase);

        const batch = writeBatch(firestore);

        if (paid) {
            batch.update(raccoltaRef, {
                [field]: arrayUnion(ghostId),
                confermatiIds: arrayUnion(ghostId), // auto-conferma
            });
            // Crea un movimento contanti così appare nel Conto e nel riepilogo contanti da consegnare
            const movRef = doc(collection(firestore, 'movimenti-contanti'));
            batch.set(movRef, {
                raccoltaId: raccolta.id,
                memberId: ghostId,
                phase,
                importo,
                createdAt: serverTimestamp(),
                registeredBy: currentUserId || 'system',
                tipo: 'raccolta',
                isDelivered: false,   // da consegnare al cassiere
                isDeposited: false,
                isGhostPayment: true,
            });
        } else {
            batch.update(raccoltaRef, {
                [field]: arrayRemove(ghostId),
            });
        }

        await batch.commit();

        // Se annullo, elimino anche il movimento contanti associato
        if (!paid) {
            const movSnap = await getDocs(
                query(
                    collection(firestore, 'movimenti-contanti'),
                    where('memberId', '==', ghostId),
                    where('raccoltaId', '==', raccolta.id),
                    where('phase', '==', phase)
                )
            );
            const delBatch = writeBatch(firestore);
            movSnap.forEach(d => delBatch.delete(d.ref));
            await delBatch.commit();
        }
    };

    const handleGhostDialogConfirm = async () => {
        if (!ghostDialog) return;
        setIsDialogProcessing(true);
        try {
            const { ghostId, phase, currentValue, amount } = ghostDialog;
            const newValue = !currentValue;
            if (phase === 'conferma') {
                await handleGhostConfirm(ghostId, newValue);
            } else {
                await handleGhostMarkPaid(ghostId, phase, newValue, newValue ? amount : undefined);
            }
            setGhostDialog(null);
        } finally {
            setIsDialogProcessing(false);
        }
    };

    const calculateTotals = (faseKey: 'faseConferma' | 'faseCaparra' | 'faseSaldo') => {
        let denominator = 0;
        let numerator = 0;
        let incasso = 0;

        const confirmedInGroups = raccolta.confermatiIds?.filter(id => targetGroupMembers.some(m => m.id === id)) || [];
        const confirmedMembersData = allMembers.filter(m => confirmedInGroups.includes(m.id));
        const familyCounts = confirmedMembersData.reduce((acc, member) => {
            if (member.familyId) {
                acc[member.familyId] = (acc[member.familyId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const getMemberPhasePrice = (member: UnifiedMember) => {
            const faseData = raccolta[faseKey];
            const customTariff = raccolta.tariffePersonalizzate?.find(t => t.groupId === member.groupId);

            let customImporto: string | undefined;
            if (faseKey === 'faseConferma') customImporto = customTariff?.importoConferma;
            else if (faseKey === 'faseCaparra') customImporto = customTariff?.importoCaparra;
            else if (faseKey === 'faseSaldo') customImporto = customTariff?.importoSaldo;

            let price = 0;
            if (customImporto !== undefined && customImporto !== '') {
                const v = parseFloat(customImporto);
                price = isNaN(v) || v < 0 ? (parseFloat(faseData?.importo) || 0) : v;
            } else {
                price = parseFloat(faseData?.importo) || 0;
            }

            if (
                faseKey === 'faseSaldo' &&
                !customTariff?.importoSaldo &&
                faseData?.tariffaFratelliAttiva &&
                member.familyId &&
                (familyCounts[member.familyId] || 0) >= 2
            ) {
                price = parseFloat(faseData.importoTariffaFratelli || '0') || price;
            }

            return price;
        };

        switch(faseKey) {
            case 'faseConferma':
                denominator = targetGroupMembers.length;
                const confirmedMembers = targetGroupMembers.filter(m => raccolta.confermatiIds?.includes(m.id));
                numerator = confirmedMembers.length;
                incasso = confirmedMembers.reduce((sum, member) => sum + getMemberPhasePrice(member), 0);
                break;
            case 'faseCaparra':
                denominator = confirmedInGroups.length;
                const paidCaparraMembers = targetGroupMembers.filter(m => raccolta.caparraPaidIds?.includes(m.id));
                numerator = paidCaparraMembers.length;
                incasso = paidCaparraMembers.reduce((sum, member) => sum + getMemberPhasePrice(member), 0);
                break;
            case 'faseSaldo':
                denominator = confirmedInGroups.length;
                const paidSaldoMembers = targetGroupMembers.filter(m => raccolta.saldoPaidIds?.includes(m.id));
                numerator = paidSaldoMembers.length;
                incasso = paidSaldoMembers.reduce((sum, member) => sum + getMemberPhasePrice(member), 0);
                break;
        }
        return { denominator, numerator, incasso };
    };

    const totalIncome = useMemo(() => {
        if (raccolta.tipo === 'tesseramento') {
            const bonificiIncome = Object.values(raccolta.paymentDetails?.tesseramento || {}).reduce((sum, payment) => sum + (payment.analysisData?.importo || 0), 0);
            const contantiIncome = movimentiContantiTesseramento?.reduce((sum, mov) => sum + mov.importo, 0) || 0;
            return bonificiIncome + contantiIncome;
        }
        const conferma = calculateTotals('faseConferma').incasso;
        const caparra = calculateTotals('faseCaparra').incasso;
        const saldo = calculateTotals('faseSaldo').incasso;
        return conferma + caparra + saldo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [raccolta, movimentiContantiTesseramento, allMembers, targetGroupMembers]);


    const handleToggleConclusa = async (faseKey: 'faseConferma' | 'faseCaparra' | 'faseSaldo', newCheckedState: boolean) => {
        if (!firestore) return;

        const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);

        const updatePayload = {
            [`${faseKey}.conclusa`]: newCheckedState,
        };

        try {
            await updateDoc(raccoltaDocRef, updatePayload);
        } catch (error) {
            console.error("Errore durante l'aggiornamento della fase:", error);
        }
    };
    
    const [isArchiving, setIsArchiving] = useState(false);

    const handleToggleArchive = async (archive?: boolean) => {
        if (!firestore) return;

        const newArchivedStatus = typeof archive === 'boolean' ? archive : !raccolta.archived;
        
        // If we are archiving, check if phases are concluded (for standard collections)
        if (newArchivedStatus === true && raccolta.tipo === 'standard') {
            const isAnyFaseActive = 
                (raccolta.faseConferma.attiva && !raccolta.faseConferma.conclusa) ||
                (raccolta.faseCaparra.attiva && !raccolta.faseCaparra.conclusa) ||
                (raccolta.faseSaldo.attiva && !raccolta.faseSaldo.conclusa);

            if (isAnyFaseActive) {
                alert("Non puoi archiviare una raccolta con fasi ancora attive. Concludi tutte le fasi prima di archiviare.");
                return;
            }
        }

        const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);
        
        try {
            if (newArchivedStatus === true) {
                setIsArchiving(true);
                // Call API to Zip and Delete files
                const res = await fetch('/api/contabilita/raccolte/archivia', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ raccoltaId: raccolta.id })
                });
                
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Errore durante l\'archiviazione e generazione ZIP');
                }
                
                alert('Raccolta archiviata e documenti salvati su Drive con successo!');
            } else {
                 await updateDoc(raccoltaDocRef, { archived: false });
            }
        } catch (error) {
             console.error("Errore during l'aggiornamento dell'archivio:", error);
             alert(`Si è verificato un errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
        } finally {
            setIsArchiving(false);
        }
    };


    const renderFaseRow = (fase: FaseRaccolta, nome: string, faseKey: 'faseConferma' | 'faseCaparra' | 'faseSaldo') => {
        if (!fase.attiva) return null;
        
        const { denominator, numerator, incasso } = calculateTotals(faseKey);

        return (
             <TableRow>
                <TableCell className="font-medium">{nome}</TableCell>
                <TableCell className="text-right">€ {fase.importo || '0.00'}</TableCell>
                <TableCell className='text-center'>{renderStatusIcon(fase.attiva)}</TableCell>
                <TableCell className="text-right">
                     <span className="text-sm text-muted-foreground">{numerator}/{denominator}</span>
                </TableCell>
                <TableCell className="text-right">€ {incasso.toFixed(2)}</TableCell>
                <TableCell className="text-right">{formatDate(fase.dataFine)}</TableCell>
                <TableCell className='text-center'>
                    <Switch
                        checked={fase.conclusa}
                        onCheckedChange={(checked) => handleToggleConclusa(faseKey, checked)}
                        disabled={!fase.attiva}
                        className='data-[state=checked]:bg-destructive mx-auto'
                    />
                </TableCell>
            </TableRow>
        )
    };

    return (
        <>
        <AccordionItem value={raccolta.id}>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className='space-y-1'>
                        <CardTitle>{raccolta.nome}</CardTitle>
                        <CardDescription>Creata il: {formatDate(raccolta.createdAt)}</CardDescription>
                    </div>
                     <div className='flex flex-grow justify-end items-center gap-4 px-6'>
                        <span className="font-medium text-muted-foreground">Totale Incasso:</span>
                        <span className="font-semibold text-lg">€ {totalIncome.toFixed(2)}</span>
                    </div>
                     <div className='flex items-center gap-2'>
                        <AccordionTrigger className="p-2 hover:bg-accent rounded-md [&[data-state=open]>svg]:rotate-0" />
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {raccolta.archived ? (
                                    <DropdownMenuItem onSelect={() => handleToggleArchive(false)}>
                                        <ArchiveRestore className="mr-2 h-4 w-4" />
                                        Riattiva
                                    </DropdownMenuItem>
                                ) : (
                                    <>
                                        <DropdownMenuItem onSelect={onEdit}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Modifica
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleToggleArchive(true)} className="text-destructive">
                                            <Archive className="mr-2 h-4 w-4" />
                                            Archivia
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className='p-0'>
                    <Table>
                        <TableHeader>
                            {raccolta.tipo === 'tesseramento' ? (
                                <TableRow>
                                    <TableHead className='text-center'>Attivo</TableHead>
                                    <TableHead className='text-center'>N. Tesserati</TableHead>
                                    <TableHead className="text-right">Incasso</TableHead>
                                    <TableHead className="text-right">Scadenza</TableHead>
                                    <TableHead className='text-center'>Concludi</TableHead>
                                </TableRow>
                            ) : (
                                <TableRow>
                                    <TableHead>Fase</TableHead>
                                    <TableHead className="text-right">Importo</TableHead>
                                    <TableHead className='text-center'>Attivo</TableHead>
                                    <TableHead className='text-right'>N. Iscritti</TableHead>
                                    <TableHead className="text-right">Incasso</TableHead>
                                    <TableHead className="text-right">Scadenza</TableHead>
                                    <TableHead className='text-center'>Concludi</TableHead>
                                </TableRow>
                            )}
                        </TableHeader>
                        <TableBody>
                           {raccolta.tipo === 'tesseramento' ? (
                                <TableRow>
                                    <TableCell className='text-center'>{renderStatusIcon(true)}</TableCell>
                                    <TableCell className='text-center'>{raccolta.tesseratiIds?.length || 0}</TableCell>
                                    <TableCell className="text-right">€ {totalIncome.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">-</TableCell>
                                    <TableCell className='text-center'>
                                        <Switch
                                            checked={raccolta.archived}
                                            onCheckedChange={handleToggleArchive}
                                            className='data-[state=checked]:bg-destructive mx-auto'
                                        />
                                    </TableCell>
                                </TableRow>
                           ) : (
                                <>
                                    {renderFaseRow(raccolta.faseConferma, 'Conferma', 'faseConferma')}
                                    {renderFaseRow(raccolta.faseCaparra, 'Caparra', 'faseCaparra')}
                                    {renderFaseRow(raccolta.faseSaldo, 'Saldo', 'faseSaldo')}
                                </>
                           )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <AccordionContent>
                <div className="p-4 border-t">
                    <MembriRaccoltaList 
                        raccolta={raccolta} 
                        targetGroupMembers={targetGroupMembers}
                        allMembers={allMembers}
                        isLoading={isLoading}
                        canManageGhosts={canManageGhosts}
                        canManageAll={canManageAll}
                        myEducatorGroupIds={myEducatorGroupIds}
                        onRequestGhostAction={handleRequestGhostAction}
                        getGhostAmount={calculateMemberPaymentAmount}
                    />
                </div>
            </AccordionContent>
        </AccordionItem>

        {/* ── Dialog conferma azione ghost ─────────────────────────────────── */}
        <Dialog open={!!ghostDialog} onOpenChange={(open) => { if (!open) setGhostDialog(null); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {ghostDialog?.currentValue
                            ? ghostDialog?.phase === 'conferma' ? 'Annulla conferma' : 'Annulla pagamento'
                            : ghostDialog?.phase === 'conferma' ? 'Conferma partecipazione' : 'Dichiara pagamento contanti'}
                    </DialogTitle>
                    <DialogDescription>
                        {ghostDialog?.currentValue
                            ? 'Vuoi rimuovere questo stato per il membro selezionato?'
                            : ghostDialog?.phase === 'conferma'
                                ? 'Conferma la partecipazione del membro al progetto.'
                                : 'Il pagamento verrà registrato come incasso in contanti e apparirà nel Conto.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/40">
                        <div>
                            <p className="font-semibold">{ghostDialog?.ghostName}</p>
                            <div className="flex items-center gap-2 mt-1">
                                {ghostDialog?.isPlaceholder ? (
                                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 text-[10px] px-1.5 h-4">
                                        Ghost
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 text-[10px] px-1.5 h-4">
                                        Iscritto
                                    </Badge>
                                )}
                                <span className="text-xs text-muted-foreground capitalize">
                                    Fase: {ghostDialog?.phase}
                                </span>
                            </div>
                        </div>
                    </div>

                    {(ghostDialog?.phase === 'caparra' || ghostDialog?.phase === 'saldo') && ghostDialog?.amount > 0 && (
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <span className="text-sm text-muted-foreground">Importo</span>
                            <span className="font-bold text-lg">€{ghostDialog.amount.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setGhostDialog(null)} disabled={isDialogProcessing}>
                        Annulla
                    </Button>
                    <Button
                        onClick={handleGhostDialogConfirm}
                        disabled={isDialogProcessing}
                        variant={ghostDialog?.currentValue ? 'destructive' : 'default'}
                        className={!ghostDialog?.currentValue ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                        {isDialogProcessing ? 'Salvataggio...' : ghostDialog?.currentValue
                            ? 'Rimuovi'
                            : ghostDialog?.phase === 'conferma' ? 'Conferma partecipazione' : <><Banknote className="h-4 w-4 mr-1" />Conferma incasso €{ghostDialog?.amount.toFixed(2)}</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
