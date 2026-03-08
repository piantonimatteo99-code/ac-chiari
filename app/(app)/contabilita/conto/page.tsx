'use client';

import { useMemo, useState, useCallback } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, query, collectionGroup, doc, getDoc, writeBatch, serverTimestamp, addDoc, getDocs, where, deleteField, arrayRemove, limit } from 'firebase/firestore';
import type { Raccolta } from '@/components/raccolta-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, PlusCircle, CheckCircle2, AlertCircle, UserSquare, Loader2, ArrowRight, MoreHorizontal, CreditCard, CheckCheck, Trash2 } from 'lucide-react';
import { format, getYear, parseISO, isValid, parse } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { it } from 'date-fns/locale';
import { AddMovimentoDialog } from '@/components/add-movimento-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useDebounce } from 'use-debounce';
import type { UserData } from '@/src/hooks/use-user-data';
import type { Membro } from '../../nucleo-familiare/page';
import Link from 'next/link';
import type { MovimentoContante } from '../pagamenti-contanti/page';
import { Checkbox } from '@/components/ui/checkbox';
import type { Spesa } from '@/components/add-spesa-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SettleSpesaDialog } from '@/components/settle-spesa-dialog';
import { ConfirmationDialog } from '@/components/confirmation-dialog';


export interface UnifiedMember extends Partial<Membro>, Partial<UserData> {
  id: string;
  nome: string;
  cognome: string;
  familyId?: string;
}

export interface Movimento {
    id: string;
    data: Date | string;
    descrizione: string;
    causale?: string;
    mastroId: string;
    mastroNome: string;
    tipo: 'entrata' | 'uscita';
    importo: number;
    valoreTransazione?: number;
    paymentId?: string;
    receiptUrl?: string;
    isVerified?: boolean;
    registeredBy?: string;
    depositId?: string;
}

interface CashierSummary {
    cashierId: string;
    cashierName: string;
    totalAmount: number;
    movementIds: string[];
}

const parseDate = (date: any): Date | null => {
    if (!date) return null;

    if (date.toDate) { // Firestore Timestamp
        return date.toDate();
    }
    if (date instanceof Date) { // Javascript Date
        return date;
    }
    if (typeof date === 'string' || typeof date === 'number') {
        // Try ISO format first
        const fromISO = parseISO(String(date));
        if (isValid(fromISO)) return fromISO;

        // Then try 'dd/MM/yyyy' format
        const fromFormat = parse(String(date), 'dd/MM/yyyy', new Date());
        if (isValid(fromFormat)) return fromFormat;
    }
    return null; // Return null if no valid date could be parsed
}

const formatDate = (date: any) => {
    const jsDate = parseDate(date);
    if (!jsDate || !isValid(jsDate)) {
        return '-';
    }
    return format(jsDate, 'dd/MM/yyyy', { locale: it });
}

type ViewMode = 'generale' | 'perSingoliConti';
const ROWS_PER_PAGE = 50;

