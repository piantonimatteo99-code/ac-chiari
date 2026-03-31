'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, User, Clock } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';

interface GroupMembersCardProps {
  groupId: string;
  groupName: string;
  memberIds: string[];
}

function formatDate(dateString: string) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function GroupMembersCard({ groupId, groupName, memberIds }: GroupMembersCardProps) {
  const firestore = useFirestore();

  // Load real members
  const membriQuery = useMemoFirebase(() => {
    if (!firestore || !memberIds || memberIds.length === 0) return null;
    return collectionGroup(firestore, 'membri');
  }, [firestore, memberIds]);
  const { data: allMembri, isLoading: isLoadingMembri } = useCollection<Membro>(membriQuery);

  // Load imported placeholder members
  const importedQuery = useMemoFirebase(() => {
    if (!firestore || !memberIds || memberIds.length === 0) return null;
    return collection(firestore, 'imported-members');
  }, [firestore, memberIds]);
  // Type as any to accommodate the extra isImported flag
  const { data: allImported, isLoading: isLoadingImported } = useCollection<any>(importedQuery);

  const isLoading = isLoadingMembri || isLoadingImported;

  const sorted = useMemo(() => {
    if (!allMembri && !allImported) return [];
    if (!memberIds) return [];
    
    // Create a Set for fast lookup
    const memberIdSet = new Set(memberIds);
    
    // Combine real members and imported placeholders
    const combined = [
      ...(allMembri || []),
      ...(allImported || [])
    ];

    const inGroup = combined.filter(m => memberIdSet.has(m.id));

    return inGroup.sort((a, b) => {
      const la = `${a.cognome} ${a.nome}`.toLowerCase();
      const lb = `${b.cognome} ${b.nome}`.toLowerCase();
      return la.localeCompare(lb, 'it');
    });
  }, [allMembri, allImported, memberIds]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          Componenti del Gruppo
        </CardTitle>
        <CardDescription>
          {isLoading
            ? 'Caricamento...'
            : `${sorted.length} ${sorted.length === 1 ? 'componente iscritto' : 'componenti iscritti'} al gruppo ${groupName}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Data di Nascita</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Caricamento ragazzi...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nessun ragazzo iscritto a questo gruppo.</p>
                  <p className="text-xs mt-1">I ragazzi vengono assegnati al gruppo tramite la gestione del nucleo familiare.</p>
                </TableCell>
              </TableRow>
            )}
            {sorted.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.cognome} {m.nome}
                    {m.isImported && (
                       <span className="ml-2 inline-flex items-center gap-1 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800">
                         <Clock className="w-3 h-3" />
                         Dal Database
                       </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(m.dataNascita)}
                  </TableCell>
                  <TableCell>
                    {m.isImported ? (
                      <Badge
                        variant="outline"
                        className="text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30"
                      >
                        Da confermare
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30"
                      >
                        Attivo
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
