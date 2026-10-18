'use client';

import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import type { UserData } from '@/src/hooks/use-user-data';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';
import type { Raccolta } from './raccolta-card';
import type { Tariffa } from '@/app/(app)/tesserati/tariffe/page';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from './ui/dropdown-menu';
import { Settings, Filter, CheckCircle2, XCircle, Hourglass, FileText, AlertTriangle, UserCheck, UserX, Banknote, ShoppingCart, Trash2 } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import Link from 'next/link';

export interface UnifiedMember extends Partial<Membro>, Partial<UserData> {
  id: string;
  nome: string;
  cognome: string;
  groupId?: string;
  groupName?: string;
  familyId?: string; // UID of the family head
  ref?: any;
  isPlaceholder?: boolean;
}
interface MembriRaccoltaListProps {
  raccolta: Raccolta;
  targetGroupMembers: UnifiedMember[];
  allMembers: UnifiedMember[]; // All members from all families
  isLoading: boolean;
  // Educator ghost management
  canManageGhosts?: boolean;
  canManageAll?: boolean; // Admin o educatore con accesso contabilità: gestisce tutti i partecipanti
  myEducatorGroupIds?: Set<string>;
  onRequestGhostAction?: (ghostId: string, ghostName: string, phase: 'conferma' | 'caparra' | 'saldo', currentValue: boolean, isPlaceholder?: boolean) => void;
  getGhostAmount?: (ghostId: string, phase: 'caparra' | 'saldo') => number;
  // Carrello tesseramento (solo per raccolta.tipo === 'tesseramento')
  tariffe?: Tariffa[];
  currentUserId?: string;
  onBatchTesseramentoConfirm?: (memberIds: string[], amounts: Record<string, number>) => Promise<void>;
}

const NESSUNA_KEYWORDS = [
  'nessuna', 'nessuno', 'nessun', 'no', 'n/a', 'na', 'n.a.',
  'non ha', 'non ha allergie', 'non ha intolleranze', 'niente', 'nulla', '-'
];

export function isNessunaAllergia(str: string): boolean {
  const lower = (str || '').trim().toLowerCase();
  if (!lower) return true;
  return NESSUNA_KEYWORDS.includes(lower) || lower.startsWith('nessun');
}

