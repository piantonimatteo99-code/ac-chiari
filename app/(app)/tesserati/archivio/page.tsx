'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, updateDoc, getDocs, collectionGroup, getDoc } from 'firebase/firestore';
import type { Membro } from '../../nucleo-familiare/page';
import { Button } from '@/components/ui/button';
import { ArchiveRestore } from 'lucide-react';
import { UserData, useUserData } from '@/src/hooks/use-user-data';

interface UnifiedMember extends Partial<Membro>, Partial<UserData> {
    id: string;
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    archived?: boolean;
}

export default function ArchivioPage() {
  const firestore = useFirestore();
  const { userData, isLoading: isUserLoading } = useUserData();
  
  const isAdmin = useMemo(() => userData?.roles?.includes('admin'), [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore'), [userData]);

  const allMembersQuery = useMemoFirebase(() => {
    if (!firestore || (!isAdmin && !isEducatore)) return null;
    return collectionGroup(firestore, 'membri');
  }, [firestore, isAdmin, isEducatore]);
  const { data: allMembersData, isLoading: isLoadingMembers } = useCollection<any>(allMembersQuery);

  const allUsersQuery = useMemoFirebase(() => {
    if (!firestore || (!isAdmin && !isEducatore)) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdmin, isEducatore]);
  const { data: allUsersData, isLoading: isLoadingUsers } = useCollection<UserData>(allUsersQuery);

  const archivedMembers = useMemo(() => {
    if (!allUsersData || !allMembersData) return [];
    
    const combinedList: UnifiedMember[] = [];
    const processedIds = new Set<string>();

    allUsersData.forEach(user => {
      if (user.id) { 
        combinedList.push({ ...user });
        processedIds.add(user.id);
      }
    });

    allMembersData.forEach(member => {
      if (member.id && !processedIds.has(member.id)) { 
        combinedList.push({ ...member });
      }
    });
    
    return combinedList.filter(member => member.archived === true);
}, [allUsersData, allMembersData]);

  const getMemberDocRef = async (memberId: string): Promise<any | null> => {
    if (!firestore || !memberId) return null;
    
    const userDocRef = doc(firestore, 'users', memberId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocRef;
    }

    const membersSnapshot = await getDocs(collectionGroup(firestore, 'membri'));
    const memberDoc = membersSnapshot.docs.find(doc => doc.id === memberId);

    if (memberDoc) {
        return memberDoc.ref;
    }

    console.error("Could not find document reference for member:", memberId);
    return null;
  };

  const handleToggleArchive = async (member: UnifiedMember) => {
    if (!firestore || !member.id) return;
    
    const memberDocRef = await getMemberDocRef(member.id);
    if (!memberDocRef) {
        alert("Impossibile ripristinare: percorso del documento non trovato.");
        return;
    }

    try {
        await updateDoc(memberDocRef, { archived: false });
    } catch(error) {
        console.error(`Error un-archiving member ${member.id}:`, error);
        alert(`Si è verificato un errore durante il ripristino: ${error}`);
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/D';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data non valida';
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return 'Data non valida';
    }
  };

  const isLoading = isUserLoading || isLoadingMembers || isLoadingUsers;

  if (!isUserLoading && !isAdmin && !isEducatore) {
     return (
        <Card>
            <CardHeader>
                <CardTitle>Accesso Negato</CardTitle>
                <CardDescription>Non hai i permessi per visualizzare questa sezione.</CardDescription>
            </CardHeader>
        </Card>
     )
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Archivio Iscritti</CardTitle>
            <CardDescription>Elenco di tutti i membri (utenti e familiari) contrassegnati come archiviati.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cognome</TableHead>
                        <TableHead>Data di Nascita</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center">Caricamento archivio...</TableCell>
                        </TableRow>
                    )}
                    {!isLoading && archivedMembers.length > 0 ? (
                        archivedMembers.map(member => (
                            <TableRow key={member.id}>
                                <TableCell>{member.nome}</TableCell>
                                <TableCell>{member.cognome}</TableCell>
                                <TableCell>{formatDate(member.dataNascita)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleToggleArchive(member)}>
                                        <ArchiveRestore className="h-4 w-4" />
                                        <span className="sr-only">Ripristina</span>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                         !isLoading && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">L'archivio è vuoto.</TableCell>
                            </TableRow>
                         )
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
}
