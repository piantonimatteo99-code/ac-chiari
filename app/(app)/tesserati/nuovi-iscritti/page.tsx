'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, updateDoc, arrayUnion, writeBatch, getDocs, collectionGroup, getDoc } from 'firebase/firestore';
import type { Membro } from '../../nucleo-familiare/page';
import type { Group } from '../../admin/gestione-gruppi/tutti-i-gruppi/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, ArchiveRestore } from 'lucide-react';
import { UserData, useUserData } from '@/src/hooks/use-user-data';
import { Badge } from '@/components/ui/badge';

interface UnifiedMember extends Partial<Membro>, Partial<UserData> {
    id: string;
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    archived?: boolean;
    groupId?: string;
    tesseramento?: number;
}

const getCurrentMembershipYear = () => {
  const today = new Date();
  const month = today.getMonth(); // 0-11 (September is 8)
  return month >= 8 ? today.getFullYear() : today.getFullYear() - 1;
};

export default function NuoviIscrittiPage() {
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

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'gruppi');
  }, [firestore]);
  const { data: groupsData, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);
  
  const unassignedMembers = useMemo(() => {
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
    
    return combinedList.filter(member => {
        const hasRequiredData = !!(member.id && member.nome && member.cognome && member.dataNascita);
        const isNotAssigned = !member.groupId;
        const isNotArchived = member.archived === false || member.archived === undefined;
        return hasRequiredData && isNotAssigned && isNotArchived;
    });
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


  const handleAssignGroup = async (member: UnifiedMember, groupId: string, groupName: string) => {
    if (!firestore || !member.id) return;

    const memberDocRef = await getMemberDocRef(member.id);
    if (!memberDocRef) {
        alert("Impossibile aggiornare il profilo del membro, documento non trovato.");
        return;
    }

    const batch = writeBatch(firestore);

    const groupDocRef = doc(firestore, 'gruppi', groupId);
    batch.update(groupDocRef, {
      memberIds: arrayUnion(member.id)
    });

    batch.update(memberDocRef, {
        groupId: groupId,
        groupName: groupName
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error("Error assigning group with batch write:", error);
      alert(`Si è verificato un errore durante l'assegnazione del gruppo: ${error}`);
    }
  };

  const handleToggleArchive = async (member: UnifiedMember) => {
    if (!firestore || !member.id) return;
    
    const memberDocRef = await getMemberDocRef(member.id);
    if (!memberDocRef) {
        alert("Impossibile archiviare: percorso del documento non trovato.");
        return;
    }

    try {
        await updateDoc(memberDocRef, { archived: true });
    } catch(error) {
        console.error(`Error archiving member ${member.id}:`, error);
        alert(`Si è verificato un errore durante l'archiviazione: ${error}`);
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

  const isLoading = isUserLoading || isLoadingMembers || isLoadingUsers || isLoadingGroups;
  
  const currentMembershipYear = getCurrentMembershipYear();


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
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Nuovi Iscritti</CardTitle>
          <CardDescription>
            Elenco degli utenti e membri familiari non archiviati e non ancora assegnati a un gruppo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cognome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead className="text-center">Gruppo</TableHead>
                <TableHead>Tesserato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Caricamento...</TableCell>
                </TableRow>
              )}
            
              {!isLoading && unassignedMembers.length > 0 ? (
                unassignedMembers.map(member => {
                  const isTesserato = member.tesseramento === currentMembershipYear;
                  return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.nome}</TableCell>
                    <TableCell>{member.cognome}</TableCell>
                    <TableCell>{formatDate(member.dataNascita)}</TableCell>
                    <TableCell className="text-center">
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" disabled={isLoadingGroups || !groupsData}>
                              Assegna
                              <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              {isLoadingGroups ? (
                              <DropdownMenuItem disabled>Caricamento...</DropdownMenuItem>
                              ) : (
                              groupsData && groupsData.length > 0 ? groupsData.map(group => (
                                  <DropdownMenuItem key={group.id} onSelect={() => handleAssignGroup(member, group.id, group.name)}>
                                  {group.name}
                                  </DropdownMenuItem>
                              )) : <DropdownMenuItem disabled>Nessun gruppo disponibile</DropdownMenuItem>
                              )}
                          </DropdownMenuContent>
                          </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      {isTesserato ? (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">Tesserato</Badge>
                      ) : (
                          <Badge variant="destructive">Non Tesserato</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                       <Button 
                          variant='ghost'
                          size="icon" 
                          onClick={() => handleToggleArchive(member)}
                          title={"Archivia Membro"}
                        >
                          <ArchiveRestore className="h-4 w-4" />
                          <span className="sr-only">Archivia</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )})
              ) : (
                !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      Tutti i membri sono stati assegnati a un gruppo o non ci sono nuovi iscritti.
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
