'use client';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Spesa } from './add-spesa-dialog';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/src/firebase';
import { MovimentoContante } from '@/app/(app)/contabilita/pagamenti-contanti/page';
import { collection, doc, writeBatch, serverTimestamp, query, where, increment } from 'firebase/firestore';
import { UserData } from '@/src/hooks/use-user-data';
import { Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';

interface SettleSpesaDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  spesa: Spesa | null;
}

interface CashierSummary {
    cashierId: string;
    cashierName: string;
    totalAmount: number;
}

export function SettleSpesaDialog({ isOpen, onOpenChange, spesa }: SettleSpesaDialogProps) {
    const firestore = useFirestore();
    const { user: adminUser } = useUser();
    
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (isOpen) {
            setAmounts({});
            setIsSaving(false);
            setError(null);
        }
    }, [isOpen]);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserData>(usersQuery);

    const cashMovementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'movimenti-contanti');
    }, [firestore]);
    const { data: cashMovements, isLoading: isLoadingCashMovements } = useCollection<MovimentoContante>(cashMovementsQuery);

    const cashierSummary = useMemo((): CashierSummary[] => {
        if (!cashMovements || !users) return [];
        const summaryMap: Map<string, CashierSummary> = new Map();

        cashMovements.forEach(mov => {
             if (mov.isDelivered && mov.deliveredTo && !mov.isDeposited) {
                const cashierId = mov.deliveredTo;
                if (!summaryMap.has(cashierId)) {
                    summaryMap.set(cashierId, {
                        cashierId: cashierId,
                        cashierName: users.find(u => u.id === cashierId)?.displayName || 'Sconosciuto',
                        totalAmount: 0,
                    });
                }
                const summary = summaryMap.get(cashierId)!;
                 if (mov.tipo === 'raccolta') {
                    summary.totalAmount += mov.importo;
                 } else if (mov.tipo === 'spesa' && mov.importo < 0) {
                    summary.totalAmount += mov.importo; // Already negative
                 }
            }
        });
        
        return Array.from(summaryMap.values());
    }, [cashMovements, users]);
    
    const amountToSettle = useMemo(() => {
        if (!spesa) return 0;
        return spesa.importo - (spesa.importoPagato || 0);
    }, [spesa]);

    const totalPaidNow = useMemo(() => {
        return Object.values(amounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }, [amounts]);


    const handleCheckboxChange = (source: string, isChecked: boolean) => {
        const newAmounts = { ...amounts };
        if (isChecked) {
            const alreadyAllocated = Object.entries(newAmounts)
              .filter(([key]) => key !== source)
              .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0);
            
            const maxAvailableForThisSource = amountToSettle - alreadyAllocated;
            
            let amountToSet = maxAvailableForThisSource;

            if (source !== 'bonifico') {
                const cashierBalance = cashierSummary.find(c => c.cashierId === source)?.totalAmount || 0;
                amountToSet = Math.min(maxAvailableForThisSource, cashierBalance);
            }

            newAmounts[source] = String(amountToSet > 0 ? amountToSet : '0');

        } else {
            delete newAmounts[source];
        }
        setAmounts(newAmounts);
    };

    const handleAmountChange = (source: string, value: string) => {
        setAmounts(prev => ({...prev, [source]: value}));
    };

    useEffect(() => {
        const totalFromInputs = Object.values(amounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        if (totalFromInputs > amountToSettle) {
            setError(`L'importo totale non può superare il residuo della spesa (€${amountToSettle.toFixed(2)}).`);
        } else {
            setError(null);
        }
    }, [amounts, amountToSettle]);


    const handleRegisterPayment = async () => {
        if (!firestore || !adminUser || !spesa) {
            setError("Dati mancanti per saldare la spesa.");
            return;
        }

        const totalToPay = Object.values(amounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        if (totalToPay <= 0) {
            setError("Inserire un importo valido da rimborsare.");
            return;
        }
         if (totalToPay > amountToSettle + 0.001) { // Add tolerance for float issues
            setError(`L'importo totale rimborsato (€${totalToPay.toFixed(2)}) non può superare il residuo (€${amountToSettle.toFixed(2)}).`);
            return;
        }

        setIsSaving(true);
        setError(null);
        
        const batch = writeBatch(firestore);
        const spesaDocRef = doc(firestore, 'spese', spesa.id);
        
        batch.update(spesaDocRef, {
            importoPagato: increment(totalToPay)
        });

        for (const source in amounts) {
            const amount = parseFloat(amounts[source] || '0');
            if (amount > 0 && source !== 'bonifico') {
                const cashier = cashierSummary.find(c => c.cashierId === source);
                if (!cashier) continue;
                 if (amount > cashier.totalAmount) {
                    setError(`L'importo per ${cashier.cashierName} supera la sua disponibilità.`);
                    setIsSaving(false);
                    return;
                }

                const cashMovementRef = doc(collection(firestore, 'movimenti-contanti'));
                batch.set(cashMovementRef, {
                    tipo: 'spesa',
                    descrizione: `Rimborso spesa: ${spesa.descrizione}`,
                    importo: -amount, // Negative amount
                    createdAt: serverTimestamp(),
                    registeredBy: adminUser.uid,
                    deliveredTo: source,
                    isDelivered: true, 
                    isDeposited: false, 
                    spesaId: spesa.id,
                });
            }
        }
        
        try {
            await batch.commit();
            onOpenChange(false);
        } catch (err) {
            console.error(err);
            setError(`Si è verificato un errore: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const isLoading = isLoadingUsers || isLoadingCashMovements;

    if (!spesa) return null;
    
    const remainingAfterPayment = amountToSettle - totalPaidNow;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Esegui Rimborso Spesa</DialogTitle>
                    <DialogDescription>
                        Seleziona le fonti e gli importi per rimborsare questa spesa, anche parzialmente.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto -mx-6 px-6">
                    <div className="space-y-6 py-4">
                        <div className="p-4 rounded-lg border bg-muted">
                            <div className="flex justify-between items-baseline">
                                <p className="text-sm text-muted-foreground">{spesa.descrizione}</p>
                                <p className="text-2xl font-bold">€{spesa.importo.toFixed(2)}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Pagato: €{(spesa.importoPagato || 0).toFixed(2)} / Residuo: <span className='font-bold'>€{amountToSettle.toFixed(2)}</span>
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h4 className="font-medium">Metodo di Rimborso</h4>
                             <div className="space-y-2">
                                <div className="flex items-center gap-3 rounded-md border p-3">
                                    <Checkbox 
                                        id="bonifico" 
                                        checked={Object.keys(amounts).includes('bonifico')}
                                        onCheckedChange={(checked) => handleCheckboxChange('bonifico', !!checked)}
                                    />
                                    <Label htmlFor="bonifico" className="flex-1 cursor-pointer">
                                        Bonifico Bancario
                                    </Label>
                                    {Object.keys(amounts).includes('bonifico') && (
                                        <Input
                                            type="number"
                                            className="h-8 w-28"
                                            placeholder="0.00"
                                            value={amounts['bonifico'] || ''}
                                            onChange={(e) => handleAmountChange('bonifico', e.target.value)}
                                        />
                                    )}
                                </div>
                                
                                {isLoading ? (
                                    <p className="text-sm text-muted-foreground p-3">Caricamento casse...</p>
                                ) : cashierSummary.length > 0 ? (
                                    <>
                                        {cashierSummary.map(c => (
                                            <div key={c.cashierId} className="flex items-center gap-3 rounded-md border p-3">
                                                <Checkbox 
                                                    id={c.cashierId} 
                                                    checked={Object.keys(amounts).includes(c.cashierId)}
                                                    onCheckedChange={(checked) => handleCheckboxChange(c.cashierId, !!checked)}
                                                    disabled={c.totalAmount <= 0}
                                                />
                                                <Label htmlFor={c.cashierId} className="flex-1 cursor-pointer">
                                                    {c.cashierName}
                                                    <span className="text-xs text-muted-foreground ml-2">(Disponibile: €{c.totalAmount.toFixed(2)})</span>
                                                </Label>
                                                {Object.keys(amounts).includes(c.cashierId) && (
                                                    <Input
                                                        type="number"
                                                        className="h-8 w-28"
                                                        placeholder="0.00"
                                                        value={amounts[c.cashierId] || ''}
                                                        onChange={(e) => handleAmountChange(c.cashierId, e.target.value)}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground p-3">Nessuna cassa con fondi disponibili.</p>
                                )}
                            </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-2 text-base">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Totale da rimborsare ora:</span>
                                <span className="font-semibold">€{totalPaidNow.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Residuo su spesa:</span>
                                <span className="font-semibold">€{remainingAfterPayment.toFixed(2)}</span>
                            </div>
                        </div>
              
                    </div>
                </div>
                {error && <p className="text-sm text-destructive px-6 pb-2">{error}</p>}
                <DialogFooter className="border-t pt-6 -mx-6 px-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                    <Button onClick={handleRegisterPayment} disabled={isSaving || totalPaidNow <= 0 || !!error}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registra Rimborso
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
