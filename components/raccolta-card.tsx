'use client';

import { useMemo } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FaseRaccolta } from '@/components/nuova-raccolta-dialog';
import { MoreVertical, CheckCircle2, XCircle, Archive, Pencil, ArchiveRestore } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { doc, updateDoc, collection, collectionGroup, query, where } from 'firebase/firestore';
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
    },
    payments?: { [paymentId: string]: PaymentDetails };
}

interface RaccoltaCardProps {
    raccolta: Raccolta;
    onEdit: () => void;
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

export function RaccoltaCard({ raccolta, onEdit }: RaccoltaCardProps) {
    const firestore = useFirestore();

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
        
        return combinedList;

    }, [usersData, membersData]);

    const targetGroupMembers = useMemo(() => {
        const targetGroupIds = new Set(raccolta.gruppiId);
        return allMembers
            .filter(member => member.groupId && targetGroupIds.has(member.groupId))
            .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''));
    }, [allMembers, raccolta.gruppiId]);


    const isLoading = isLoadingMembers || isLoadingUsers || isLoadingMovimentiContanti;

    const calculateTotals = (faseKey: 'faseConferma' | 'faseCaparra' | 'faseSaldo') => {
        let denominator = 0;
        let numerator = 0;
        let incasso = 0;

        const importo = parseFloat(raccolta[faseKey].importo) || 0;
        const importoFratelli = parseFloat(raccolta.faseSaldo.importoTariffaFratelli || '0') || importo;

        switch(faseKey) {
            case 'faseConferma':
                denominator = targetGroupMembers.length;
                numerator = raccolta.confermatiIds?.filter(id => targetGroupMembers.some(m => m.id === id)).length || 0;
                incasso = (parseFloat(raccolta.faseConferma.importo) || 0) * numerator;
                break;
            case 'faseCaparra':
                denominator = raccolta.confermatiIds?.filter(id => targetGroupMembers.some(m => m.id === id)).length || 0;
                numerator = raccolta.caparraPaidIds?.filter(id => targetGroupMembers.some(m => m.id === id)).length || 0;
                incasso = importo * numerator;
                break;
            case 'faseSaldo':
                const confirmedInGroups = raccolta.confermatiIds?.filter(id => targetGroupMembers.some(m => m.id === id)) || [];
                denominator = confirmedInGroups.length;
                
                const paidIdsInGroups = raccolta.saldoPaidIds?.filter(id => targetGroupMembers.some(m => m.id === id)) || [];
                numerator = paidIdsInGroups.length;

                // Sibling discount logic for income calculation
                const confirmedMembersData = allMembers.filter(m => confirmedInGroups.includes(m.id));
                const familyCounts = confirmedMembersData.reduce((acc, member) => {
                    if (member.familyId) {
                        acc[member.familyId] = (acc[member.familyId] || 0) + 1;
                    }
                    return acc;
                }, {} as Record<string, number>);

                incasso = paidIdsInGroups.reduce((total, memberId) => {
                    const member = allMembers.find(m => m.id === memberId);
                    if (member?.familyId && (familyCounts[member.familyId] || 0) >= 2 && raccolta.faseSaldo.tariffaFratelliAttiva) {
                        return total + importoFratelli;
                    }
                    return total + importo;
                }, 0);

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
            await updateDoc(raccoltaDocRef, { archived: newArchivedStatus });
        } catch (error) {
             console.error("Errore during l'aggiornamento dell'archivio:", error);
             alert(`Si è verificato un errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
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
                    />
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}
