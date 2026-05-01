'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { collection, doc, updateDoc, writeBatch, getDocs, query, where, getDoc, arrayRemove, deleteField } from 'firebase/firestore';
import type { Raccolta } from '@/components/raccolta-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CheckCheck, MoreHorizontal, Trash2, Check, ExternalLink, Clock, ShieldCheck, Info } from 'lucide-react';
import Link from 'next/link';
import { toDate, format, parse, isValid, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from 'use-debounce';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { Badge } from "@/components/ui/badge";
import { ApproveReceiptDialog } from '@/components/approve-receipt-dialog';

export interface PaymentDetails {
    paymentId: string;
    receiptUrl: string;
    timestamp: any;
    analysisData: any;
    isVerified?: boolean;
    isPreApproved?: boolean;
    isCashDeposit?: boolean;
    items?: any[];           // payment breakdown (member, phase, amount)
    causaleAttesa?: string;  // expected causale (ACR - paymentId)
    importoAtteso?: number;  // expected total amount
}

export interface FlatPayment {
    paymentId: string;
    paymentDetails: PaymentDetails;
    raccolte: {
        id: string;
        nome: string;
    }[];
    membri: string[];
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
};

const formatDate = (date: any) => {
    const jsDate = parseDate(date);
    if (!jsDate) return '-';
    return format(jsDate, 'dd/MM/yyyy', { locale: it });
};

export default function TransazioniDaControllarePage() {
    const firestore = useFirestore();
    const [paymentToDelete, setPaymentToDelete] = useState<FlatPayment | null>(null);
    const [approvingPayment, setApprovingPayment] = useState<FlatPayment | null>(null);
    const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

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
                        const existing = paymentsMap.get(payment.paymentId)!;
                        existing.raccolte.set(raccolta.id, raccolta.nome);
                        existing.membri.add(memberId);
                        if (payment.timestamp && existing.paymentDetails.timestamp && toDate(payment.timestamp) > toDate(existing.paymentDetails.timestamp)) {
                            existing.paymentDetails = payment;
                        }
                    });
                }
            });
        });

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
                // Sync fields from payments collection (source of truth)
                if (paymentsMap.has(payment.paymentId)) {
                    const existing = paymentsMap.get(payment.paymentId)!;
                    existing.paymentDetails = {
                        ...existing.paymentDetails,
                        isPreApproved: payment.isPreApproved,
                        isVerified: payment.isVerified ?? existing.paymentDetails.isVerified,
                        items: payment.items,
                        causaleAttesa: payment.causaleAttesa,
                        importoAtteso: payment.importoAtteso,
                        receiptUrl: payment.receiptUrl ?? existing.paymentDetails.receiptUrl,
                    };
                }
            });
        }

        return Array.from(paymentsMap.entries()).map(([paymentId, data]) => ({
            paymentId,
            paymentDetails: data.paymentDetails,
            raccolte: Array.from(data.raccolte.entries()).map(([id, nome]) => ({ id, nome })),
            membri: Array.from(data.membri),
            isCashDeposit: data.isCashDeposit,
        })).sort((a, b) => {
            const dateA = parseDate(a.paymentDetails.timestamp);
            const dateB = parseDate(b.paymentDetails.timestamp);
            if (!dateB) return -1;
            if (!dateA) return 1;
            return dateB.getTime() - dateA.getTime();
        });
    }, [raccolte, paymentsData]);

    // Payments waiting for admin pre-approval (new flow)
    const toApprovePayments = useMemo(() =>
        allPayments.filter(p => p.paymentDetails.isPreApproved === false),
    [allPayments]);

    // Payments pre-approved (or legacy without the field) and not yet verified
    const verificationPayments = useMemo(() =>
        allPayments.filter(p => p.paymentDetails.isPreApproved !== false && !p.paymentDetails.isVerified),
    [allPayments]);

    const filteredVerificationPayments = useMemo(() => {
        return verificationPayments.filter(p => {
            const q = debouncedSearchQuery.toLowerCase();
            return !q ||
                p.paymentId.toLowerCase().includes(q) ||
                p.raccolte.some(r => r.nome.toLowerCase().includes(q));
        });
    }, [verificationPayments, debouncedSearchQuery]);

    const handlePreApprove = useCallback(async (payment: FlatPayment) => {
        if (!firestore) return;
        try {
            const paymentDocRef = doc(firestore, 'payments', payment.paymentId);
            await updateDoc(paymentDocRef, { isPreApproved: true });

            // Sync to raccolte
            const batch = writeBatch(firestore);
            payment.raccolte.forEach(raccolta => {
                const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);
                payment.membri.forEach(membro => {
                    batch.update(raccoltaDocRef, {
                        [`paymentDetails.caparra.${membro}.isPreApproved`]: true,
                        [`paymentDetails.saldo.${membro}.isPreApproved`]: true,
                    });
                });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error pre-approving payment:", error);
        }
    }, [firestore]);

    const handleVerify = useCallback(async (payment: FlatPayment) => {
        if (!firestore) return;
        const batch = writeBatch(firestore);
        const paymentDocRef = doc(firestore, 'payments', payment.paymentId);

        // Mark verified and clear receiptUrl for privacy
        batch.update(paymentDocRef, { isVerified: true, verifiedAt: new Date(), receiptUrl: deleteField() });

        if (payment.isCashDeposit) {
            const movimentiRef = collection(firestore, 'movimenti-contanti');
            const q = query(movimentiRef, where("depositId", "==", payment.paymentId));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(movDoc => batch.update(movDoc.ref, { isVerified: true }));
        } else {
            payment.raccolte.forEach(raccolta => {
                const raccoltaDocRef = doc(firestore, 'raccolte', raccolta.id);
                payment.membri.forEach(membro => {
                    batch.update(raccoltaDocRef, {
                        [`paymentDetails.caparra.${membro}.isVerified`]: true,
                        [`paymentDetails.saldo.${membro}.isVerified`]: true,
                    });
                });
            });
        }

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error verifying payment:", error);
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
                    const toRemoveCaparra: string[] = [];
                    const toRemoveSaldo: string[] = [];

                    if (raccoltaData.paymentDetails?.caparra) {
                        for (const memberId in raccoltaData.paymentDetails.caparra) {
                            if (raccoltaData.paymentDetails.caparra[memberId].paymentId === paymentId) {
                                updates[`paymentDetails.caparra.${memberId}`] = deleteField();
                                toRemoveCaparra.push(memberId);
                            }
                        }
                    }
                    if (raccoltaData.paymentDetails?.saldo) {
                        for (const memberId in raccoltaData.paymentDetails.saldo) {
                            if (raccoltaData.paymentDetails.saldo[memberId].paymentId === paymentId) {
                                updates[`paymentDetails.saldo.${memberId}`] = deleteField();
                                toRemoveSaldo.push(memberId);
                            }
                        }
                    }
                    if (toRemoveCaparra.length > 0) updates.caparraPaidIds = arrayRemove(...toRemoveCaparra);
                    if (toRemoveSaldo.length > 0) updates.saldoPaidIds = arrayRemove(...toRemoveSaldo);
                    if (Object.keys(updates).length > 0) batch.update(raccoltaDocRef, updates);
                }
            }

            const paymentDocRef = doc(firestore, 'payments', paymentId);
            batch.delete(paymentDocRef);
            await batch.commit();
        } catch (error) {
            console.error("Error removing transaction:", error);
        }
    }, [firestore, paymentToDelete]);

    const handleToggleSelect = (paymentId: string) => {
        setSelectedPayments(prev =>
            prev.includes(paymentId) ? prev.filter(id => id !== paymentId) : [...prev, paymentId]
        );
    };

    const handleToggleSelectAll = (isChecked: boolean) => {
        setSelectedPayments(isChecked ? filteredVerificationPayments.map(p => p.paymentId) : []);
    };

    const handleBulkVerify = async () => {
        if (!firestore || selectedPayments.length === 0) return;
        for (const paymentId of selectedPayments) {
            const payment = verificationPayments.find(p => p.paymentId === paymentId);
            if (payment) await handleVerify(payment);
        }
        setSelectedPayments([]);
    };

    const totalSelectedAmount = useMemo(() => {
        return selectedPayments.reduce((total, paymentId) => {
            const payment = verificationPayments.find(p => p.paymentId === paymentId);
            return total + (payment?.paymentDetails.analysisData?.importo || 0);
        }, 0);
    }, [selectedPayments, verificationPayments]);

    const isLoading = isLoadingRaccolte || isLoadingPayments;

    if (isLoading) return <p>Caricamento transazioni...</p>;

    return (
        <div className="space-y-8 pb-24">
            <ConfirmationDialog
                isOpen={!!paymentToDelete}
                onOpenChange={(isOpen) => !isOpen && setPaymentToDelete(null)}
                title="Conferma Eliminazione"
                description={`Sei sicuro di voler eliminare la transazione ${paymentToDelete?.paymentId} e tutti i pagamenti collegati? L'operazione è irreversibile.`}
                onConfirm={handleRejectAndRemove}
                confirmLabel="Elimina e Rifiuta"
                confirmVariant="destructive"
            />

            {approvingPayment && (
                <ApproveReceiptDialog
                    isOpen={!!approvingPayment}
                    onOpenChange={(open) => !open && setApprovingPayment(null)}
                    payment={approvingPayment}
                    onApprove={async () => {
                        await handlePreApprove(approvingPayment);
                        setApprovingPayment(null);
                    }}
                    onReject={() => {
                        setPaymentToDelete(approvingPayment);
                        setApprovingPayment(null);
                    }}
                />
            )}

            {/* ── SEZIONE 1: Da Approvare ── */}
            {toApprovePayments.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-900">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            Ricevute in Attesa di Approvazione
                        </CardTitle>
                        <CardDescription>
                            Queste ricevute sono state caricate dai soci e attendono la tua approvazione prima della verifica finale.
                            Visualizza il documento e approvalo o rifiutalo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data Caricamento</TableHead>
                                    <TableHead>Riferimento</TableHead>
                                    <TableHead>Importo</TableHead>
                                    <TableHead>Raccolta/e</TableHead>
                                    <TableHead>Documento</TableHead>
                                    <TableHead className="text-right">Azioni</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {toApprovePayments.map(p => (
                                    <TableRow key={p.paymentId}>
                                        <TableCell>{formatDate(p.paymentDetails.timestamp)}</TableCell>
                                        <TableCell className="font-mono text-sm">ACR - {p.paymentId}</TableCell>
                                        <TableCell>
                                            {p.paymentDetails.analysisData?.importo != null
                                                ? `€ ${Number(p.paymentDetails.analysisData.importo).toFixed(2)}`
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                {p.isCashDeposit
                                                    ? <span className="text-sm">Deposito Contanti</span>
                                                    : p.raccolte.map(r => <span key={r.id}>{r.nome}</span>)
                                                }
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {p.paymentDetails.receiptUrl ? (
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={p.paymentDetails.receiptUrl} target="_blank">
                                                        <ExternalLink className="mr-2 h-4 w-4" />
                                                        Visualizza
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">Non disponibile</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => setApprovingPayment(p)}
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                >
                                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                                    Approva
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => setPaymentToDelete(p)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Rifiuta
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {toApprovePayments.length === 0 && verificationPayments.length > 0 && (
                <Card className="border-blue-200 dark:border-blue-900">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-blue-500" />
                            Nessuna Ricevuta in Attesa di Approvazione
                        </CardTitle>
                        <CardDescription>
                            Tutte le ricevute caricate sono già state approvate. Procedi con la verifica finale qui sotto.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* ── SEZIONE 2: Da Verificare ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Transazioni da Verificare</CardTitle>
                    <CardDescription>
                        Transazioni approvate in attesa di verifica finale. Una volta verificate, il documento verrà rimosso.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {verificationPayments.length === 0 && toApprovePayments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <CheckCheck className="mx-auto h-12 w-12" />
                            <p className="mt-4">Tutto in ordine! Non ci sono transazioni da verificare.</p>
                        </div>
                    ) : verificationPayments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Nessuna transazione approvata da verificare al momento.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-end gap-4 mb-4">
                                <div className="flex-1">
                                    <Label htmlFor="search-verification">Cerca per ID o raccolta</Label>
                                    <Input
                                        id="search-verification"
                                        placeholder="Cerca..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="h-10"
                                    />
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
                                        <TableHead>Data Caricamento</TableHead>
                                        <TableHead>Riferimento</TableHead>
                                        <TableHead>Importo</TableHead>
                                        <TableHead>Raccolta/e</TableHead>
                                        <TableHead>Documento</TableHead>
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
                                            <TableCell>{formatDate(p.paymentDetails.timestamp)}</TableCell>
                                            <TableCell>
                                                {p.isCashDeposit ? (
                                                    <span className="text-sm font-medium">{p.paymentId}</span>
                                                ) : (
                                                    <span className="font-mono text-sm">ACR - {p.paymentId}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {p.paymentDetails.analysisData?.importo != null
                                                    ? `€ ${Number(p.paymentDetails.analysisData.importo).toFixed(2)}`
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    {p.isCashDeposit
                                                        ? <span className="text-sm">Deposito Contanti</span>
                                                        : p.raccolte.map(r => <span key={r.id}>{r.nome}</span>)
                                                    }
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {p.paymentDetails.receiptUrl ? (
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={p.paymentDetails.receiptUrl} target="_blank">
                                                            <ExternalLink className="mr-1 h-4 w-4" />
                                                            Apri
                                                        </Link>
                                                    </Button>
                                                ) : (
                                                    <Badge variant="secondary">Rimosso</Badge>
                                                )}
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

            {/* ── Bulk Verify Bar ── */}
            {selectedPayments.length > 0 && (
                <div className="fixed bottom-0 left-0 sm:left-64 right-0 p-4 border-t bg-background/95 backdrop-blur-sm z-10">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">
                                {selectedPayments.length} transazion{selectedPayments.length > 1 ? 'i' : 'e'} selezionat{selectedPayments.length > 1 ? 'e' : 'a'}
                            </p>
                            <p className="text-3xl font-bold">€{totalSelectedAmount.toFixed(2)}</p>
                        </div>
                        <Button size="lg" onClick={handleBulkVerify}>
                            <Check className="mr-2 h-4 w-4" />
                            Verifica Selezionate
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
