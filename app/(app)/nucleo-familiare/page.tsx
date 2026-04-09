'use client';


import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { AddFamiliareDialog } from '@/components/add-familiare-dialog';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/src/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { PageTutorial } from '@/components/page-tutorial';

export interface Membro {
  id: string;
  nome: string;
  cognome: string;
  dataNascita: string;
  codiceFiscale: string;
  luogoNascita: string;
  telefonoPrincipale: string;
  telefonoSecondario: string;
  allergie?: string;
  createdAt?: any;
  groupId?: string;
  groupName?: string;
  tesseramento?: number;
  consenso?: boolean;     // Consenso unificato: foto + social (default: true)
  // Campi legacy (backward compat)
  consensoFoto?: boolean;
  consensoSocial?: boolean;
}

export default function NucleoFamiliarePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
  const [membroToDelete, setMembroToDelete] = useState<Membro | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserDataLoading, resolvedFamilyId } = useUserData();

  // Use resolvedFamilyId so that linked family members read from the correct family
  const famigliaId = resolvedFamilyId ?? user?.uid;
  const [familyAddress, setFamilyAddress] = useState('Nessun indirizzo specificato');

  const famigliaDocRef = useMemoFirebase(() => {
    if (!famigliaId || !firestore) return null;
    return doc(firestore, 'famiglie', famigliaId);
  }, [famigliaId, firestore]);
  
  const { data: famigliaData, isLoading: isFamigliaLoading } = useDoc(famigliaDocRef);

  // Una volta caricato il documento famiglia, impostiamo l'indirizzo
  useEffect(() => {
    if (famigliaData) {
      const { via, numeroCivico, citta, provincia, cap } = famigliaData;
      if (via && citta) {
        setFamilyAddress(`${via} ${numeroCivico || ''}, ${cap || ''} ${citta} (${provincia || ''})`);
      } else {
        setFamilyAddress('Indirizzo non ancora specificato');
      }
    } else if (!isFamigliaLoading && userData) {
       const { via, numeroCivico, citta, provincia, cap } = userData;
       if (via && citta) {
          setFamilyAddress(`${via} ${numeroCivico || ''}, ${cap || ''} ${citta} (${provincia || ''})`);
       } else {
          setFamilyAddress('Indirizzo non ancora specificato');
       }
    }
  }, [famigliaData, isFamigliaLoading, userData]);

  const membriQuery = useMemoFirebase(() => {
    if (!famigliaId || !firestore) return null;
    return collection(firestore, 'famiglie', famigliaId, 'membri');
  }, [famigliaId, firestore]);

  const { data: membri, isLoading: isMembriLoading, error } = useCollection<Membro>(membriQuery);
  
  const isLoading = isUserDataLoading || isFamigliaLoading || isMembriLoading;

  // Determine if a member record corresponds to the logged-in user (to show badge)
  const ownMemberName = useMemo(() => {
    if (!userData) return null;
    return `${userData.nome ?? ''} ${userData.cognome ?? ''}`.trim().toLowerCase();
  }, [userData]);

  const handleEdit = (membro: Membro) => {
    setEditingMembro(membro);
    setIsDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingMembro(null);
    setIsDialogOpen(true);
  }

  const handleDelete = useCallback(async () => {
    if (!firestore || !famigliaId || !membroToDelete) return;

    try {
      const docRef = doc(firestore, 'famiglie', famigliaId, 'membri', membroToDelete.id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      alert("Si è verificato un errore.");
    }
  }, [firestore, famigliaId, membroToDelete]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nucleo Familiare</h1>
        <Button onClick={handleAddNew} disabled={!user}>
          <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Membro
        </Button>
      </div>
      
      {user && userData && (
        <AddFamiliareDialog 
          isOpen={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
          membroToEdit={editingMembro}
          user={user}
          userData={userData}
        />
      )}
      
      <ConfirmationDialog
        isOpen={!!membroToDelete}
        onOpenChange={(isOpen) => !isOpen && setMembroToDelete(null)}
        title="Conferma Eliminazione"
        description={`Sei sicuro di voler eliminare ${membroToDelete?.nome} ${membroToDelete?.cognome} dalla famiglia?`}
        onConfirm={handleDelete}
        confirmLabel="Elimina"
        confirmVariant="destructive"
      />


      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead className="hidden md:table-cell">Indirizzo</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Caricamento...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && membri && membri.length > 0 ? (
                membri.map((membro) => {
                  const memberName = `${membro.nome ?? ''} ${membro.cognome ?? ''}`.trim().toLowerCase();
                  const isOwnRecord = ownMemberName && memberName === ownMemberName;
                  return (
                  <TableRow
                    key={membro.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleEdit(membro)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {membro.nome} {membro.cognome}
                        {isOwnRecord && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Il mio profilo</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(membro.dataNascita)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{familyAddress}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => handleEdit(membro)}>Modifica</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setMembroToDelete(membro)}>Elimina</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              ) : (
                !isLoading && (
                  <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Nessun membro trovato. Aggiungine uno per creare la tua famiglia.
                    </TableCell>
                  </TableRow>
                )
              )}
               {error && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-destructive">
                    Si è verificato un errore nel caricamento dei dati. 
                    Potrebbe essere un problema di permessi o l'indirizzo non è stato ancora salvato.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info nota per capofamiglia */}
      {!isLoading && membri && membri.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Clicca su un membro per modificare in qualsiasi momento anagrafica, allergie e consensi fotografici.
        </p>
      )}

      <PageTutorial
        pageId="nucleo-familiare"
        steps={[
          {
            icon: '👨‍👩‍👧‍👦',
            title: 'Il tuo Nucleo Familiare',
            description: 'Questa pagina è il centro di gestione della tua famiglia. Qui puoi inserire te stesso, i tuoi figli o parenti.',
          },
          {
            icon: '➕',
            title: 'Aggiungi un membro',
            description: 'Premi "Nuovo Membro" per aggiungere una persona. Ti verrà chiesto di compilare i suoi dati anagrafici e sanitari essenziali.',
          },
          {
            icon: '✏️',
            title: 'Gestione e Privacy',
            description: 'I dati restano strettamente confidenziali. Puoi modificare in ogni momento consensi e referenze contattate cliccando "Modifica" sul nome della persona.',
          }
        ]}
      />
    </div>
  );
}
