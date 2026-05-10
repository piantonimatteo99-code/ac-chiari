'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, updateDoc, getDocs, collectionGroup, writeBatch, arrayRemove, deleteField, arrayUnion, query, where, getDoc, limit } from 'firebase/firestore';
import type { Membro } from '../../nucleo-familiare/page';
import type { Group } from '../../admin/gestione-gruppi/tutti-i-gruppi/page';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Archive, UserX, Move, Filter } from 'lucide-react';
import { UserData, useUserData } from '@/src/hooks/use-user-data';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDebounce } from 'use-debounce';

interface UnifiedMember extends Partial<Membro>, Partial<UserData> {
    id: string;
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    archived?: boolean;
    groupId?: string;
    groupName?: string;
    tesseramento?: number;
}

const getCurrentMembershipYear = () => {
  const today = new Date();
  const month = today.getMonth(); // 0-11 (September is 8)
  return month >= 8 ? today.getFullYear() : today.getFullYear() - 1;
};

export default function TesseratiSubPage() {
  const firestore = useFirestore();
  const { userData, isLoading: isUserLoading } = useUserData();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [selectedGroup, setSelectedGroup] = useState('tutti');
  const [tesseratoStatus, setTesseratoStatus] = useState<'tutti' | 'tesserato' | 'non_tesserato'>('tutti');


  const isAdmin = useMemo(() => userData?.roles?.includes('admin'), [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore'), [userData]);

  const allMembersQuery = useMemoFirebase(() => {
    if (!firestore || (!isAdmin && !isEducatore)) return null;
    return query(collectionGroup(firestore, 'membri'), limit(1000));
  }, [firestore, isAdmin, isEducatore]);
  const { data: allMembersData, isLoading: isLoadingMembers } = useCollection<any>(allMembersQuery, { includeRef: true });

  const allUsersQuery = useMemoFirebase(() => {
    if (!firestore || (!isAdmin && !isEducatore)) return null;
    return query(collection(firestore, 'users'), limit(1000));
  }, [firestore, isAdmin, isEducatore]);
  const { data: allUsersData, isLoading: isLoadingUsers } = useCollection<UserData>(allUsersQuery, { includeRef: true });

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'gruppi');
  }, [firestore]);
  const { data: groupsData, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);

  // Ghost (placeholder) importati — non ancora matchati con un utente reale
  const importedMembersQuery = useMemoFirebase(() => {
    if (!firestore || (!isAdmin && !isEducatore)) return null;
    return collection(firestore, 'imported-members');
  }, [firestore, isAdmin, isEducatore]);
  const { data: importedMembersData, isLoading: isLoadingImported } = useCollection<any>(importedMembersQuery);


  const assignedMembers = useMemo(() => {
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
        processedIds.add(member.id);
      }
    });

    // Aggiungi i ghost (imported-members non ancora matchati)
    // Il loro groupId va ricavato scorrendo i memberIds dei gruppi
    if (importedMembersData && groupsData) {
      // Mappa: ghostId -> group
      const ghostGroupMap = new Map<string, Group>();
      groupsData.forEach(group => {
        (group.memberIds ?? []).forEach(mid => ghostGroupMap.set(mid, group));
      });

      importedMembersData.forEach(ghost => {
        if (!ghost.id || processedIds.has(ghost.id)) return;
        // Escludi già matchati
        if (ghost.matchedWith) return;
        const group = ghostGroupMap.get(ghost.id);
        if (!group) return; // senza gruppo non compare in Tesserati
        combinedList.push({
          id: ghost.id,
          nome: ghost.nome,
          cognome: ghost.cognome,
          dataNascita: ghost.dataNascita,
          groupId: group.id,
          groupName: group.name,
          archived: false,
          tesseramento: ghost.tesseramento,
        });
        processedIds.add(ghost.id);
      });
    }

    return combinedList.filter(member => {
      const isAssigned = !!member.groupId;
      const isNotArchived = member.archived === false || member.archived === undefined;
      return isAssigned && isNotArchived;
    });
  }, [allUsersData, allMembersData, importedMembersData, groupsData]);
  
  const currentMembershipYear = getCurrentMembershipYear();

  const filteredMembers = useMemo(() => {
    const lowercasedFilter = debouncedSearchTerm.toLowerCase();
    
    return assignedMembers.filter(member => {
        const searchMatch = lowercasedFilter
            ? `${member.nome} ${member.cognome}`.toLowerCase().includes(lowercasedFilter)
            : true;
        
        const groupMatch = selectedGroup === 'tutti' || member.groupId === selectedGroup;

        const isTesserato = member.tesseramento === currentMembershipYear;
        const statusMatch = tesseratoStatus === 'tutti' ||
            (tesseratoStatus === 'tesserato' && isTesserato) ||
            (tesseratoStatus === 'non_tesserato' && !isTesserato);

        return searchMatch && groupMatch && statusMatch;
    });
  }, [assignedMembers, debouncedSearchTerm, selectedGroup, tesseratoStatus, currentMembershipYear]);

  const getMemberDocRef = async (memberId: string): Promise<any | null> => {
    if (!firestore || !memberId) return null;

    // 1. Controlla prima se è un utente principale tra i dati già caricati
    const userMatch = allUsersData?.find(u => u.id === memberId);
    if (userMatch) {
        return doc(firestore, 'users', memberId);
    }

    // 2. Controlla se è un membro familiare tra i dati già caricati
    const memberMatch = allMembersData?.find(m => m.id === memberId);
    if (memberMatch && memberMatch.ref) {
        return memberMatch.ref;
    }

    // 3. Controlla se è un ghost importato
    const ghostMatch = importedMembersData?.find(g => g.id === memberId);
    if (ghostMatch) {
        return doc(firestore, 'imported-members', memberId);
    }

    // 4. Fallback: cerca esplicitamente l'utente su Firestore se non in memoria (raro)
    const userDocRef = doc(firestore, 'users', memberId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocRef;
    }

    console.error("Could not find document reference for member:", memberId);
    return null;
  };

  const handleToggleArchive = async (member: UnifiedMember) => {
    if (!firestore || !member.id) {
      alert("ID membro o database non disponibile.");
      return;
    }
    
    const memberDocRef = await getMemberDocRef(member.id);
    if (!memberDocRef) {
      alert("Impossibile archiviare: percorso del documento non trovato.");
      return;
    }

    const batch = writeBatch(firestore);

    // 1. Set archived to true
    batch.update(memberDocRef, { 
        archived: true,
        groupId: deleteField(),
        groupName: deleteField()
    });

    // 2. If the member is in a group, remove them from it
    if (member.groupId) {
        const groupDocRef = doc(firestore, 'gruppi', member.groupId);
        batch.update(groupDocRef, {
            memberIds: arrayRemove(member.id)
        });
    }

    try {
        await batch.commit();
    } catch (error) {
        console.error(`Error archiving member ${member.id}:`, error);
        alert(`Si è verificato un errore durante l'archiviazione: ${error}`);
    }
  };

  const handleRemoveFromGroup = async (member: UnifiedMember) => {
    if (!firestore || !member.id || !member.groupId) {
        alert("Dati mancanti per rimuovere il membro dal gruppo.");
        return;
    }
    
    const memberDocRef = await getMemberDocRef(member.id);
    if (!memberDocRef) {
        alert("Impossibile aggiornare il profilo del membro, documento non trovato.");
        return;
    }

    const batch = writeBatch(firestore);

    const groupDocRef = doc(firestore, 'gruppi', member.groupId);
    batch.update(groupDocRef, {
      memberIds: arrayRemove(member.id)
    });

    batch.update(memberDocRef, {
        groupId: deleteField(),
        groupName: deleteField()
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error("Error removing from group with batch write:", error);
      alert(`Si è verificato un errore durante la rimozione dal gruppo: ${error}`);
    }
  };

  const handleChangeGroup = async (member: UnifiedMember, newGroupId: string, newGroupName: string) => {
    if (!firestore || !member.id || !member.groupId || newGroupId === member.groupId) return;

    const memberDocRef = await getMemberDocRef(member.id);
    if (!memberDocRef) {
        alert("Impossibile aggiornare il profilo del membro, documento non trovato.");
        return;
    }

    const batch = writeBatch(firestore);

    // 1. Remove from old group
    const oldGroupDocRef = doc(firestore, 'gruppi', member.groupId);
    batch.update(oldGroupDocRef, { memberIds: arrayRemove(member.id) });

    // 2. Add to new group
    const newGroupDocRef = doc(firestore, 'gruppi', newGroupId);
    batch.update(newGroupDocRef, { memberIds: arrayUnion(member.id) });

    // 3. Update member's document
    batch.update(memberDocRef, {
        groupId: newGroupId,
        groupName: newGroupName
    });

    try {
        await batch.commit();
    } catch (error) {
        console.error("Error changing group with batch write:", error);
        alert(`Si è verificato un errore during lo spostamento del gruppo: ${error}`);
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

  const isLoading = isUserLoading || isLoadingMembers || isLoadingUsers || isLoadingGroups || isLoadingImported;

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
        <CardTitle>Elenco Tesserati</CardTitle>
        <CardDescription>
          Elenco di tutti i membri (utenti e familiari) attualmente assegnati a un gruppo.
        </CardDescription>
        <div className="flex items-center gap-4 pt-4">
          <div className="flex-1">
            <Input
              placeholder="Cerca per nome o cognome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10">
                  <Filter className="mr-2 h-4 w-4" />
                  Gruppo: {selectedGroup === 'tutti' ? 'Tutti' : groupsData?.find((g) => g.id === selectedGroup)?.name || ''}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={selectedGroup} onValueChange={setSelectedGroup}>
                  <DropdownMenuRadioItem value="tutti">Tutti i gruppi</DropdownMenuRadioItem>
                  {groupsData?.map((group) => (
                    <DropdownMenuRadioItem key={group.id} value={group.id}>
                      {group.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10">
                  <Filter className="mr-2 h-4 w-4" />
                  Stato: {tesseratoStatus === 'tutti' ? 'Tutti' : tesseratoStatus === 'tesserato' ? 'Tesserato' : 'Non Tesserato'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={tesseratoStatus} onValueChange={(v) => setTesseratoStatus(v as any)}>
                  <DropdownMenuRadioItem value="tutti">Tutti</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="tesserato">Tesserato</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="non_tesserato">Non Tesserato</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cognome</TableHead>
              <TableHead>Data di Nascita</TableHead>
              <TableHead>Gruppo</TableHead>
              <TableHead>Tesserato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Caricamento tesserati...</TableCell>
              </TableRow>
            )}
            {!isLoading && filteredMembers.length > 0 ? (
              filteredMembers.map(member => {
                const isTesserato = member.tesseramento === currentMembershipYear;
                return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.nome}</TableCell>
                  <TableCell>{member.cognome}</TableCell>
                  <TableCell>{formatDate(member.dataNascita)}</TableCell>
                  <TableCell>{member.groupName || 'Non specificato'}</TableCell>
                  <TableCell>
                    {isTesserato ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">Tesserato</Badge>
                    ) : (
                        <Badge variant="destructive">Non Tesserato</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Apri menu azioni</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Move className="mr-2 h-4 w-4" />
                                Sposta nel gruppo
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    {isLoadingGroups ? (
                                        <DropdownMenuItem disabled>Caricamento...</DropdownMenuItem>
                                    ) : (
                                        groupsData && groupsData
                                            .filter(g => g.id !== member.groupId)
                                            .map(group => (
                                            <DropdownMenuItem key={group.id} onSelect={() => handleChangeGroup(member, group.id, group.name)}>
                                                {group.name}
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                     {groupsData?.filter(g => g.id !== member.groupId).length === 0 && (
                                        <DropdownMenuItem disabled>Nessun altro gruppo</DropdownMenuItem>
                                     )}
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuItem onSelect={() => handleRemoveFromGroup(member)}>
                          <UserX className="mr-2 h-4 w-4" />
                          Rimuovi dal gruppo
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleToggleArchive(member)} className="text-destructive">
                          <Archive className="mr-2 h-4 w-4" />
                          Archivia
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )})
            ) : (
              !isLoading && (
                <TableRow>
                   <TableCell colSpan={6} className="h-24 text-center">
                    {debouncedSearchTerm || selectedGroup !== 'tutti' || tesseratoStatus !== 'tutti'
                        ? "Nessun membro corrisponde ai filtri selezionati."
                        : "Nessun membro tesserato trovato."
                    }
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
