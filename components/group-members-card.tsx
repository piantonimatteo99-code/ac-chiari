'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, User } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
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

  // Load all members and filter in memory since members don't have a reliable groupId field
  // The grouping is stored in the Group's memberIds array instead.
  const membriQuery = useMemoFirebase(() => {
    if (!firestore || !memberIds || memberIds.length === 0) return null;
    return collectionGroup(firestore, 'membri');
  }, [firestore, memberIds]);

  const { data: allMembri, isLoading } = useCollection<Membro>(membriQuery);

  const sorted = useMemo(() => {
    if (!allMembri || !memberIds) return [];
    
    // Create a Set for fast lookup
    const memberIdSet = new Set(memberIds);
    const inGroup = allMembri.filter(m => memberIdSet.has(m.id));

    return inGroup.sort((a, b) => {
      const la = `${a.cognome} ${a.nome}`.toLowerCase();
      const lb = `${b.cognome} ${b.nome}`.toLowerCase();
      return la.localeCompare(lb, 'it');
    });
  }, [allMembri, memberIds]);

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
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(m.dataNascita)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30"
                    >
                      Attivo
                    </Badge>
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
