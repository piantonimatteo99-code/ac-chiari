'use client';

import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import type { UserData } from '@/src/hooks/use-user-data';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';
import type { Raccolta } from './raccolta-card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from './ui/dropdown-menu';
import { Settings, Filter, CheckCircle2, XCircle, Hourglass, FileText } from 'lucide-react';
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
}
interface MembriRaccoltaListProps {
  raccolta: Raccolta;
  targetGroupMembers: UnifiedMember[];
  allMembers: UnifiedMember[]; // All members from all families
  isLoading: boolean;
}


type ColumnVisibility = {
    [key: string]: boolean;
    nomeCognome: boolean;
    gruppo: boolean;
    conferma: boolean;
    caparra: boolean;
    saldo: boolean;
    pagato: boolean;
    totale: boolean;
};

type PaymentStatus = 'tutti' | 'pagato' | 'da_pagare';


export function MembriRaccoltaList({ raccolta, targetGroupMembers, allMembers, isLoading }: MembriRaccoltaListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

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

  const calculateTotal = (member: UnifiedMember): number => {
    const isConfirmed = confermatiIds?.includes(member.id) ?? false;
    if (!isConfirmed) return 0;
    
    let total = 0;
    
    const confermaImporto = parseFloat(faseConferma.importo) || 0;
    const caparraImporto = parseFloat(faseCaparra.importo) || 0;
    
    let saldoImporto = parseFloat(faseSaldo.importo) || 0;
    
    if (faseSaldo.tariffaFratelliAttiva && member.familyId && (familyCounts[member.familyId] || 0) >= 2) {
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

    if (faseConferma.attiva) {
        paidTotal += parseFloat(faseConferma.importo) || 0;
    }
    if (faseCaparra.attiva && hasPaidCaparra) {
        paidTotal += parseFloat(faseCaparra.importo) || 0;
    }
    if (faseSaldo.attiva && hasPaidSaldo) {
        let saldoImporto = parseFloat(faseSaldo.importo) || 0;
        if (faseSaldo.tariffaFratelliAttiva && member.familyId && (familyCounts[member.familyId] || 0) >= 2) {
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
              {columnVisibility.nomeCognome && <TableHead>Nome e Cognome</TableHead>}
              {columnVisibility.gruppo && <TableHead>Gruppo</TableHead>}
              {columnVisibility.conferma && faseConferma.attiva && <TableHead className="text-center">Conferma</TableHead>}
              {columnVisibility.caparra && faseCaparra.attiva && <TableHead className="text-center">Caparra</TableHead>}
              {columnVisibility.saldo && faseSaldo.attiva && <TableHead className="text-center">Saldo</TableHead>}
              {columnVisibility.pagato && <TableHead className="text-right">Pagato</TableHead>}
              {columnVisibility.totale && <TableHead className="text-right">Totale</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length > 0 ? (
              filteredMembers.map(member => {
                 const isConfirmed = confermatiIds?.includes(member.id) ?? false;
                 const totalAmount = calculateTotal(member);
                 const paidAmount = calculatePaidTotal(member);

                 return (
                    <TableRow key={member.id}>
                        {columnVisibility.nomeCognome && <TableCell className="font-medium">{member.nome} {member.cognome}</TableCell>}
                        {columnVisibility.gruppo && <TableCell>{member.groupName}</TableCell>}
                        {columnVisibility.conferma && faseConferma.attiva && (
                            <TableCell className="text-center">
                                {isConfirmed ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-destructive mx-auto" />}
                            </TableCell>
                        )}
                        {columnVisibility.caparra && faseCaparra.attiva && (
                             <TableCell className="text-center">
                                {renderPaymentCell(member.id, 'caparra')}
                            </TableCell>
                        )}
                        {columnVisibility.saldo && faseSaldo.attiva && (
                           <TableCell className="text-center">
                                {renderPaymentCell(member.id, 'saldo')}
                            </TableCell>
                        )}
                        {columnVisibility.pagato && <TableCell className="text-right tabular-nums">€ {paidAmount.toFixed(2)}</TableCell>}
                        {columnVisibility.totale && <TableCell className="text-right tabular-nums">€ {totalAmount.toFixed(2)}</TableCell>}
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
    </div>
  );
}