/** Restituisce la Tariffa corrispondente al membro in base all'anno di nascita */
const getTariffaForMember = (member: UnifiedMember, tariffe: Tariffa[]): Tariffa | undefined => {
  if (!member.dataNascita || !tariffe) return undefined;
  const birthYear = new Date(member.dataNascita as string).getFullYear();
  if (isNaN(birthYear)) return undefined;

  for (const tariffa of [...tariffe].sort((a, b) => a.order - b.order)) {
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

type ColumnVisibility = {
    [key: string]: boolean;
    nomeCognome: boolean;
    gruppo: boolean;
    conferma: boolean;
    caparra: boolean;
    saldo: boolean;
    pagato: boolean;
    totale: boolean;
    allergie: boolean;
};

type PaymentStatus = 'tutti' | 'pagato' | 'da_pagare';


export function MembriRaccoltaList({ raccolta, targetGroupMembers, allMembers, isLoading, canManageGhosts, canManageAll, myEducatorGroupIds, onRequestGhostAction, getGhostAmount, tariffe, currentUserId: _currentUserId, onBatchTesseramentoConfirm }: MembriRaccoltaListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  // Stato carrello per il tesseramento (solo quando raccolta.tipo === 'tesseramento')
  const [cartMembers, setCartMembers] = useState<Set<string>>(new Set());
  const [isCartProcessing, setIsCartProcessing] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState('tutti');
  const [confermaStatus, setConfermaStatus] = useState<PaymentStatus>('tutti');
  const [caparraStatus, setCaparraStatus] = useState<PaymentStatus>('tutti');
  const [saldoStatus, setSaldoStatus] = useState<PaymentStatus>('tutti');


  const { faseConferma, faseCaparra, faseSaldo, confermatiIds, caparraPaidIds, saldoPaidIds, paymentDetails } = raccolta;

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    nomeCognome: true,
    gruppo: true,
    conferma: faseConferma.attiva,
    caparra: faseCaparra.attiva,
    saldo: faseSaldo.attiva,
    pagato: true,
    totale: true,
    allergie: true,
  });
  
  const uniqueGroups = useMemo(() => {
    const groups = new Map<string, string>();
    targetGroupMembers.forEach(member => {
        if(member.groupId && member.groupName) {
            groups.set(member.groupId, member.groupName);
        }
    });
    return Array.from(groups.entries()).map(([id, name]) => ({ id, name }));
  }, [targetGroupMembers]);

  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!raccolta.confermatiIds) return counts;

    allMembers.forEach(member => {
        if (member.familyId && raccolta.confermatiIds.includes(member.id)) {
            counts[member.familyId] = (counts[member.familyId] || 0) + 1;
        }
    });
    return counts;
  }, [allMembers, raccolta.confermatiIds]);

  // Conta i fratelli che hanno PAGATO il saldo (usato in calculatePaidTotal)
  // Coerente con la formula retroattiva: N fratelli pagati → N × scontato
  const paidSaldoFamilyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!raccolta.saldoPaidIds) return counts;

    allMembers.forEach(member => {
        if (member.familyId && raccolta.saldoPaidIds!.includes(member.id)) {
            counts[member.familyId] = (counts[member.familyId] || 0) + 1;
        }
    });
    return counts;
  }, [allMembers, raccolta.saldoPaidIds]);

  /**
   * Calcola, per ogni membro nel carrello tesseramento, l'importo da incassare
   * tenendo conto degli sconti famiglia:
   *   - 1 membro per nucleo: quotaIntera
   *   - 2-3 membri per nucleo: quotaScontata
   *   - 4° membro in poi (i più giovani per dataNascita): gratuita
   * Il conteggio parte dalla somma di: già tesserati (tesseratiIds) + selezionati nel carrello.
   * I più giovani (dataNascita più recente) ricevono la gratuità.
   */
  const cartAmounts = useMemo<Record<string, number>>(() => {
    if (raccolta.tipo !== 'tesseramento' || !tariffe || cartMembers.size === 0) return {};

    // Raggruppa i membri del carrello per familyId
    const byFamily = new Map<string, UnifiedMember[]>();
    cartMembers.forEach(memberId => {
      const member = allMembers.find(m => m.id === memberId);
      if (!member) return;
      const fid = member.familyId ?? `solo:${memberId}`;
      if (!byFamily.has(fid)) byFamily.set(fid, []);
      byFamily.get(fid)!.push(member);
    });

    const amounts: Record<string, number> = {};

    byFamily.forEach((familyCart, fid) => {
      // Quanti membri di questa famiglia sono già tesserati (esclusi quelli nel carrello)
      const alreadyTesserated = allMembers.filter(
        m => m.familyId === fid &&
          !cartMembers.has(m.id) &&
          (raccolta.tesseratiIds ?? []).includes(m.id)
      ).length;

      // Ordina i membri del carrello per dataNascita ASC (più vecchi prima)
      // → i più giovani (ultimi) ricevono la gratuità
      const sortedCart = [...familyCart].sort((a, b) => {
        const da = a.dataNascita ? new Date(a.dataNascita as string).getTime() : 0;
        const db = b.dataNascita ? new Date(b.dataNascita as string).getTime() : 0;
        return da - db;
      });

      sortedCart.forEach((member, idx) => {
        const globalIndex = alreadyTesserated + idx; // posizione nella famiglia (0-based)
        const tariffa = getTariffaForMember(member, tariffe);
        let importo = 0;

        if (globalIndex === 0) {
          // Primo membro: quota intera
          importo = tariffa?.quotaIntera ?? 0;
        } else if (globalIndex < 3) {
          // 2° e 3° membro: quota scontata
          importo = tariffa?.quotaScontata ?? 0;
        } else {
          // 4° membro in poi: gratuità
          importo = tariffa?.gratuita ?? 0;
        }

        amounts[member.id] = importo;
      });
    });

    return amounts;
  }, [cartMembers, allMembers, raccolta.tipo, raccolta.tesseratiIds, tariffe]);

  /** Totale carrello */
  const cartTotal = useMemo(
    () => Object.values(cartAmounts).reduce((sum, v) => sum + v, 0),
    [cartAmounts]
  );

  /** Toggle selezione membro nel carrello */
  const toggleCartMember = (memberId: string) => {
    setCartMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  /** Conferma l'incasso contanti per tutti i membri nel carrello */
  const handleCartConfirm = async () => {
    if (!onBatchTesseramentoConfirm || cartMembers.size === 0) return;
    setIsCartProcessing(true);
    try {
      await onBatchTesseramentoConfirm(Array.from(cartMembers), cartAmounts);
      // Svuota il carrello dopo la conferma
      setCartMembers(new Set());
    } finally {
      setIsCartProcessing(false);
    }
  };

  const calculateTotal = (member: UnifiedMember): number => {
    const isConfirmed = confermatiIds?.includes(member.id) ?? false;
    if (!isConfirmed) return 0;
    
    let total = 0;
    
    // Cerca tariffa personalizzata per il gruppo del membro
    const customTariff = raccolta.tariffePersonalizzate?.find(t => t.groupId === member.groupId);

    const getPhaseImporto = (faseImporto: string, customImporto: string | undefined): number => {
        if (customImporto !== undefined && customImporto !== '') {
            const v = parseFloat(customImporto);
            return isNaN(v) || v < 0 ? parseFloat(faseImporto) || 0 : v;
        }
        return parseFloat(faseImporto) || 0;
    };

    const confermaImporto = getPhaseImporto(faseConferma.importo, customTariff?.importoConferma);
    const caparraImporto = getPhaseImporto(faseCaparra.importo, customTariff?.importoCaparra);
    
    let saldoImporto = getPhaseImporto(faseSaldo.importo, customTariff?.importoSaldo);
    
    // Applica sconto fratelli solo se non c'è tariffa personalizzata per il saldo
    if (!customTariff?.importoSaldo && faseSaldo.tariffaFratelliAttiva && member.familyId && (familyCounts[member.familyId] || 0) >= 2) {
        saldoImporto = parseFloat(faseSaldo.importoTariffaFratelli || '0') || saldoImporto;
    }

    if (faseConferma.attiva) total += confermaImporto;
    if (faseCaparra.attiva) total += caparraImporto;
    if (faseSaldo.attiva) total += saldoImporto;

    return total;
  };

  const calculatePaidTotal = (member: UnifiedMember): number => {
    const isConfirmed = confermatiIds?.includes(member.id) ?? false;
    if (!isConfirmed) return 0;

    let paidTotal = 0;
    const hasPaidCaparra = caparraPaidIds?.includes(member.id) ?? false;
    const hasPaidSaldo = saldoPaidIds?.includes(member.id) ?? false;

    // Cerca tariffa personalizzata per il gruppo del membro
    const customTariff = raccolta.tariffePersonalizzate?.find(t => t.groupId === member.groupId);

    const getPhaseImporto = (faseImporto: string, customImporto: string | undefined): number => {
        if (customImporto !== undefined && customImporto !== '') {
            const v = parseFloat(customImporto);
            return isNaN(v) || v < 0 ? parseFloat(faseImporto) || 0 : v;
        }
        return parseFloat(faseImporto) || 0;
    };

    if (faseConferma.attiva) {
        paidTotal += getPhaseImporto(faseConferma.importo, customTariff?.importoConferma);
    }
    if (faseCaparra.attiva && hasPaidCaparra) {
        paidTotal += getPhaseImporto(faseCaparra.importo, customTariff?.importoCaparra);
    }
    if (faseSaldo.attiva && hasPaidSaldo) {
        let saldoImporto = getPhaseImporto(faseSaldo.importo, customTariff?.importoSaldo);
        // Applica sconto fratelli solo se non c'è tariffa personalizzata per il saldo
        // e se >= 2 fratelli hanno effettivamente PAGATO (non solo confermato)
        if (!customTariff?.importoSaldo && faseSaldo.tariffaFratelliAttiva && member.familyId && (paidSaldoFamilyCounts[member.familyId] || 0) >= 2) {
            saldoImporto = parseFloat(faseSaldo.importoTariffaFratelli || '0') || saldoImporto;
        }
        paidTotal += saldoImporto;
    }

    return paidTotal;
  }

  const filteredMembers = useMemo(() => {
    const lowercasedFilter = debouncedSearchTerm.toLowerCase();
    
    return targetGroupMembers.filter(member => {
        const isConfirmed = confermatiIds?.includes(member.id) ?? false;
        const hasPaidCaparra = caparraPaidIds?.includes(member.id) ?? false;
        const hasPaidSaldo = saldoPaidIds?.includes(member.id) ?? false;

        const textMatch = lowercasedFilter ? 
            (member.nome.toLowerCase() + " " + member.cognome.toLowerCase()).includes(lowercasedFilter) ||
            member.groupName?.toLowerCase().includes(lowercasedFilter)
            : true;

        const groupMatch = selectedGroup === 'tutti' || member.groupId === selectedGroup;
        
        const confermaMatch = faseConferma.attiva ? (
            confermaStatus === 'tutti' ||
            (confermaStatus === 'pagato' && isConfirmed) ||
            (confermaStatus === 'da_pagare' && !isConfirmed)
        ) : true;

        const caparraMatch = faseCaparra.attiva ? (
            caparraStatus === 'tutti' ||
            (caparraStatus === 'pagato' && hasPaidCaparra) ||
            (caparraStatus === 'da_pagare' && isConfirmed && !hasPaidCaparra)
        ) : true;

        const saldoMatch = faseSaldo.attiva ? (
            saldoStatus === 'tutti' ||
            (saldoStatus === 'pagato' && hasPaidSaldo) ||
            (saldoStatus === 'da_pagare' && isConfirmed && !hasPaidSaldo)
        ) : true;

        return textMatch && groupMatch && confermaMatch && caparraMatch && saldoMatch;
    });
  }, [targetGroupMembers, debouncedSearchTerm, selectedGroup, confermaStatus, caparraStatus, saldoStatus, confermatiIds, caparraPaidIds, saldoPaidIds, faseConferma.attiva, faseCaparra.attiva, faseSaldo.attiva]);
  
  const tableTotals = useMemo(() => {
    const totalPaid = filteredMembers.reduce((sum, member) => sum + calculatePaidTotal(member), 0);
    const totalDue = filteredMembers.reduce((sum, member) => sum + calculateTotal(member), 0);
    return { totalPaid, totalDue };
  }, [filteredMembers]);


  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;

  const columnLabels: { [key in keyof ColumnVisibility]: string } = {
    nomeCognome: "Nome e Cognome",
    gruppo: "Gruppo",
    conferma: "Conferma",
    caparra: "Caparra",
    saldo: "Saldo",
    pagato: "Pagato",
    totale: "Totale",
    allergie: "Allergie",
   };

  const dynamicColumns = ['conferma', 'caparra', 'saldo'];

  const renderPaymentStatusFilter = (
    label: string, 
    status: PaymentStatus, 
    setStatus: (status: PaymentStatus) => void,
    isPhaseActive: boolean
  ) => {
    if (!isPhaseActive) return null;
    return (
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                    <Filter className="mr-2 h-4 w-4" />
                    {label}: {status === 'tutti' ? 'Tutti' : status === 'pagato' ? 'Pagato' : 'Da Pagare'}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
                    <DropdownMenuRadioItem value="tutti">Tutti</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="pagato">Pagato</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="da_pagare">Da Pagare</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
  };
  
    const renderPaymentCell = (memberId: string, phase: 'caparra' | 'saldo') => {
        const isConfirmed = confermatiIds?.includes(memberId) ?? false;
        const paidIds = phase === 'caparra' ? caparraPaidIds : saldoPaidIds;
        const hasPaid = paidIds?.includes(memberId) ?? false;
        
        if (!isConfirmed) {
            return <Hourglass className="h-4 w-4 text-muted-foreground mx-auto" />;
        }
        
        if (hasPaid) {
            const payment = paymentDetails?.[phase]?.[memberId];
            if (payment && payment.receiptUrl) {
                return (
                    <Link href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 justify-center text-green-600 hover:underline">
                        <FileText className="h-4 w-4" />
                        <span className="text-xs font-mono">ACR-{payment.paymentId}</span>
                    </Link>
                );
            }
            // Fallback se non ci sono dettagli di pagamento ma è segnato come pagato
            return <Badge variant="default" className='bg-green-600'>Pagato</Badge>;
        }

        return <Badge variant="outline">Da pagare</Badge>;
    };

  const membersWithAllergie = useMemo(() => {
    return filteredMembers.filter(member => 
        member.allergie && !isNessunaAllergia(member.allergie) &&
        (confermatiIds?.includes(member.id) ?? false)
    );
  }, [filteredMembers, confermatiIds]);

  return (
    <div className='space-y-4'>
        <div className="flex flex-col sm:flex-row gap-2">
            <Input 
                placeholder="Cerca per nome, cognome o gruppo..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 text-base flex-1"
            />
            <div className='flex items-center gap-2'>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                            <Filter className="mr-2 h-4 w-4" />
                             Gruppo: {selectedGroup === 'tutti' ? 'Tutti' : uniqueGroups.find(g => g.id === selectedGroup)?.name || 'Tutti'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Filtra per Gruppo</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={selectedGroup} onValueChange={setSelectedGroup}>
                            <DropdownMenuRadioItem value="tutti">Tutti i gruppi</DropdownMenuRadioItem>
                            {uniqueGroups.map(group => (
                                <DropdownMenuRadioItem key={group.id} value={group.id}>{group.name}</DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                
                {renderPaymentStatusFilter("Conferma", confermaStatus, setConfermaStatus, faseConferma.attiva)}
                {renderPaymentStatusFilter("Caparra", caparraStatus, setCaparraStatus, faseCaparra.attiva)}
                {renderPaymentStatusFilter("Saldo", saldoStatus, setSaldoStatus, faseSaldo.attiva)}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-auto h-8">
                            <Settings className="mr-2 h-4 w-4" />
                            Colonne
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Mostra/Nascondi Colonne</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.keys(columnVisibility).map(key => {
                            const isDynamic = dynamicColumns.includes(key);
                            const isPhaseActive = 
                                (key === 'conferma' && faseConferma.attiva) ||
                                (key === 'caparra' && faseCaparra.attiva) ||
                                (key === 'saldo' && faseSaldo.attiva);

                            if (isDynamic && !isPhaseActive) return null;

                            return (
                            <DropdownMenuCheckboxItem
                                key={key}
                                checked={columnVisibility[key as keyof ColumnVisibility]}
                                onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, [key]: !!value}))}
                            >
                                {columnLabels[key as keyof ColumnVisibility]}
                            </DropdownMenuCheckboxItem>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento membri...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {/* Colonna selezione carrello: solo per tesseramento, per chi può gestire i ghost */}
              {raccolta.tipo === 'tesseramento' && canManageGhosts && (
                <TableHead className="w-10 text-center">Sel.</TableHead>
              )}
              {columnVisibility.nomeCognome && <TableHead>Nome e Cognome</TableHead>}
              {columnVisibility.gruppo && <TableHead>Gruppo</TableHead>}
              {columnVisibility.conferma && faseConferma.attiva && <TableHead className="text-center">Conferma</TableHead>}
              {columnVisibility.caparra && faseCaparra.attiva && <TableHead className="text-center">Caparra</TableHead>}
              {columnVisibility.saldo && faseSaldo.attiva && <TableHead className="text-center">Saldo</TableHead>}
              {columnVisibility.pagato && <TableHead className="text-right">Pagato</TableHead>}
              {columnVisibility.totale && <TableHead className="text-right">Totale</TableHead>}
              {columnVisibility.allergie && <TableHead>Allergie / Intolleranze</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length > 0 ? (
              filteredMembers.map(member => {
                 const isConfirmed = confermatiIds?.includes(member.id) ?? false;
                 const hasPaidCaparra = caparraPaidIds?.includes(member.id) ?? false;
                 const hasPaidSaldo = saldoPaidIds?.includes(member.id) ?? false;
                 const totalAmount = calculateTotal(member);
                 const paidAmount = calculatePaidTotal(member);

                 // Admin o educatori con contabilità possono agire su TUTTI i partecipanti (ghost e reali) di tutti i gruppi
                 // Educatori regolari possono agire solo sui ghost del loro gruppo
                 const canActOnMember =
                   canManageGhosts && (
                     canManageAll ||
                     (member.isPlaceholder && (myEducatorGroupIds?.has(member.groupId ?? '') ?? false))
                   );

                  // Verifica se il membro è già tesserato (non può essere aggiunto al carrello)
                 const isAlreadyTesserated = (raccolta.tesseratiIds ?? []).includes(member.id);

                 // Per il tesseramento: l'educatore può selezionare il membro nel carrello
                 // solo se non è già tesserato e può agire su di lui
                 const canAddToCart = raccolta.tipo === 'tesseramento' && canActOnMember && !isAlreadyTesserated;

                 return (
                    <TableRow key={member.id} className={cartMembers.has(member.id) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}>
                        {/* Checkbox carrello tesseramento */}
                        {raccolta.tipo === 'tesseramento' && canManageGhosts && (
                          <TableCell className="text-center">
                            {isAlreadyTesserated ? (
                              // Già tesserato: icona verde, non selezionabile
                              <span title="Già tesserato">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              </span>
                            ) : canAddToCart ? (
                              <Checkbox
                                checked={cartMembers.has(member.id)}
                                onCheckedChange={() => toggleCartMember(member.id)}
                                aria-label={`Seleziona ${member.nome} ${member.cognome} per il tesseramento`}
                              />
                            ) : (
                              // Non autorizzato
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            )}
                          </TableCell>
                        )}
                        {columnVisibility.nomeCognome && (
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {member.nome} {member.cognome}
                                    {member.isPlaceholder && (
                                        <Badge
                                         variant="outline"
                                         className="text-[10px] text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 px-1.5 py-0 h-4 ml-1 whitespace-nowrap"
                                        >
                                         Ghost
                                        </Badge>
                                    )}
                                    {/* Badge stato tesseramento nella riga */}
                                    {raccolta.tipo === 'tesseramento' && isAlreadyTesserated && (
                                      <Badge className="text-[10px] bg-green-100 text-green-700 border-green-300 px-1.5 py-0 h-4 ml-1 whitespace-nowrap">
                                        Tesserato
                                      </Badge>
                                    )}
                                </div>
                            </TableCell>
                        )}
                        {columnVisibility.gruppo && <TableCell>{member.groupName}</TableCell>}
                        {columnVisibility.conferma && faseConferma.attiva && (
                            <TableCell className="text-center">
                              {canActOnMember ? (
                                <Button
                                  size="sm"
                                  variant={isConfirmed ? 'default' : 'outline'}
                                  className={`h-7 px-2 text-xs ${isConfirmed ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                  onClick={() => onRequestGhostAction?.(member.id, `${member.nome} ${member.cognome}`, 'conferma', isConfirmed, member.isPlaceholder)}
                                >
                                  {isConfirmed
                                    ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Confermato</>
                                    : <><UserCheck className="h-3.5 w-3.5 mr-1" />Conferma</>}
                                </Button>
                              ) : (
                                isConfirmed ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-destructive mx-auto" />
                              )}
                            </TableCell>
                        )}
                        {columnVisibility.caparra && faseCaparra.attiva && (
                             <TableCell className="text-center">
                              {canActOnMember ? (
                                <Button
                                  size="sm"
                                  variant={hasPaidCaparra ? 'default' : 'outline'}
                                  className={`h-7 px-2 text-xs ${hasPaidCaparra ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                  onClick={() => onRequestGhostAction?.(member.id, `${member.nome} ${member.cognome}`, 'caparra', hasPaidCaparra, member.isPlaceholder)}
                                >
                                  {hasPaidCaparra
                                    ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagato</>
                                    : <><Banknote className="h-3.5 w-3.5 mr-1" />Caparra {getGhostAmount ? `€${getGhostAmount(member.id, 'caparra').toFixed(2)}` : ''}</>}
                                </Button>
                              ) : (
                                renderPaymentCell(member.id, 'caparra')
                              )}
                            </TableCell>
                        )}
                        {columnVisibility.saldo && faseSaldo.attiva && (
                           <TableCell className="text-center">
                              {canActOnMember ? (
                                <Button
                                  size="sm"
                                  variant={hasPaidSaldo ? 'default' : 'outline'}
                                  className={`h-7 px-2 text-xs ${hasPaidSaldo ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                  onClick={() => onRequestGhostAction?.(member.id, `${member.nome} ${member.cognome}`, 'saldo', hasPaidSaldo, member.isPlaceholder)}
                                >
                                  {hasPaidSaldo
                                    ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagato</>
                                    : <><Banknote className="h-3.5 w-3.5 mr-1" />Saldo {getGhostAmount ? `€${getGhostAmount(member.id, 'saldo').toFixed(2)}` : ''}</>}
                                </Button>
                              ) : (
                                renderPaymentCell(member.id, 'saldo')
                              )}
                            </TableCell>
                        )}
                        {columnVisibility.pagato && <TableCell className="text-right tabular-nums">€ {paidAmount.toFixed(2)}</TableCell>}
                        {columnVisibility.totale && <TableCell className="text-right tabular-nums">€ {totalAmount.toFixed(2)}</TableCell>}
                        {columnVisibility.allergie && (
                            <TableCell>
                                {member.allergie && !isNessunaAllergia(member.allergie) ? (
                                    <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
                                        {member.allergie}
                                    </span>
                                ) : (
                                    <span className="text-xs text-muted-foreground/50">—</span>
                                )}
                            </TableCell>
                        )}
                    </TableRow>
                 )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="h-24 text-center">
                  Nessun membro corrisponde ai filtri selezionati.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
                <TableCell colSpan={visibleColumnCount - 2}><span className='font-bold'>Totali Filtrati</span></TableCell>
                {columnVisibility.pagato && <TableCell className="text-right font-bold tabular-nums">€ {tableTotals.totalPaid.toFixed(2)}</TableCell>}
                {columnVisibility.totale && <TableCell className="text-right font-bold tabular-nums">€ {tableTotals.totalDue.toFixed(2)}</TableCell>}
            </TableRow>
          </TableFooter>
        </Table>
      )}

      {/* ── Pannello carrello tesseramento ──────────────────────────────────── */}
      {raccolta.tipo === 'tesseramento' && canManageGhosts && cartMembers.size > 0 && (
        <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
          {/* Intestazione carrello */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-700" />
              <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">
                Carrello Tesseramento — {cartMembers.size} {cartMembers.size === 1 ? 'membro selezionato' : 'membri selezionati'}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setCartMembers(new Set())}
              disabled={isCartProcessing}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Svuota
            </Button>
          </div>

          {/* Elenco membri nel carrello con importo e tipo sconto */}
          <div className="space-y-1">
            {Array.from(cartMembers).map(memberId => {
              const member = allMembers.find(m => m.id === memberId);
              if (!member) return null;
              const importo = cartAmounts[memberId] ?? 0;
              const tariffa = tariffe ? getTariffaForMember(member, tariffe) : undefined;

              // Determina etichetta tipo tariffa per capire quale sconto viene applicato
              let tipoLabel = '';
              if (tariffa) {
                if (importo === tariffa.quotaIntera) tipoLabel = 'quota intera';
                else if (importo === tariffa.quotaScontata) tipoLabel = 'quota scontata';
                else if (importo === tariffa.gratuita) tipoLabel = importo === 0 ? 'gratuito' : 'gratuità';
              }

              return (
                <div
                  key={memberId}
                  className="flex items-center justify-between rounded-md bg-white dark:bg-emerald-900/20 border border-emerald-200 px-3 py-2"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => toggleCartMember(memberId)}
                      disabled={isCartProcessing}
                      aria-label={`Rimuovi ${member.nome} ${member.cognome} dal carrello`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-medium text-sm truncate">
                      {member.nome} {member.cognome}
                    </span>
                    {member.isPlaceholder && (
                      <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-300 bg-yellow-50 px-1.5 py-0 h-4 shrink-0">
                        Ghost
                      </Badge>
                    )}
                    {tariffa && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{tariffa.label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tipoLabel && (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                        ({tipoLabel})
                      </span>
                    )}
                    <span className="font-bold text-sm tabular-nums">
                      € {importo.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totale e pulsante conferma */}
          <div className="flex items-center justify-between pt-2 border-t border-emerald-300">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Totale da incassare</span>
              <span className="text-xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                € {cartTotal.toFixed(2)}
              </span>
            </div>
            <Button
              onClick={handleCartConfirm}
              disabled={isCartProcessing || !onBatchTesseramentoConfirm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isCartProcessing ? (
                <>Registrazione in corso...</>
              ) : (
                <>
                  <Banknote className="h-4 w-4" />
                  Conferma incasso contanti — € {cartTotal.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Sezione riepilogo allergie */}
      {membersWithAllergie.length > 0 && (
        <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-orange-800 text-sm">
              Allergie / Intolleranze — Iscritti a questo progetto
            </h3>
          </div>
          <p className="text-xs text-orange-700">
            Di seguito i partecipanti iscritti che hanno dichiarato allergie o intolleranze alimentari.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-200">
                  <th className="text-left py-2 pr-4 font-semibold text-orange-800">Nome e Cognome</th>
                  <th className="text-left py-2 pr-4 font-semibold text-orange-800">Classe / Gruppo</th>
                  <th className="text-left py-2 font-semibold text-orange-800">Allergia / Intolleranza</th>
                </tr>
              </thead>
              <tbody>
                {membersWithAllergie.map(member => (
                  <tr key={member.id} className="border-b border-orange-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-orange-900">
                      {member.nome} {member.cognome}
                    </td>
                    <td className="py-2 pr-4 text-orange-700">
                      {member.groupName || '—'}
                    </td>
                    <td className="py-2">
                      <span className="inline-block text-xs font-semibold text-orange-800 bg-orange-100 border border-orange-300 rounded-full px-3 py-1">
                        ⚠️ {member.allergie}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
