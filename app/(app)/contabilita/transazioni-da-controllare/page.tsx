'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { collection, doc, updateDoc, deleteField, writeBatch, getDocs, query, where, getDoc, arrayRemove } from 'firebase/firestore';
import type { Raccolta } from '@/components/raccolta-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertCircle, Check, CheckCheck, MoreHorizontal, Trash2, Pencil, Info, ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { diff } from 'deep-object-diff';
import { toDate, format, parse, isValid, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EditTransactionDialog, type AnalysisResult } from '@/components/edit-transaction-dialog';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from 'use-debounce';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { Badge } from "@/components/ui/badge";

export interface PaymentDetails {
    paymentId: string;
    receiptUrl: string;
    timestamp: any;
    analysisData: any; 
    originalAnalysisData?: any; 
    isVerified?: boolean;
    isCashDeposit?: boolean;
}

export interface FlatPayment {
    paymentId: string;
    paymentDetails: PaymentDetails;
    raccolte: {
        id: string;
        nome: string;
    }[];
    membri: string[];
    approvedFields?: Record<string, boolean>;
    isCashDeposit?: boolean;
}

const parseDate = (date: any): Date | null => {
    if (!date) return null;
    if (date.toDate) return date.toDate();
    if (date instanceof Date) return date;
    if (typeof date === 'string' || typeof date === 'number') {
        const fromISO = parseISO(String(date));
        if (isValid(fromISO)) return fromISO;
        const fromFormat = parse(String(date), 'dd/MM/yyyy', new Date());
        if (isValid(fromFormat)) return fromFormat;
    }
    return null;
}

const formatDate = (date: any) => {
    const jsDate = parseDate(date);
    if (!jsDate) return '-';
    return format(jsDate, 'dd/MM/yyyy', { locale: it });
}

const normalizeDate = (dateString: string | undefined | null): string | null => {
    if (!dateString) return null;
    
    let date = parse(dateString, 'dd/MM/yyyy', new Date());
    if (isValid(date)) return format(date, 'yyyy-MM-dd');
    
    date = parseISO(dateString);
    if (isValid(date)) return format(date, 'yyyy-MM-dd');
    
    return dateString;
};

const fieldLabels: { [key: string]: string } = {
    importo: 'Importo',
    causale: 'Causale',
    beneficiario: 'Beneficiario',
    iban_beneficiario: 'IBAN Beneficiario',
    data: 'Data',
    nome_esecutore: 'Esecutore',
};


