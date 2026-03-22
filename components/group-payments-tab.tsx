'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Coins, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';

interface Raccolta {
  id: string;
  nome: string;
  descrizione?: string;
  importo?: number;
  scadenza?: any;
  groupIds?: string[];
  stato?: 'attiva' | 'conclusa';
  memberIds?: string[];
  payments?: { membroId: string; amount: number; date: any; note?: string }[];
}

interface GroupPaymentsTabProps {
  groupId: string;
  memberIds: string[];
}

function formatDate(ts: any): string {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return format(d, 'd MMM yyyy', { locale: itLocale });
}

function formatEuro(amount?: number): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function GroupPaymentsTab({ groupId, memberIds }: GroupPaymentsTabProps) {
  const firestore = useFirestore();

  const raccoltaQuery = useMemoFirebase(() => {
    if (!firestore || !groupId) return null;
    return query(
      collection(firestore, 'raccolte'),
      where('groupIds', 'array-contains', groupId)
    );
  }, [firestore, groupId]);

  const { data: raccolte, isLoading } = useCollection<Raccolta>(raccoltaQuery);

  const activeRaccolte = useMemo(() => {
    if (!raccolte) return [];
    return raccolte.filter(r => r.stato !== 'conclusa');
  }, [raccolte]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Coins className="h-5 w-5 animate-pulse" />
        <span>Caricamento pagamenti...</span>
      </div>
    );
  }

  if (activeRaccolte.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-muted-foreground">
          <Coins className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nessun pagamento attivo per questo gruppo</p>
          <p className="text-xs mt-1">
            Le raccolte fondi associate al gruppo appariranno qui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {activeRaccolte.map(raccolta => {
        const paidIds = new Set(
          (Array.isArray(raccolta.payments) ? raccolta.payments : []).map(p => p.membroId)
        );
        const memberPaidCount = memberIds.filter(id => paidIds.has(id)).length;
        const allPaid = memberPaidCount === memberIds.length && memberIds.length > 0;

        return (
          <Card key={raccolta.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Coins className="h-4 w-4 text-amber-500" />
                    {raccolta.nome}
                  </CardTitle>
                  {raccolta.descrizione && (
                    <CardDescription className="mt-1">{raccolta.descrizione}</CardDescription>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {raccolta.importo != null && (
                    <span className="text-lg font-bold">{formatEuro(raccolta.importo)}</span>
                  )}
                  {raccolta.scadenza && (
                    <span className="text-xs text-muted-foreground">
                      Scadenza: {formatDate(raccolta.scadenza)}
                    </span>
                  )}
                  <Badge variant={allPaid ? 'default' : 'secondary'} className={allPaid ? 'bg-green-600' : ''}>
                    {memberPaidCount}/{memberIds.length} pagato
                  </Badge>
                </div>
              </div>
            </CardHeader>

            {memberIds.length > 0 && (
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Componente</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data pagamento</TableHead>
                      <TableHead>Importo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberIds.map(memberId => {
                      const payment = (raccolta.payments ?? []).find(p => p.membroId === memberId);
                      const paid = !!payment;
                      // We don't have names here from memberIds only — show ID fallback
                      return (
                        <TableRow key={memberId}>
                          <TableCell className="font-medium text-muted-foreground text-xs font-mono">
                            #{memberId.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            {paid ? (
                              <Badge variant="outline" className="text-green-600 border-green-300 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Pagato
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                                <AlertCircle className="h-3 w-3" /> In attesa
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment ? formatDate(payment.date) : '—'}
                          </TableCell>
                          <TableCell>
                            {payment ? formatEuro(payment.amount) : raccolta.importo != null ? formatEuro(raccolta.importo) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