export default function ContoPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('generale');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
    const [selectedYear, setSelectedYear] = useState<string>('generale');
    const [spesaToSettle, setSpesaToSettle] = useState<Spesa | null>(null);
    const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
    const [movimentoToDelete, setMovimentoToDelete] = useState<Movimento | null>(null);

    const [selectedCashiers, setSelectedCashiers] = useState<string[]>([]);
    const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    
    const raccolteQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'raccolte'));
    }, [firestore]);
    const { data: raccolte, isLoading: isLoadingRaccolte } = useCollection<Raccolta>(raccolteQuery);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), limit(1000));
    }, [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserData & { familyId?: string }>(usersQuery);

    const membriQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return query(collectionGroup(firestore, 'membri'), limit(1000));
    }, [firestore]);
    const { data: membri, isLoading: isLoadingMembri } = useCollection<Membro & { ref?: any }>(membriQuery, { includeRef: true });

    const movimentiContantiQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'movimenti-contanti'), limit(1000));
    }, [firestore]);
    const { data: movimentiContanti, isLoading: isLoadingMovimentiContanti } = useCollection<MovimentoContante>(movimentiContantiQuery);

    const speseQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spese'), limit(1000));
    }, [firestore]);
    const { data: spese, isLoading: isLoadingSpese } = useCollection<Spesa>(speseQuery);

    
    const allKnownMembers = useMemo(() => {
        const membersMap = new Map<string, UnifiedMember>();
        if (users) {
            users.forEach(u => membersMap.set(u.id, { ...u, id: u.id, nome: u.nome, cognome: u.cognome, familyId: u.id }));
        }
        if (membri) {
            membri.forEach(m => {
                if(!membersMap.has(m.id)) {
                     membersMap.set(m.id, { ...m, id: m.id, nome: m.nome, cognome: m.cognome, familyId: m.ref?.parent.parent?.id })
                }
            });
        }
        return membersMap;
    }, [users, membri]);

    const userMap = useMemo(() => {
        if (!users) return new Map<string, string>();
        return new Map(users.map(u => [u.id, u.displayName]));
    }, [users]);
    
    const cashierSummary = useMemo(() => {
        if (!movimentiContanti || !users) return [];
        const summaryMap: Map<string, CashierSummary> = new Map();

        movimentiContanti.forEach(mov => {
            if (mov.isDelivered && mov.deliveredTo && !mov.isDeposited) {
                const cashierId = mov.deliveredTo;
                if (!summaryMap.has(cashierId)) {
                    summaryMap.set(cashierId, {
                        cashierId: cashierId,
                        cashierName: userMap.get(cashierId) || 'Sconosciuto',
                        totalAmount: 0,
                        movementIds: []
                    });
                }
                const summary = summaryMap.get(cashierId)!;
                summary.totalAmount += mov.importo;
                
                if (mov.tipo === 'raccolta') {
                    summary.movementIds.push(mov.id);
                }
            }
        });
        return Array.from(summaryMap.values()).filter(s => s.totalAmount > 0);
    }, [movimentiContanti, users, userMap]);


    const allMovimenti = useMemo(() => {
        const movimenti: Movimento[] = [];

        // Bonifici
        if (raccolte) {
            raccolte.forEach(raccolta => {
                const familyCounts = (raccolta.confermatiIds || []).reduce((acc, memberId) => {
                    const member = allKnownMembers.get(memberId);
                    if (member?.familyId) {
                        acc[member.familyId] = (acc[member.familyId] || 0) + 1;
                    }
                    return acc;
                }, {} as Record<string, number>);

                if (raccolta.paymentDetails) {
                    const processPaymentType = (paymentType: 'caparra' | 'saldo', phaseName: string) => {
                        const fase = paymentType === 'caparra' ? raccolta.faseCaparra : raccolta.faseSaldo;
                        if (!fase.attiva) return;

                        if (raccolta.paymentDetails?.[paymentType]) {
                            Object.entries(raccolta.paymentDetails[paymentType]).forEach(([memberId, payment]) => {
                                const member = allKnownMembers.get(memberId);
                                const memberName = member ? `${member.nome} ${member.cognome}` : `ID: ${memberId}`;
                                
                                let importoQuota = parseFloat(fase.importo) || 0;
                                if (paymentType === 'saldo' && fase.tariffaFratelliAttiva && member?.familyId && familyCounts[member.familyId] >= 2) {
                                    importoQuota = parseFloat(fase.importoTariffaFratelli || '0') || importoQuota;
                                }

                                movimenti.push({
                                    id: `${raccolta.id}-${paymentType}-${memberId}`,
                                    data: payment.analysisData?.data || payment.timestamp,
                                    descrizione: `Pagamento ${phaseName} per ${memberName}`,
                                    causale: payment.analysisData?.causale,
                                    mastroId: raccolta.id,
                                    mastroNome: raccolta.nome,
                                    tipo: 'entrata',
                                    importo: importoQuota,
                                    valoreTransazione: payment.analysisData?.importo ? Math.abs(payment.analysisData.importo) : undefined,
                                    paymentId: payment.paymentId,
                                    receiptUrl: payment.receiptUrl,
                                    isVerified: payment.isVerified,
                                });
                            });
                        }
                    };
                    processPaymentType('caparra', 'Caparra');
                    processPaymentType('saldo', 'Saldo');
                }
            });
        }
        
        // Pagamenti in contanti
        if (movimentiContanti && raccolte) {
             const raccolteMap = new Map(raccolte.map(r => [r.id, r.nome]));
             movimentiContanti.forEach(mov => {
                const adminName = userMap.get(mov.registeredBy) || 'Sconosciuto';
                
                if (mov.tipo === 'deposito') {
                    movimenti.push({
                        id: mov.id,
                        data: mov.createdAt,
                        descrizione: mov.descrizione || 'Deposito Contanti',
                        mastroId: 'cassa-contanti',
                        mastroNome: '', 
                        tipo: 'entrata',
                        importo: 0, 
                        valoreTransazione: mov.importo,
                        isVerified: mov.isVerified, 
                        registeredBy: adminName,
                        depositId: mov.depositId,
                    });
                } else if (mov.tipo === 'raccolta') {
                    const member = allKnownMembers.get(mov.memberId);
                    const memberName = member ? `${member.nome} ${member.cognome}` : `ID: ${mov.memberId}`;
                    const phaseName = mov.phase ? mov.phase.charAt(0).toUpperCase() + mov.phase.slice(1) : '';
                    
                    movimenti.push({
                        id: mov.id,
                        data: mov.createdAt,
                        descrizione: `Pagamento Contanti ${phaseName} per ${memberName}`,
                        mastroId: mov.raccoltaId,
                        mastroNome: raccolteMap.get(mov.raccoltaId) || 'Raccolta non trovata',
                        tipo: 'entrata',
                        importo: mov.importo,
                        isVerified: mov.isVerified,
                        registeredBy: adminName,
                        depositId: mov.depositId,
                    })
                }
             })
        }
        
        // Spese
        if (spese) {
            spese.forEach(spesa => {
                movimenti.push({
                    id: spesa.id,
                    data: spesa.data,
                    descrizione: spesa.descrizione,
                    causale: `Spesa registrata da ${spesa.registeredByName}`,
                    mastroId: spesa.raccoltaId || 'spese-generali',
                    mastroNome: spesa.raccoltaNome || 'Spese Generali',
                    tipo: 'uscita',
                    importo: spesa.importo,
                    receiptUrl: spesa.receiptUrl,
                    isVerified: true, // Spese are considered verified once entered
                    registeredBy: spesa.registeredByName,
                });
            });
        }
        
        return movimenti.sort((a, b) => {
            const dateA = parseDate(a.data);
            const dateB = parseDate(b.data);
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB.getTime() - dateA.getTime();
        });

    }, [raccolte, movimentiContanti, spese, allKnownMembers, userMap]);

    const availableYears = useMemo(() => {
        const years = new Set(allMovimenti.map(mov => {
            const date = parseDate(mov.data);
            return date ? getYear(date).toString() : '';
        }).filter(Boolean));
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [allMovimenti]);

    const summaryData = useMemo(() => {
        const yearToFilter = selectedYear === 'generale' ? null : parseInt(selectedYear, 10);
        
        const movimentiPerConto: { [key: string]: { entrate: number, uscite: number, nome: string } } = {};
        
        allMovimenti.forEach(mov => {
            const movDate = parseDate(mov.data);
            if (yearToFilter && movDate && getYear(movDate) !== yearToFilter) {
                return;
            }

            if (!movimentiPerConto[mov.mastroId]) {
                movimentiPerConto[mov.mastroId] = { entrate: 0, uscite: 0, nome: mov.mastroNome };
            }

            if (mov.tipo === 'entrata') {
                movimentiPerConto[mov.mastroId].entrate += mov.importo;
            } else {
                movimentiPerConto[mov.mastroId].uscite += mov.importo;
            }
        });

        return Object.values(movimentiPerConto).map(conto => ({
            ...conto,
            saldo: conto.entrate - conto.uscite,
        }));
    }, [allMovimenti, selectedYear]);

    const filteredMovimenti = useMemo(() => {
        setCurrentPage(1);
        const lowercasedQuery = debouncedSearchQuery.toLowerCase();
        return allMovimenti.filter(movimento => {
            const registeredByString = movimento.registeredBy ? `Registrato da: ${movimento.registeredBy}`.toLowerCase() : '';
            
            const descriptionMatch = !lowercasedQuery || 
                formatDate(movimento.data).toLowerCase().includes(lowercasedQuery) ||
                movimento.descrizione.toLowerCase().includes(lowercasedQuery) ||
                movimento.mastroNome.toLowerCase().includes(lowercasedQuery) ||
                movimento.causale?.toLowerCase().includes(lowercasedQuery) ||
                movimento.paymentId?.toLowerCase().includes(lowercasedQuery) ||
                movimento.depositId?.toLowerCase().includes(lowercasedQuery) ||
                registeredByString.includes(lowercasedQuery);
            return descriptionMatch;
        });
    }, [allMovimenti, debouncedSearchQuery]);

    const { paginatedMovimenti, totalPages } = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        const end = start + ROWS_PER_PAGE;
        const paginated = filteredMovimenti.slice(start, end);
        const total = Math.ceil(filteredMovimenti.length / ROWS_PER_PAGE);
        return { paginatedMovimenti: paginated, totalPages: total > 0 ? total : 1 };
    }, [filteredMovimenti, currentPage]);

    const movimentiByMastro = useMemo(() => {
        const movimentiByMastro: Record<string, Movimento[]> = {};
        
        filteredMovimenti.forEach(movimento => {
            if (!movimentiByMastro[movimento.mastroId]) {
                movimentiByMastro[movimento.mastroId] = [];
            }
            movimentiByMastro[movimento.mastroId].push(movimento);
        });
       
        return movimentiByMastro;
    }, [filteredMovimenti]);

    const getMastroStats = (mastroMovimenti: Movimento[]): {entrate: number, uscite: number, saldo: number} => {
        const entrate = mastroMovimenti.filter(m => m.tipo === 'entrata').reduce((acc, m) => acc + m.importo, 0);
        const uscite = mastroMovimenti.filter(m => m.tipo === 'uscita').reduce((acc, m) => acc + m.importo, 0);
        return { entrate, uscite, saldo: entrate - uscite };
    }
    
    const renderStatusIcon = (movimento: Movimento) => {
        if (movimento.isVerified) {
            return <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />;
        }
        if (movimento.receiptUrl && movimento.paymentId) { // bonifico
            return <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />;
        }
        if (movimento.depositId) { // Deposito o contanti legati a un deposito non ancora verificato
             return <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />;
        }
        if (movimento.registeredBy && !movimento.depositId && movimento.tipo === 'entrata') { // contanti non depositati
             return <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />;
        }
        return null;
    }
    
    const renderTransactionCell = (movimento: Movimento) => {
        if (movimento.receiptUrl && movimento.paymentId) { // Bonifico con ricevuta
            return (
                <Link href={movimento.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 hover:underline">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs font-mono">ACR - {movimento.paymentId}</span>
                </Link>
            );
        }
        if (movimento.paymentId) { // Bonifico senza ricevuta (in attesa)
            return (
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-mono">ACR - {movimento.paymentId}</span>
                </div>
            );
        }
        if (movimento.receiptUrl) { // Spesa con ricevuta
            return (
                 <Link href={movimento.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">Vedi Ricevuta</span>
                </Link>
            )
        }
        if (movimento.depositId) { // Deposito o pagamento in contanti legato a un deposito
            return (
                 <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-mono">{movimento.depositId}</span>
                </div>
            )
        }
        if (movimento.registeredBy) { // Pagamento in contanti non ancora depositato
            return (
                 <div className="flex items-center gap-2">
                    <UserSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Registrato da: {movimento.registeredBy}</span>
                </div>
            )
        }
        return null;
    };
    
    const handleToggleCashierSelection = (cashierId: string) => {
        setSelectedCashiers(prev => 
            prev.includes(cashierId) 
                ? prev.filter(id => id !== cashierId)
                : [...prev, cashierId]
        );
    };

    const totalSelectedCashAmount = useMemo(() => {
        return selectedCashiers.reduce((total, cashierId) => {
            const summary = cashierSummary.find(s => s.cashierId === cashierId);
            return total + (summary?.totalAmount || 0);
        }, 0);
    }, [selectedCashiers, cashierSummary]);

    const handleCreateDeposit = useCallback(async () => {
        if (!firestore || !user || totalSelectedCashAmount <= 0 || selectedCashiers.length === 0) return;

        setIsProcessingDeposit(true);

        const batch = writeBatch(firestore);
        const now = new Date();
        const serverTime = serverTimestamp();
        
        const counterRef = doc(firestore, 'counters', 'deposits');
        
        try {
            const allMovementIdsToUpdate: string[] = [];
            selectedCashiers.forEach(cashierId => {
                const summary = cashierSummary.find(s => s.cashierId === cashierId);
                if (summary) {
                    allMovementIdsToUpdate.push(...summary.movementIds);
                }
            });

            const counterSnap = await getDoc(counterRef);
            const datePrefix = format(now, 'ddMMyy');
            const currentCount = counterSnap.exists() && counterSnap.data().dailyCounts?.[datePrefix] ? counterSnap.data().dailyCounts[datePrefix] : 0;
            const newCount = currentCount + 1;
            const depositId = `Dep-${datePrefix}-${newCount}`;
            
            batch.set(counterRef, { dailyCounts: { [datePrefix]: newCount } }, { merge: true });
            
            allMovementIdsToUpdate.forEach(movId => {
                const movRef = doc(firestore, 'movimenti-contanti', movId);
                batch.update(movRef, { isDeposited: true, depositId: depositId });
            });

            const depositMovementRef = doc(collection(firestore, 'movimenti-contanti'));
            batch.set(depositMovementRef, {
                descrizione: 'Deposito Contanti',
                importo: totalSelectedCashAmount,
                tipo: 'deposito',
                createdAt: serverTime,
                registeredBy: user.uid,
                isDelivered: true,
                isDeposited: true,
                isVerified: false,
                depositId: depositId
            });

            const paymentDocRef = doc(firestore, 'payments', depositId);
            batch.set(paymentDocRef, {
                paymentId: depositId,
                receiptUrl: '',
                timestamp: serverTime,
                analysisData: {
                    importo: totalSelectedCashAmount,
                    data: format(now, 'dd/MM/yyyy'),
                    causale: `Deposito contanti ${depositId}`,
                },
                userId: user.uid,
                isVerified: false,
                datePrefix: datePrefix,
                isCashDeposit: true,
            });
        
            await batch.commit();
            setSelectedCashiers([]);
        } catch (error) {
             console.error("Error creating deposit:", error);
        } finally {
             setIsProcessingDeposit(false);
        }
    }, [firestore, user, totalSelectedCashAmount, selectedCashiers, cashierSummary]);

    const handleDeleteMovimento = useCallback(async () => {
        if (!firestore || !movimentoToDelete) return;
        
        const movimento = movimentoToDelete;
        const batch = writeBatch(firestore);
    
        try {
            // Case 1: Spesa
            const spesaRef = doc(firestore, 'spese', movimento.id);
            const spesaSnap = await getDoc(spesaRef);
            if (spesaSnap.exists()) {
                batch.delete(spesaRef);
                const cashMovementsQuery = query(collection(firestore, 'movimenti-contanti'), where('spesaId', '==', movimento.id));
                const cashMovementsSnap = await getDocs(cashMovementsQuery);
                cashMovementsSnap.forEach(doc => batch.delete(doc.ref));
                
                await batch.commit();
                return;
            }
    
            // Case 2: Movimento Contante (cash payment or deposit)
            const movContanteRef = doc(firestore, 'movimenti-contanti', movimento.id);
            const movContanteSnap = await getDoc(movContanteRef);
            if (movContanteSnap.exists()) {
                const movContanteData = movContanteSnap.data() as MovimentoContante;
                if (movContanteData.tipo === 'raccolta') {
                    batch.delete(movContanteRef);
                    const raccoltaRef = doc(firestore, 'raccolte', movContanteData.raccoltaId);
                    const fieldToUpdate = `${movContanteData.phase}PaidIds`;
                    batch.update(raccoltaRef, { [fieldToUpdate]: arrayRemove(movContanteData.memberId) });
                } else if (movContanteData.tipo === 'deposito') {
                    const depositId = movContanteData.depositId;
                    if (!depositId) throw new Error("Deposit movement has no depositId.");
    
                    batch.delete(movContanteRef);
    
                    const paymentRef = doc(firestore, 'payments', depositId);
                    batch.delete(paymentRef);
    
                    const relatedCashQuery = query(collection(firestore, 'movimenti-contanti'), where('depositId', '==', depositId), where('tipo', '==', 'raccolta'));
                    const relatedCashSnap = await getDocs(relatedCashQuery);
                    relatedCashSnap.forEach(doc => {
                        batch.update(doc.ref, {
                            isDeposited: deleteField(),
                            depositId: deleteField()
                        });
                    });
                }
                
                await batch.commit();
                return;
            }
    
            // Case 3: Bonifico
            if (movimento.paymentId && !movimento.registeredBy) {
                const { paymentId, mastroId: raccoltaId } = movimento;
                
                const raccoltaRef = doc(firestore, 'raccolte', raccoltaId);
                const raccoltaSnap = await getDoc(raccoltaRef);
                if (!raccoltaSnap.exists()) throw new Error("Raccolta not found for bonifico deletion.");
                
                const raccoltaData = raccoltaSnap.data() as Raccolta;
                const updates: { [key: string]: any } = {};
                let memberIdToRemove: string | null = null;
                let phase: 'caparra' | 'saldo' | null = null;
    
                if (raccoltaData.paymentDetails?.caparra) {
                    for (const memberId in raccoltaData.paymentDetails.caparra) {
                        if (raccoltaData.paymentDetails.caparra[memberId].paymentId === paymentId) {
                            updates[`paymentDetails.caparra.${memberId}`] = deleteField();
                            memberIdToRemove = memberId;
                            phase = 'caparra';
                            break;
                        }
                    }
                }
                if (!memberIdToRemove && raccoltaData.paymentDetails?.saldo) {
                    for (const memberId in raccoltaData.paymentDetails.saldo) {
                        if (raccoltaData.paymentDetails.saldo[memberId].paymentId === paymentId) {
                            updates[`paymentDetails.saldo.${memberId}`] = deleteField();
                            memberIdToRemove = memberId;
                            phase = 'saldo';
                            break;
                        }
                    }
                }
    
                if(memberIdToRemove && phase) {
                    const paidIdsField = phase === 'caparra' ? 'caparraPaidIds' : 'saldoPaidIds';
                    updates[paidIdsField] = arrayRemove(memberIdToRemove);
                }
    
                if (Object.keys(updates).length > 0) {
                    batch.update(raccoltaRef, updates);
                }
    
                const paymentRef = doc(firestore, 'payments', paymentId);
                batch.delete(paymentRef);
    
                await batch.commit();
                return;
            }
    
            throw new Error("Tipo di movimento non riconosciuto per l'eliminazione.");
    
        } catch (e) {
            console.error("Error deleting movimento:", e);
        }
    
    }, [firestore, movimentoToDelete]);

    const isLoading = isLoadingRaccolte || isLoadingUsers || isLoadingMembri || isLoadingMovimentiContanti || isLoadingSpese;

    return (
        <div className="space-y-8">
            <AddMovimentoDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} />
             <SettleSpesaDialog isOpen={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen} spesa={spesaToSettle} />
             <ConfirmationDialog
                isOpen={!!movimentoToDelete}
                onOpenChange={(isOpen) => !isOpen && setMovimentoToDelete(null)}
                title="Conferma Eliminazione"
                description={`Sei sicuro di voler eliminare il movimento "${movimentoToDelete?.descrizione}"? L'operazione è irreversibile.`}
                onConfirm={handleDeleteMovimento}
                confirmLabel="Elimina"
                confirmVariant="destructive"
            />

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Conto Generale</h2>
                    <p className="text-muted-foreground">Riepilogo di tutti i movimenti finanziari.</p>
                </div>
                 <Button onClick={() => setIsDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Aggiungi Movimento
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Riepilogo Conti</CardTitle>
                            <CardDescription>Totali per ogni conto in base all'anno selezionato.</CardDescription>
                        </div>
                         <div className="w-48">
                             <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleziona anno..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="generale">Generale</SelectItem>
                                    {availableYears.map(year => (
                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4 pt-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Conto</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Entrate</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Uscite</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Saldo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summaryData.map(conto => {
                                    if(!conto.nome) return null;
                                    return (
                                        <TableRow key={conto.nome}>
                                            <TableCell className='font-medium'>{conto.nome}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap text-green-600">€ {conto.entrate.toFixed(2)}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap text-destructive">€ {conto.uscite.toFixed(2)}</TableCell>
                                            <TableCell className={`text-right whitespace-nowrap font-bold ${conto.saldo >= 0 ? 'text-green-600' : 'text-destructive'}`}>€ {conto.saldo.toFixed(2)}</TableCell>
                                        </TableRow>
                                    )}
                                )}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell className='font-bold'>TOTALE</TableCell>
                                    <TableCell className="text-right whitespace-nowrap font-bold text-green-600">€ {summaryData.reduce((acc, c) => acc + c.entrate, 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap font-bold text-destructive">€ {summaryData.reduce((acc, c) => acc + c.uscite, 0).toFixed(2)}</TableCell>
                                    <TableCell className={`text-right whitespace-nowrap font-bold ${summaryData.reduce((acc, c) => acc + c.saldo, 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>€ {summaryData.reduce((acc, c) => acc + c.saldo, 0).toFixed(2)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    )}
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Cassa Contanti</CardTitle>
                    <CardDescription>Riepilogo dei contanti consegnati e pronti per il deposito.</CardDescription>
                </CardHeader>
                <CardContent>
                    {cashierSummary.length > 0 ? (
                        <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead></TableHead>
                                    <TableHead>Cassiere</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Importo da Depositare</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cashierSummary.map(summary => (
                                    <TableRow key={summary.cashierId}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedCashiers.includes(summary.cashierId)}
                                                onCheckedChange={() => handleToggleCashierSelection(summary.cashierId)}
                                                aria-label={`Seleziona il lotto di ${summary.cashierName}`}
                                            />
                                        </TableCell>
                                        <TableCell>{summary.cashierName}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap font-medium">€{summary.totalAmount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {selectedCashiers.length > 0 && (
                            <div className="mt-4 flex items-center justify-between p-4 border-t bg-muted/50 rounded-b-lg">
                                <div>
                                    <p className="text-sm font-medium">{selectedCashiers.length} lott{selectedCashiers.length > 1 ? 'i' : 'o'} selezionat{selectedCashiers.length > 1 ? 'i' : 'o'}</p>
                                    <p className='text-2xl font-bold'>€{totalSelectedCashAmount.toFixed(2)}</p>
                                </div>
                                <Button size="lg" onClick={handleCreateDeposit} disabled={isProcessingDeposit}>
                                {isProcessingDeposit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Deposita <ArrowRight className='ml-2 h-4 w-4' />
                                </Button>
                            </div>
                        )}
                        </>
                    ) : (
                         <div className="text-center py-10 text-muted-foreground">
                            <p>Nessun contante è stato ancora consegnato per il deposito.</p>
                        </div>
                    )}
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle>Dettaglio Movimenti</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-end gap-4">
                         <div className="grid gap-2 flex-1">
                            <Label>Cerca transazione</Label>
                            <Input 
                                placeholder="Cerca per descrizione, conto, causale o codice..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                         <div className="grid gap-2 w-48">
                            <Label>Visualizzazione</Label>
                             <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleziona modalità..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="generale">Generale</SelectItem>
                                    <SelectItem value="perSingoliConti">Per Singoli Conti</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                     {!paginatedMovimenti || paginatedMovimenti.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">Nessun movimento trovato per i filtri selezionati.</p>
                     ) : viewMode === 'generale' ? (
                        <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Stato</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Conto</TableHead>
                                    <TableHead>Descrizione</TableHead>
                                    <TableHead>Transazione</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Entrata</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Uscita</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Valore Transazione</TableHead>
                                     <TableHead className="text-right">Azioni</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedMovimenti.map(movimento => {
                                     const isSpesa = movimento.tipo === 'uscita' && spese?.some(s => s.id === movimento.id);
                                     const spesaObject = isSpesa ? spese!.find(s => s.id === movimento.id) : null;
                                     const isFullySettled = spesaObject ? (spesaObject.importoPagato || 0) >= spesaObject.importo : false;
                                 
                                     const isUnverifiedBonifico = !!movimento.paymentId && !movimento.isVerified;
                                     const isUnverifiedDeposito = !!movimento.depositId && !movimento.isVerified;
                                     
                                    return (
                                    <TableRow key={movimento.id}>
                                        <TableCell>{renderStatusIcon(movimento)}</TableCell>
                                        <TableCell>{formatDate(movimento.data)}</TableCell>
                                        <TableCell>{movimento.mastroNome}</TableCell>
                                        <TableCell>{movimento.descrizione}</TableCell>
                                        <TableCell>{renderTransactionCell(movimento)}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap text-green-600">
                                            {movimento.tipo === 'entrata' && movimento.importo > 0 ? `€ ${movimento.importo.toFixed(2)}` : ''}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap text-destructive">
                                            {movimento.tipo === 'uscita' ? `€ ${movimento.importo.toFixed(2)}` : ''}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                                             {movimento.valoreTransazione ? `€ ${movimento.valoreTransazione.toFixed(2)}` : ''}
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
                                                    {isSpesa && !isFullySettled && (
                                                        <DropdownMenuItem onSelect={() => {
                                                            if (spesaObject) {
                                                                setSpesaToSettle(spesaObject);
                                                                setIsSettleDialogOpen(true);
                                                            }
                                                        }}>
                                                            <CreditCard className="mr-2 h-4 w-4" />
                                                            Salda Spesa
                                                        </DropdownMenuItem>
                                                    )}
                                                    {(isUnverifiedBonifico || isUnverifiedDeposito) && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href="/contabilita/transazioni-da-controllare">
                                                                <CheckCheck className="mr-2 h-4 w-4" />
                                                                Verifica Transazione
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {((isSpesa && !isFullySettled) || isUnverifiedBonifico || isUnverifiedDeposito) && <DropdownMenuSeparator />}
                                                    <DropdownMenuItem onSelect={() => setMovimentoToDelete(movimento)} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Elimina
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <span className="text-sm text-muted-foreground">
                                Pagina {currentPage} di {totalPages} ({filteredMovimenti.length} risultati)
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                Precedente
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                Successiva
                            </Button>
                        </div>
                        </>
                     ) : (
                        <Accordion type="multiple" className="w-full">
                            {Object.entries(movimentiByMastro).map(([mastroId, mastroMovimenti]) => {
                                const mastroNome = mastroMovimenti[0]?.mastroNome || 'Sconosciuto';
                                const stats = getMastroStats(mastroMovimenti);
                                return (
                                    <AccordionItem value={mastroId} key={mastroId}>
                                        <AccordionTrigger>
                                            <div className='flex justify-between items-center w-full pr-4'>
                                                <span className="font-semibold">{mastroNome}</span>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className='text-muted-foreground'>Saldo:</span>
                                                    <span className={`font-bold ${stats.saldo >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                                        € {stats.saldo.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[50px]">Stato</TableHead>
                                                        <TableHead>Data</TableHead>
                                                        <TableHead>Descrizione</TableHead>
                                                        <TableHead>Transazione</TableHead>
                                                        <TableHead className="text-right whitespace-nowrap">Entrata</TableHead>
                                                        <TableHead className="text-right whitespace-nowrap">Uscita</TableHead>
                                                        <TableHead className="text-right whitespace-nowrap">Valore Transazione</TableHead>
                                                        <TableHead className="text-right">Azioni</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {mastroMovimenti.map(movimento => {
                                                          const isSpesa = movimento.tipo === 'uscita' && spese?.some(s => s.id === movimento.id);
                                                            const spesaObject = isSpesa ? spese!.find(s => s.id === movimento.id) : null;
                                                            const isFullySettled = spesaObject ? (spesaObject.importoPagato || 0) >= spesaObject.importo : false;
                                                        
                                                            const isUnverifiedBonifico = !!movimento.paymentId && !movimento.isVerified;
                                                            const isUnverifiedDeposito = !!movimento.depositId && !movimento.isVerified;
                                                        return (
                                                        <TableRow key={movimento.id}>
                                                            <TableCell>{renderStatusIcon(movimento)}</TableCell>
                                                            <TableCell>{formatDate(movimento.data)}</TableCell>
                                                            <TableCell>{movimento.descrizione}</TableCell>
                                                            <TableCell>{renderTransactionCell(movimento)}</TableCell>
                                                            <TableCell className="text-right whitespace-nowrap text-green-600">
                                                                {movimento.tipo === 'entrata' && movimento.importo > 0 ? `€ ${movimento.importo.toFixed(2)}` : ''}
                                                            </TableCell>
                                                            <TableCell className="text-right whitespace-nowrap text-destructive">
                                                                {movimento.tipo === 'uscita' ? `€ ${movimento.importo.toFixed(2)}` : ''}
                                                            </TableCell>
                                                            <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                                                                {movimento.valoreTransazione ? `€ ${movimento.valoreTransazione.toFixed(2)}` : ''}
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
                                                                        {isSpesa && !isFullySettled && (
                                                                            <DropdownMenuItem onSelect={() => {
                                                                                if (spesaObject) {
                                                                                    setSpesaToSettle(spesaObject);
                                                                                    setIsSettleDialogOpen(true);
                                                                                }
                                                                            }}>
                                                                                <CreditCard className="mr-2 h-4 w-4" />
                                                                                Salda Spesa
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {(isUnverifiedBonifico || isUnverifiedDeposito) && (
                                                                            <DropdownMenuItem asChild>
                                                                                <Link href="/contabilita/transazioni-da-controllare">
                                                                                    <CheckCheck className="mr-2 h-4 w-4" />
                                                                                    Verifica Transazione
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {((isSpesa && !isFullySettled) || isUnverifiedBonifico || isUnverifiedDeposito) && <DropdownMenuSeparator />}
                                                                        <DropdownMenuItem onSelect={() => setMovimentoToDelete(movimento)} className="text-destructive">
                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                            Elimina
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    )})}
                                                </TableBody>
                                                <TableFooter>
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="font-bold">Totale</TableCell>
                                                        <TableCell className="text-right whitespace-nowrap font-bold text-green-600">€ {stats.entrate.toFixed(2)}</TableCell>
                                                        <TableCell className="text-right whitespace-nowrap font-bold text-destructive">€ {stats.uscite.toFixed(2)}</TableCell>
                                                        <TableCell />
                                                        <TableCell />
                                                    </TableRow>
                                                </TableFooter>
                                            </Table>
                                        </AccordionContent>
                                    </AccordionItem>
                                )
                            })}
                        </Accordion>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