export default function TransazioniDaControllarePage() {
    const firestore = useFirestore();
    const [editingPayment, setEditingPayment] = useState<FlatPayment | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<FlatPayment | null>(null);
    const [discrepancyList, setDiscrepancyList] = useState<FlatPayment[]>([]);
    const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const raccolteQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'raccolte');
    }, [firestore]);
    const { data: raccolte, isLoading: isLoadingRaccolte } = useCollection<Raccolta>(raccolteQuery);

    const paymentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'payments');
    }, [firestore]);
    const { data: paymentsData, isLoading: isLoadingPayments } = useCollection<PaymentDetails>(paymentsQuery);

    const allPayments = useMemo((): FlatPayment[] => {
        if (!raccolte) return [];
        
        const paymentsMap = new Map<string, {
            paymentDetails: PaymentDetails;
            raccolte: Map<string, string>;
            membri: Set<string>;
            isCashDeposit?: boolean;
        }>();
    
        // 1. Process payments from 'raccolte'
        raccolte.forEach(raccolta => {
            ['caparra', 'saldo'].forEach(phase => {
                const phaseKey = phase as 'caparra' | 'saldo';
                if (raccolta.paymentDetails?.[phaseKey]) {
                    Object.entries(raccolta.paymentDetails[phaseKey]).forEach(([memberId, payment]) => {
                        if (!payment || !payment.paymentId) return;

                        if (!paymentsMap.has(payment.paymentId)) {
                            paymentsMap.set(payment.paymentId, {
                                paymentDetails: payment,
                                raccolte: new Map(),
                                membri: new Set()
                            });
                        }
                        
                        const existingPayment = paymentsMap.get(payment.paymentId)!;
                        existingPayment.raccolte.set(raccolta.id, raccolta.nome);
                        existingPayment.membri.add(memberId);

                        if (payment.timestamp && existingPayment.paymentDetails.timestamp && toDate(payment.timestamp) > toDate(existingPayment.paymentDetails.timestamp)) {
                            existingPayment.paymentDetails = payment;
                        }
                    });
                }
            });
        });

        // 2. Process cash deposits from 'payments'
        if (paymentsData) {
            paymentsData.forEach(payment => {
                if (payment.isCashDeposit && !paymentsMap.has(payment.paymentId)) {
                     paymentsMap.set(payment.paymentId, {
                        paymentDetails: payment,
                        raccolte: new Map(),
                        membri: new Set(),
                        isCashDeposit: true,
                    });
                }
            });
        }


        const flatPayments: FlatPayment[] = Array.from(paymentsMap.entries()).map(([paymentId, data]) => ({
            paymentId: paymentId,
            paymentDetails: data.paymentDetails,
            raccolte: Array.from(data.raccolte.entries()).map(([id, nome]) => ({ id, nome })),
            membri: Array.from(data.membri),
            isCashDeposit: data.isCashDeposit,
        }));

        // Sort by date descending
        return flatPayments.sort((a, b) => {
            const dateA = parseDate(a.paymentDetails.analysisData?.data);
            const dateB = parseDate(b.paymentDetails.analysisData?.data);
            if (!dateB) return -1;
            if (!dateA) return 1;
            return dateB.getTime() - dateA.getTime();
        });
    }, [raccolte, paymentsData]);

    const { discrepancyPayments, verificationPayments } = useMemo(() => {
        const discrepancies: FlatPayment[] = [];
        const verifications: FlatPayment[] = [];
        const discrepancyIds = new Set<string>();

        allPayments.forEach(p => {
            if (p.isCashDeposit) {
                if (!p.paymentDetails.isVerified) {
                    verifications.push(p);
                }
                return;
            }

            if (p.paymentDetails.originalAnalysisData) {
                const originalNorm = {
                    ...p.paymentDetails.originalAnalysisData,
                    data: normalizeDate(p.paymentDetails.originalAnalysisData.data)
                };
                 const currentNorm = {
                    ...p.paymentDetails.analysisData,
                    data: normalizeDate(p.paymentDetails.analysisData.data)
                };
                const difference = diff(originalNorm, currentNorm);

                if (Object.keys(difference).length > 0) {
                     discrepancies.push(p);
                     discrepancyIds.add(p.paymentId);
                } else {
                     if (!p.paymentDetails.isVerified) {
                        verifications.push(p);
                    }
                }
            } else if (!p.paymentDetails.isVerified) {
                verifications.push(p);
            }
        });
        
        const finalVerifications = verifications.filter(p => !discrepancyIds.has(p.paymentId));


        return { discrepancyPayments: discrepancies, verificationPayments: finalVerifications };
    }, [allPayments]);

    const earliestDate = useMemo(() => {
        if (verificationPayments.length === 0) {
            return undefined;
        }

        let minDate: Date | null = null;
        verificationPayments.forEach(p => {
            if (p.paymentDetails.analysisData?.data) {
                const paymentDate = parse(p.paymentDetails.analysisData.data, 'dd/MM/yyyy', new Date());
                if (isValid(paymentDate)) {
                    if (minDate === null || paymentDate < minDate) {
                        minDate = paymentDate;
                    }
                }
            }
        });
        return minDate || undefined;
    }, [verificationPayments]);

    const filteredVerificationPayments = useMemo(() => {
        return verificationPayments.filter(p => {
            const lowercasedQuery = debouncedSearchQuery.toLowerCase();
            const textMatch = !lowercasedQuery ||
                p.paymentId.toLowerCase().includes(lowercasedQuery) ||
                p.raccolte.some(r => r.nome.toLowerCase().includes(lowercasedQuery));
            
            if (!dateRange?.from || !p.paymentDetails.analysisData?.data) {
                return textMatch;
            }

            const paymentDate = parse(p.paymentDetails.analysisData.data, 'dd/MM/yyyy', new Date());
            if (!isValid(paymentDate)) {
                return textMatch;
            }

            const from = dateRange.from;
            const to = dateRange.to || dateRange.from; 

            const inRange = paymentDate >= from && paymentDate <= to;
            
            return textMatch && inRange;
        });
    }, [verificationPayments, debouncedSearchQuery, dateRange]);
    
    useEffect(() => {
        setDiscrepancyList(discrepancyPayments.map(p => ({ ...p, approvedFields: {} })));
    }, [discrepancyPayments]);

    const handleApproveTransaction = useCallback(async (payment: FlatPayment) => {
        if (!firestore) return;
        
        const batch = writeBatch(firestore);

        payment.raccolte.forEach(raccolta => {
            payment.membri.forEach(membro => {
                 const caparraPath = `paymentDetails.caparra.${membro}.originalAnalysisData`;
                 const saldoPath = `paymentDetails.saldo.${membro}.originalAnalysisData`;
                 const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);

                 if (payment.paymentDetails.analysisData) {
                    batch.update(raccoltaDocRef, { [caparraPath]: deleteField() });
                    batch.update(raccoltaDocRef, { [saldoPath]: deleteField() });
                 }
            })
        });

        try {
            await batch.commit();
            setDiscrepancyList(prev => prev.filter(p => p.paymentId !== payment.paymentId));
        } catch (error) {
            console.error("Error approving discrepancy:", error);
        }
    }, [firestore]);
    
    const handleRejectAndRemove = useCallback(async () => {
        if (!firestore || !paymentToDelete) return;

        const { paymentId, raccolte } = paymentToDelete;
        const batch = writeBatch(firestore);

        try {
            if (!paymentToDelete.isCashDeposit) {
                for (const r of raccolte) {
                    const raccoltaDocRef = doc(firestore, 'raccolte', r.id);
                    const raccoltaSnap = await getDoc(raccoltaDocRef);
                    if (!raccoltaSnap.exists()) continue;

                    const raccoltaData = raccoltaSnap.data() as Raccolta;
                    const updates: { [key: string]: any } = {};
                    const membersToRemoveFromCaparra: string[] = [];
                    const membersToRemoveFromSaldo: string[] = [];

                    if (raccoltaData.paymentDetails?.caparra) {
                        for (const memberId in raccoltaData.paymentDetails.caparra) {
                            if (raccoltaData.paymentDetails.caparra[memberId].paymentId === paymentId) {
                                updates[`paymentDetails.caparra.${memberId}`] = deleteField();
                                membersToRemoveFromCaparra.push(memberId);
                            }
                        }
                    }
                    
                    if (raccoltaData.paymentDetails?.saldo) {
                        for (const memberId in raccoltaData.paymentDetails.saldo) {
                            if (raccoltaData.paymentDetails.saldo[memberId].paymentId === paymentId) {
                                updates[`paymentDetails.saldo.${memberId}`] = deleteField();
                                membersToRemoveFromSaldo.push(memberId);
                            }
                        }
                    }

                    if (membersToRemoveFromCaparra.length > 0) {
                        updates.caparraPaidIds = arrayRemove(...membersToRemoveFromCaparra);
                    }
                    if (membersToRemoveFromSaldo.length > 0) {
                        updates.saldoPaidIds = arrayRemove(...membersToRemoveFromSaldo);
                    }

                    if (Object.keys(updates).length > 0) {
                        batch.update(raccoltaDocRef, updates);
                    }
                }
            }

            const paymentDocRef = doc(firestore, 'payments', paymentId);
            batch.delete(paymentDocRef);

            await batch.commit();

        } catch (error) {
            console.error("Error removing transaction:", error);
        }
    }, [firestore, paymentToDelete]);

    const handleEdit = (payment: FlatPayment) => {
        if(payment.isCashDeposit) return; // Cannot edit cash deposits
        setEditingPayment(payment);
        setIsEditDialogOpen(true);
    };
    
    const handleSaveFromDialog = useCallback(async (payment: FlatPayment, newFormData: AnalysisResult) => {
        if (!firestore) return;

        const batch = writeBatch(firestore);

        const payload = { ...newFormData };
        let dateFromForm = parse(newFormData.data || '', 'dd/MM/yyyy', new Date());
        if(isValid(dateFromForm)) {
            payload.data = format(dateFromForm, 'dd/MM/yyyy');
        }

        payment.raccolte.forEach(raccolta => {
            const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);
            payment.membri.forEach(membro => {
                const caparraPath = `paymentDetails.caparra.${membro}.analysisData`;
                const saldoPath = `paymentDetails.saldo.${membro}.analysisData`;

                batch.update(raccoltaDocRef, { [caparraPath]: payload, [saldoPath]: payload });
            });
        });
        
        try {
            await batch.commit();
            setDiscrepancyList(prevList => prevList.map(p => {
                if (p.paymentId === payment.paymentId) {
                    const originalNorm = { ...payment.paymentDetails.originalAnalysisData, data: normalizeDate(payment.paymentDetails.originalAnalysisData?.data) };
                    const currentNorm = { ...payload, data: normalizeDate(payload.data) };
                    const difference = diff(originalNorm, currentNorm);
                    const allFields = Object.keys(difference);
                    const approvedFields = Object.fromEntries(allFields.map(f => [f, true]));
                    return { ...p, approvedFields, paymentDetails: { ...p.paymentDetails, analysisData: payload }};
                }
                return p;
            }));
        } catch (err: any) {
            console.error('Error updating transaction from dialog:', err);
            throw err;
        }
    }, [firestore]);


    const handleVerify = useCallback(async (payment: FlatPayment) => {
        if (!firestore) return;
        const batch = writeBatch(firestore);

        const paymentDocRef = doc(firestore, 'payments', payment.paymentId);
        batch.update(paymentDocRef, { isVerified: true, verifiedAt: new Date() });
        
        if (payment.isCashDeposit) {
            const movimentiRef = collection(firestore, 'movimenti-contanti');
            const q = query(movimentiRef, where("depositId", "==", payment.paymentId));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(movDoc => {
                batch.update(movDoc.ref, { isVerified: true });
            });
        } else {
            payment.raccolte.forEach(raccolta => {
                const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);
                payment.membri.forEach(membro => {
                    const caparraFieldPath = `paymentDetails.caparra.${membro}.isVerified`;
                    const saldoFieldPath = `paymentDetails.saldo.${membro}.isVerified`;
                    batch.update(raccoltaDocRef, { [caparraFieldPath]: true, [saldoFieldPath]: true });
                });
            });
        }

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error verifying payment:", error);
        }
    }, [firestore]);

    const handleApproveField = (paymentId: string, field: string) => {
        setDiscrepancyList(prevList => prevList.map(p => {
            if (p.paymentId === paymentId) {
                const updatedApprovedFields = { ...p.approvedFields, [field]: true };
                return { ...p, approvedFields: updatedApprovedFields };
            }
            return p;
        }));
    };

    const handleToggleSelect = (paymentId: string) => {
        setSelectedPayments(prev => 
            prev.includes(paymentId) 
                ? prev.filter(id => id !== paymentId)
                : [...prev, paymentId]
        );
    };

    const handleToggleSelectAll = (isChecked: boolean) => {
        if (isChecked) {
            setSelectedPayments(filteredVerificationPayments.map(p => p.paymentId));
        } else {
            setSelectedPayments([]);
        }
    };

    const handleBulkVerify = async () => {
        if (!firestore || selectedPayments.length === 0) return;

        const batch = writeBatch(firestore);
        
        for (const paymentId of selectedPayments) {
            const payment = verificationPayments.find(p => p.paymentId === paymentId);
            if (payment) {
                const paymentDocRef = doc(firestore, 'payments', payment.paymentId);
                batch.update(paymentDocRef, { isVerified: true, verifiedAt: new Date() });

                if (payment.isCashDeposit) {
                     const movimentiRef = collection(firestore, 'movimenti-contanti');
                    const q = query(movimentiRef, where("depositId", "==", payment.paymentId));
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach(movDoc => {
                        batch.update(movDoc.ref, { isVerified: true });
                    });
                } else {
                    payment.raccolte.forEach(raccolta => {
                        const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);
                        payment.membri.forEach(membro => {
                            const caparraFieldPath = `paymentDetails.caparra.${membro}.isVerified`;
                            const saldoFieldPath = `paymentDetails.saldo.${membro}.isVerified`;
                            batch.update(raccoltaDocRef, { [caparraFieldPath]: true, [saldoFieldPath]: true });
                        });
                    });
                }
            }
        }

        try {
            await batch.commit();
            setSelectedPayments([]);
        } catch (error) {
            console.error("Error during bulk verification:", error);
        }
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setDateRange(undefined);
    };

    const totalSelectedAmount = useMemo(() => {
        return selectedPayments.reduce((total, paymentId) => {
            const payment = verificationPayments.find(p => p.paymentId === paymentId);
            return total + (payment?.paymentDetails.analysisData.importo || 0);
        }, 0);
    }, [selectedPayments, verificationPayments]);


    const isLoading = isLoadingRaccolte || isLoadingPayments;

    if (isLoading) {
        return <p>Caricamento transazioni...</p>;
    }

    const areFiltersActive = debouncedSearchQuery !== '';

    return (
        <div className="space-y-8 pb-24">
            {editingPayment && (
                <EditTransactionDialog
                    isOpen={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    payment={editingPayment}
                    onSave={handleSaveFromDialog}
                />
            )}
            <ConfirmationDialog
                isOpen={!!paymentToDelete}
                onOpenChange={(isOpen) => !isOpen && setPaymentToDelete(null)}
                title="Conferma Eliminazione"
                description={`Sei sicuro di voler eliminare la transazione ${paymentToDelete?.paymentId} e tutti i pagamenti collegati? L'operazione è irreversibile.`}
                onConfirm={handleRejectAndRemove}
                confirmLabel="Elimina e Rifiuta"
                confirmVariant="destructive"
            />


            {discrepancyList.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertCircle className="text-amber-500" /> Transazioni con Discrepanze</CardTitle>
                        <CardDescription>
                            Queste transazioni sono state modificate manually. Verifica le differenze e approva per spostarle nella tabella di verifica finale.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Dettagli Transazione</TableHead>
                                    <TableHead>Discrepanze Rilevate</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {discrepancyList.map((p) => {
                                    const originalNorm = {
                                        ...p.paymentDetails.originalAnalysisData,
                                        data: normalizeDate(p.paymentDetails.originalAnalysisData?.data)
                                    };
                                    const currentNorm = {
                                        ...p.paymentDetails.analysisData,
                                        data: normalizeDate(p.paymentDetails.analysisData.data)
                                    };
                                    const difference = diff(originalNorm, currentNorm);
                                    const fieldNames = Object.keys(difference);
                                    const allFieldsApproved = fieldNames.every(field => p.approvedFields?.[field]);

                                    return (
                                        <TableRow key={p.paymentId} className="align-top">
                                            <TableCell className="space-y-2 align-top py-2">
                                                <div className='space-y-2'>
                                                  <p><strong>Data:</strong> {formatDate(p.paymentDetails.analysisData?.data)}</p>
                                                  <p><strong>Raccolta:</strong> {p.raccolte.map(r => r.nome).join(', ')}</p>
                                                  <p className="flex items-center gap-2"><strong>Ricevuta:</strong>
                                                      <Link href={p.paymentDetails.receiptUrl} target="_blank" className="text-green-600 hover:underline">
                                                          ACR - {p.paymentId}
                                                      </Link>
                                                  </p>
                                                </div>
                                                <div className="pt-2">
                                                    <Button size="sm" disabled={!allFieldsApproved} onClick={() => handleApproveTransaction(p)}>
                                                        <Check className="mr-2 h-4 w-4" /> Verifica Transazione
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[120px]">Campo</TableHead>
                                                            <TableHead className="w-[300px]">Dato Rilevato</TableHead>
                                                            <TableHead className="w-[300px]">Dato Inserito</TableHead>
                                                            <TableHead className="text-right w-[100px]">Azioni</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {fieldNames.map(field => {
                                                            const originalValue = (p.paymentDetails.originalAnalysisData as any)?.[field];
                                                            const currentValue = (p.paymentDetails.analysisData as any)?.[field];
                                                            const isApproved = p.approvedFields?.[field];

                                                            return (
                                                                <TableRow key={field}>
                                                                    <TableCell className="font-semibold py-2">{fieldLabels[field] || field}</TableCell>
                                                                    <TableCell className="py-2">
                                                                        <span className="text-xs whitespace-normal break-words">{String(originalValue)}</span>
                                                                    </TableCell>
                                                                    <TableCell className="py-2">
                                                                         <span className="text-xs whitespace-normal break-words">{String(currentValue)}</span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right py-2">
                                                                        {isApproved ? (
                                                                            <Badge variant="secondary" className="text-green-600 border-green-600">
                                                                                <Check className="mr-1 h-3 w-3" />
                                                                                Approvato
                                                                            </Badge>
                                                                        ) : (
                                                                            <div className="flex items-center justify-end">
                                                                                <Button variant="ghost" size="icon" onClick={() => handleApproveField(p.paymentId, field)}>
                                                                                    <Check className="h-4 w-4" />
                                                                                    <span className="sr-only">Approva Campo</span>
                                                                                </Button>
                                                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                                                                                    <Pencil className="h-4 w-4" />
                                                                                    <span className="sr-only">Modifica Campo</span>
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
            
            {discrepancyList.length === 0 && verificationPayments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2'><Info className="text-blue-500" />Nessuna Discrepanza Rilevata</CardTitle>
                        <CardDescription>
                            Non ci sono transazioni con dati modificati manually. Controlla le transazioni in attesa di verifica finale qui sotto.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Transazioni da Verificare</CardTitle>
                    <CardDescription>
                        Tutte le transazioni in attesa di una verifica finale. Una volta verificate, spariranno da questa lista.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     {verificationPayments.length === 0 && discrepancyList.length === 0 ? (
                         <div className="text-center py-12 text-muted-foreground">
                            <CheckCheck className="mx-auto h-12 w-12" />
                            <p className="mt-4">Tutto in ordine! Non ci sono transazioni da verificare.</p>
                        </div>
                     ) : (
                        <>
                        <div className="flex flex-col sm:flex-row items-end gap-4 mb-4">
                            <div className='flex-1'>
                                <Label htmlFor="search-verification">Cerca per ID o raccolta</Label>
                                <Input
                                    id="search-verification"
                                    placeholder="Cerca..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <div>
                                    <Label>Filtra per periodo</Label>
                                    <DateRangePicker
                                        date={dateRange}
                                        onDateChange={setDateRange}
                                        disabled={{ before: earliestDate }}
                                    />
                                </div>
                                {areFiltersActive && (
                                    <Button variant="ghost" onClick={handleClearFilters} title="Rimuovi filtri">
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox 
                                            checked={selectedPayments.length > 0 && selectedPayments.length === filteredVerificationPayments.length && filteredVerificationPayments.length > 0}
                                            onCheckedChange={(checked) => handleToggleSelectAll(!!checked)}
                                            aria-label="Seleziona tutto"
                                        />
                                    </TableHead>
                                    <TableHead>Data Esecuzione</TableHead>
                                    <TableHead>Riferimento</TableHead>
                                    <TableHead>Importo</TableHead>
                                    <TableHead>Raccolta/e</TableHead>
                                    <TableHead className="text-right">Azioni</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVerificationPayments.map(p => (
                                    <TableRow key={p.paymentId} data-state={selectedPayments.includes(p.paymentId) && "selected"}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedPayments.includes(p.paymentId)}
                                                onCheckedChange={() => handleToggleSelect(p.paymentId)}
                                                aria-label={`Seleziona transazione ${p.paymentId}`}
                                            />
                                        </TableCell>
                                        <TableCell>{formatDate(p.paymentDetails.analysisData?.data)}</TableCell>
                                        <TableCell>
                                            {p.isCashDeposit ? (
                                                <span className='text-sm font-medium'>
                                                    {p.paymentId}
                                                </span>
                                            ) : (
                                                <Link href={p.paymentDetails.receiptUrl} target="_blank" className="text-green-600 hover:underline">
                                                    ACR - {p.paymentId}
                                                </Link>
                                            )}
                                        </TableCell>
                                        <TableCell>€ {p.paymentDetails.analysisData.importo?.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                {p.isCashDeposit ? (
                                                    <span className="text-sm">Deposito Contanti</span>
                                                ) : (
                                                    p.raccolte.map(r => <span key={r.id}>{r.nome}</span>)
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => handleVerify(p)}>
                                                        <Check className="mr-2 h-4 w-4" /> Conferma Verifica
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleEdit(p)} disabled={!!p.isCashDeposit}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Modifica
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onSelect={() => setPaymentToDelete(p)} 
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Rifiuta e Rimuovi
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </>
                     )}
                </CardContent>
            </Card>

            {selectedPayments.length > 0 && (
                 <div className="fixed bottom-0 left-0 sm:left-64 right-0 p-4 border-t bg-background/95 backdrop-blur-sm z-10">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">{selectedPayments.length} transazion{selectedPayments.length > 1 ? 'i' : 'e'} selezionat{selectedPayments.length > 1 ? 'e' : 'a'}</p>
                            <p className='text-3xl font-bold'>€{totalSelectedAmount.toFixed(2)}</p>
                        </div>
                        <Button size="lg" onClick={handleBulkVerify}>
                           Verifica Selezionate <ArrowRight className='ml-2 h-4 w-4' />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
