'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from '@/components/ui/table';
import type { Raccolta } from './raccolta-card';
import type { UnifiedMember } from '@/app/(app)/iscrizioni/page';
import { CheckCircle2, Hourglass, XCircle, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/src/firebase';
import { doc, writeBatch, arrayRemove, arrayUnion, updateDoc, deleteField } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import type { Tariffa } from '@/app/(app)/tesserati/tariffe/page';


export interface PaymentSelection {
    totalDue: number;
    membersToPay: UnifiedMember[];
    itemsToPay: { memberId: string; memberName: string; phase: string; amount: string }[];
}

interface IscrizioneFamigliaCardProps {
    raccolta: Raccolta;
    familyMembers: UnifiedMember[];
    tariffe?: Tariffa[] | null;
    onSelectionChange: (raccoltaId: string, selection: PaymentSelection) => void;
}

type PaymentPhase = 'caparra' | 'saldo';

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

export function IscrizioneFamigliaCard({ raccolta, familyMembers, onSelectionChange, tariffe }: IscrizioneFamigliaCardProps) {
    const firestore = useFirestore();
    const isFromForm = !!(raccolta as any).fromFormId;
    const relevantMembers = useMemo(() => {
        let members: UnifiedMember[];
        // Raccolta da modulo: mostra chi è nei confermatiIds anche senza gruppo
        if (isFromForm) {
            members = familyMembers.filter(member =>
                (member.groupId && raccolta.gruppiId.includes(member.groupId)) ||
                raccolta.confermatiIds?.includes(member.id)
            );
        } else {
            members = familyMembers.filter(member => member.groupId && raccolta.gruppiId.includes(member.groupId));
        }
        // Deduplica per ID (evita righe doppie se l'utente compare sia come userData sia come membro)
        const seen = new Set<string>();
        return members.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });
    }, [familyMembers, raccolta.gruppiId, raccolta.confermatiIds, isFromForm]);

    const [selectedStandardMembers, setSelectedStandardMembers] = useState<Record<string, Set<PaymentPhase>>>(
        () => Object.fromEntries(relevantMembers.map(m => [m.id, new Set<PaymentPhase>()]))
    );
    const [selectedTesserati, setSelectedTesserati] = useState<Set<string>>(new Set());
    
    const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
    
    const handleConfirmationToggle = useCallback(async (memberId: string, shouldConfirm: boolean) => {
        if (!firestore) return;
        setIsProcessing(prev => ({...prev, [memberId]: true}));

        const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);

        try {
            const updatePayload: { [key: string]: any } = {};

            if (shouldConfirm) {
                updatePayload.confermatiIds = arrayUnion(memberId);
            } else {
                updatePayload.confermatiIds = arrayRemove(memberId);
                 setSelectedStandardMembers(prev => {
                    const newSelection = { ...prev };
                    const memberPhases = new Set(newSelection[memberId]);
                    memberPhases.delete('caparra');
                    memberPhases.delete('saldo');
                    newSelection[memberId] = memberPhases;
                    return newSelection;
                });
            }
            await updateDoc(raccoltaDocRef, updatePayload);

        } catch (error) {
            console.error("Errore durante l'aggiornamento della conferma:", error);
        } finally {
            setIsProcessing(prev => ({...prev, [memberId]: false}));
        }
    }, [firestore, raccolta.id]);

    // Standard Raccolta: Toggle selection for caparra/saldo
    const toggleStandardSelection = (memberId: string, phase: PaymentPhase) => {
        setSelectedStandardMembers(prev => {
            const newSelection = { ...prev };
            const memberPhases = new Set(newSelection[memberId]);
            if (memberPhases.has(phase)) {
                memberPhases.delete(phase);
            } else {
                memberPhases.add(phase);
            }
            newSelection[memberId] = memberPhases;
            return newSelection;
        });
    };

    // Tesseramento: Toggle selection for a member
    const toggleTesseratoSelection = (memberId: string) => {
        setSelectedTesserati(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(memberId)) {
                newSelection.delete(memberId);
            } else {
                newSelection.add(memberId);
            }
            return newSelection;
        });
    };

    // Standard Raccolta: Memoized calculation
    const familyMemberCount = useMemo(() => {
        const confirmedIds = new Set(raccolta.confermatiIds || []);
        return familyMembers.filter(m => confirmedIds.has(m.id)).length;
    }, [familyMembers, raccolta.confermatiIds]);

    const calculateStandardMemberPayments = useCallback((memberId: string) => {
        const member = familyMembers.find(m => m.id === memberId);
        if (!member) return { caparra: 0, saldo: 0, totale: 0 };
        
        let caparra = 0;
        let saldo = 0;
        const selections = selectedStandardMembers[memberId] || new Set();
        
        const baseCaparra = parseFloat(raccolta.faseCaparra.importo) || 0;
        const baseSaldo = parseFloat(raccolta.faseSaldo.importo) || 0;
        const scontoFratelliAttivo = raccolta.faseSaldo.tariffaFratelliAttiva && familyMemberCount >= 2;
        const importoSaldoFratelli = parseFloat(raccolta.faseSaldo.importoTariffaFratelli || '0') || baseSaldo;
        // Usa l'importo personalizzato del form se disponibile
        const customSaldo = (raccolta as any).formCustomAmounts?.[memberId] as number | undefined;

        if (selections.has('caparra') && raccolta.faseCaparra.attiva && !raccolta.faseCaparra.conclusa && !raccolta.caparraPaidIds?.includes(memberId)) {
            caparra = baseCaparra;
        }

        if (selections.has('saldo') && raccolta.faseSaldo.attiva && !raccolta.faseSaldo.conclusa && !raccolta.saldoPaidIds?.includes(memberId)) {
            saldo = customSaldo ?? (scontoFratelliAttivo ? importoSaldoFratelli : baseSaldo);
        }
        
        return { caparra, saldo, totale: caparra + saldo };
    }, [familyMembers, selectedStandardMembers, raccolta, familyMemberCount]);

    // Combined selection result logic
    const selectionResult = useMemo((): PaymentSelection => {
        let total = 0;
        const membersMap: Record<string, UnifiedMember> = {};
        const items: { memberId: string, memberName: string, phase: string, amount: string }[] = [];

        if (raccolta.tipo === 'tesseramento') {
            const selectedArray = Array.from(selectedTesserati);
            const membersToConsider = relevantMembers
                .filter(m => selectedArray.includes(m.id) && m.dataNascita)
                .sort((a, b) => new Date(b.dataNascita!).getTime() - new Date(a.dataNascita!).getTime()); // oldest first
            
            const numMembers = membersToConsider.length;

            relevantMembers.forEach(member => {
                if (!selectedTesserati.has(member.id)) return;

                const tariffa = getTariffaForMember(member, tariffe || []);
                if (!tariffa) return;
                
                let fee: number;

                if (numMembers <= 1) {
                    fee = tariffa.quotaIntera;
                } else if (numMembers <= 3) {
                    fee = tariffa.quotaScontata;
                } else { // numMembers >= 4
                    const memberIndex = membersToConsider.findIndex(m => m.id === member.id);
                    if (memberIndex !== -1 && memberIndex >= 3) { 
                        fee = tariffa.gratuita;
                    } else {
                        fee = tariffa.quotaScontata;
                    }
                }

                if (typeof fee !== 'number') {
                    fee = 0;
                }
                
                total += fee;
                membersMap[member.id] = member;
                items.push({ memberId: member.id, memberName: `${member.nome} ${member.cognome}`, phase: 'Tesseramento', amount: (fee || 0).toFixed(2) });
            });
        } else { // Standard raccolta
            Object.entries(selectedStandardMembers).forEach(([memberId, selectedPhases]) => {
                if (selectedPhases.size === 0) return;
                const member = relevantMembers.find(m => m.id === memberId)!;
                const { caparra, saldo, totale } = calculateStandardMemberPayments(memberId);

                total += totale;
                if (totale > 0) membersMap[memberId] = member;
                if (caparra > 0) items.push({ memberId: member.id, memberName: `${member.nome} ${member.cognome}`, phase: 'Caparra', amount: caparra.toFixed(2) });
                if (saldo > 0) items.push({ memberId: member.id, memberName: `${member.nome} ${member.cognome}`, phase: 'Saldo', amount: saldo.toFixed(2) });
            });
        }
        
        return { totalDue: total, membersToPay: Object.values(membersMap), itemsToPay: items };
    }, [selectedStandardMembers, selectedTesserati, relevantMembers, familyMemberCount, raccolta, tariffe, calculateStandardMemberPayments]);

    useEffect(() => {
        onSelectionChange(raccolta.id, selectionResult);
    }, [raccolta.id, selectionResult, onSelectionChange]);

    const renderStandardCard = () => {
        const totalCaparraSelezionata = relevantMembers.reduce((sum, member) => sum + calculateStandardMemberPayments(member.id).caparra, 0);
        const totalSaldoSelezionato = relevantMembers.reduce((sum, member) => sum + calculateStandardMemberPayments(member.id).saldo, 0);

        const renderConfirmationCell = (member: UnifiedMember) => {
            const isConfirmed = !!raccolta.confermatiIds?.includes(member.id);
            const isConcluded = raccolta.faseConferma.conclusa;
            return (
                <TableCell className={cn("text-left", isConcluded && 'opacity-50')}>
                     <div className='flex items-center justify-start gap-2 h-full'>
                        <Checkbox id={`confirm-${member.id}`} checked={isConfirmed} onCheckedChange={(checked) => handleConfirmationToggle(member.id, !!checked)} disabled={isProcessing[member.id] || isConcluded} aria-label={`Conferma iscrizione per ${member.nome}`} />
                        <Label htmlFor={`confirm-${member.id}`} className={cn("text-sm", isConcluded && "cursor-not-allowed")}>{isConfirmed ? 'Confermato' : 'Non confermato'}</Label>
                    </div>
                </TableCell>
            );
        };

        const renderPaymentCell = (member: UnifiedMember, phase: 'caparra' | 'saldo') => {
            const faseKey = `fase${phase.charAt(0).toUpperCase() + phase.slice(1)}` as 'faseCaparra' | 'faseSaldo';
            if (!raccolta[faseKey].attiva) return <TableCell className="w-[150px]"/>;
            
            const isCashOnly = raccolta.accettaContanti === true && raccolta.accettaBonifico !== true;
            const isConcluded = raccolta[faseKey].conclusa;
            const isConfirmed = !!raccolta.confermatiIds?.includes(member.id);
            const paidIdsKey = `${phase}PaidIds` as 'caparraPaidIds' | 'saldoPaidIds';
            const isPaid = !!raccolta[paidIdsKey]?.includes(member.id);
            const isSelectable = isConfirmed && !isPaid && !isConcluded && !isCashOnly;
            const isSelected = selectedStandardMembers[member.id]?.has(phase);
            
            const baseCaparra = parseFloat(raccolta.faseCaparra.importo) || 0;
            const baseSaldo = parseFloat(raccolta.faseSaldo.importo) || 0;
            const scontoFratelliAttivo = raccolta.faseSaldo.tariffaFratelliAttiva && familyMemberCount >= 2;
            const importoSaldoFratelli = parseFloat(raccolta.faseSaldo.importoTariffaFratelli || '0') || baseSaldo;
            // Importo personalizzato da modulo (sovrascrive il saldo fisso della raccolta)
            const customSaldo = (raccolta as any).formCustomAmounts?.[member.id] as number | undefined;
            const isFromForm = phase === 'saldo' && customSaldo != null;
            
            let amountToShow: number | null = null;
            if (phase === 'caparra') amountToShow = baseCaparra;
            else amountToShow = customSaldo ?? (scontoFratelliAttivo ? importoSaldoFratelli : baseSaldo);
            
            const payment = raccolta.paymentDetails?.[phase]?.[member.id];

            let content;
            if (isPaid) {
                const amountPaid = phase === 'caparra' ? baseCaparra : (customSaldo ?? (scontoFratelliAttivo ? importoSaldoFratelli : baseSaldo));
                 if (payment) {
                    content = (
                        <div className="flex items-center justify-start text-green-600 gap-2 h-full">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="text-sm font-medium">€{amountPaid.toFixed(2)}</span>
                            {payment.receiptUrl && <FileText className="h-4 w-4 text-muted-foreground" />}
                        </div>
                    );
                } else {
                    content = <div className="flex items-center justify-start text-green-600 gap-2 h-full"><CheckCircle2 className="h-5 w-5" /><span className="text-sm font-medium">€{amountPaid.toFixed(2)}</span></div>;
                }
            } else if (isCashOnly && isConfirmed && !isConcluded) {
                content = <div className="flex items-center justify-start h-full"><p className="text-sm text-muted-foreground">Da pagare in contanti <span className='font-medium text-foreground'>{amountToShow > 0 ? `(€${amountToShow.toFixed(2)})` : ''}</span></p></div>;
            } else if (isConcluded || !isSelectable) {
                content = <div className={cn("flex items-center justify-start gap-2 h-full", !isSelectable && "opacity-50")}><Checkbox checked={false} disabled={true} /><span className="text-sm text-muted-foreground">{amountToShow > 0 ? `€${amountToShow.toFixed(2)}` : ''}</span></div>;
            } else {
                 content = (
                    <div className="flex items-center justify-start gap-2 h-full">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleStandardSelection(member.id, phase)} disabled={!isSelectable} />
                        <span className="text-sm">{amountToShow > 0 ? `€${amountToShow.toFixed(2)}` : ''}</span>
                        {isFromForm && (
                            <Badge variant="outline" className="text-[10px] px-1 h-4 border-blue-300 text-blue-600">
                                Da modulo
                            </Badge>
                        )}
                    </div>
                );
            }
            return <TableCell className="text-left">{content}</TableCell>;
        };

        return (
            <Table>
                <TableHeader><TableRow><TableHead className="w-[200px]">Membro Familiare</TableHead><TableHead className="pl-8 w-[160px]">Conferma</TableHead>{raccolta.faseCaparra.attiva ? <TableHead className="pl-8 w-[150px]">Caparra</TableHead> : <TableHead className="w-[150px]" />}{raccolta.faseSaldo.attiva ? <TableHead className="pl-8 w-[150px]">Saldo</TableHead> : <TableHead className="w-[150px]" />}{/*<TableHead className="text-right w-[150px]">Totale Selezionato</TableHead>*/}</TableRow></TableHeader>
                <TableBody>{relevantMembers.map(member => <TableRow key={member.id} className={cn(selectedStandardMembers[member.id]?.size > 0 && 'bg-muted/50', (raccolta.faseConferma.conclusa && !raccolta.confermatiIds?.includes(member.id)) && 'opacity-50')}><TableCell className="font-medium">{member.nome} {member.cognome}</TableCell>{renderConfirmationCell(member)}{renderPaymentCell(member, 'caparra')}{renderPaymentCell(member, 'saldo')}{/*<TableCell className="text-right font-medium">{calculateStandardMemberPayments(member.id).totale > 0 ? `€${calculateStandardMemberPayments(member.id).totale.toFixed(2)}` : ''}</TableCell>*/}</TableRow>)}</TableBody>
                <UiTableFooter><TableRow><TableCell colSpan={2} className="text-left font-bold">Totali da Pagare</TableCell><TableCell className="font-bold pl-8">{raccolta.faseCaparra.attiva && totalCaparraSelezionata > 0 ? `€${totalCaparraSelezionata.toFixed(2)}` : ''}</TableCell><TableCell className="font-bold pl-8">{raccolta.faseSaldo.attiva && totalSaldoSelezionato > 0 ? `€${totalSaldoSelezionato.toFixed(2)}` : ''}</TableCell>{/*<TableCell className="text-right font-bold">{selectionResult.totalDue > 0 ? `€${selectionResult.totalDue.toFixed(2)}` : ''}</TableCell>*/}</TableRow></UiTableFooter>
            </Table>
        );
    };

    const renderTesseramentoCard = () => {
        const { membersWithFees, totalFee } = useMemo(() => {
            const selectedArray = Array.from(selectedTesserati);
            const membersToConsider = relevantMembers
                .filter(m => selectedArray.includes(m.id) && m.dataNascita)
                .sort((a, b) => new Date(a.dataNascita!).getTime() - new Date(b.dataNascita!).getTime());
            
            const numMembers = membersToConsider.length;

            let calculatedTotalFee = 0;

            const feeData = relevantMembers.map(member => {
                const tariffa = getTariffaForMember(member, tariffe || []);
                const isPaid = raccolta.tesseratiIds?.includes(member.id) ?? false;
                
                if (!tariffa || isPaid) return { ...member, fee: 0, feeLabel: isPaid ? 'Pagato' : 'N/A' };
                
                let fee: number;
                let feeLabel: string;

                if (numMembers <= 1) {
                    fee = tariffa.quotaIntera;
                    feeLabel = "Intera";
                } else if (numMembers <= 3) {
                    fee = tariffa.quotaScontata;
                    feeLabel = "Scontata";
                } else { // numMembers >= 4
                    const memberIndex = membersToConsider.findIndex(m => m.id === member.id);
                    if (memberIndex !== -1 && memberIndex >= 3) { 
                        fee = tariffa.gratuita;
                        feeLabel = "Gratuità";
                    } else {
                        fee = tariffa.quotaScontata;
                        feeLabel = "Scontata";
                    }
                }
                
                 if (typeof fee !== 'number') {
                    fee = 0;
                }

                if (selectedTesserati.has(member.id)) {
                    calculatedTotalFee += fee;
                }
                
                return { ...member, fee, feeLabel };
            });

            return { membersWithFees: feeData, totalFee: calculatedTotalFee };
        }, [selectedTesserati, relevantMembers, tariffe, raccolta.tesseratiIds]);

        return (
            <Table>
                <TableHeader><TableRow><TableHead className="w-12"></TableHead><TableHead>Membro Familiare</TableHead><TableHead>Fascia</TableHead><TableHead className="text-right">Quota</TableHead></TableRow></TableHeader>
                <TableBody>
                    {membersWithFees.map(member => {
                        const isPaid = raccolta.tesseratiIds?.includes(member.id) ?? false;
                        return (
                            <TableRow key={member.id}>
                                <TableCell>
                                    {isPaid ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Checkbox checked={selectedTesserati.has(member.id)} onCheckedChange={() => toggleTesseratoSelection(member.id)} />}
                                </TableCell>
                                <TableCell className="font-medium">{member.nome} {member.cognome}</TableCell>
                                <TableCell>{member.feeLabel}</TableCell>
                                <TableCell className="text-right font-medium">€{(member.fee || 0).toFixed(2)}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
                <UiTableFooter><TableRow><TableCell colSpan={3} className="font-bold">Totale Selezionato</TableCell><TableCell className="text-right font-bold">€{totalFee.toFixed(2)}</TableCell></TableRow></UiTableFooter>
            </Table>
        );
    };

    return (
        <Card>
            <CardHeader><CardTitle>{raccolta.nome}</CardTitle><CardDescription>{raccolta.tipo === 'tesseramento' ? "Seleziona i membri della famiglia da tesserare." : "Gestisci le iscrizioni per la tua famiglia a questa attività."}</CardDescription></CardHeader>
            <CardContent className="p-0">
                {raccolta.tipo === 'tesseramento' ? renderTesseramentoCard() : renderStandardCard()}
            </CardContent>
        </Card>
    );
}
