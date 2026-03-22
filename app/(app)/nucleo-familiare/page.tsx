'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
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
import { MoreHorizontal, PlusCircle, Camera, Share2, CheckCircle2, XCircle } from "lucide-react";
import { AddFamiliareDialog } from '@/components/add-familiare-dialog';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/src/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { ConfirmationDialog } from '@/components/confirmation-dialog';

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
  consensoFoto?: boolean;   // Autorizzazione pubblicazione foto
  consensoSocial?: boolean; // Autorizzazione divulgazione su social media
}

export default function NucleoFamiliarePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
  const [membroToDelete, setMembroToDelete] = useState<Membro | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserDataLoading } = useUserData();

  const famigliaId = user?.uid; // L'ID della famiglia è ora l'UID dell'utente
  const [familyAddress, setFamilyAddress] = useState('Nessun indirizzo specificato');

  // Il documento famiglia è direttamente referenziato dall'UID dell'utente
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

  // Query per ottenere i membri dalla sotto-collezione, si attiva solo quando abbiamo un famigliaId
  const membriQuery = useMemoFirebase(() => {
    if (!famigliaId || !firestore) return null;
    return collection(firestore, 'famiglie', famigliaId, 'membri');
  }, [famigliaId, firestore]);

  const { data: membri, isLoading: isMembriLoading, error } = useCollection<Membro>(membriQuery);
  
  const isLoading = isUserDataLoading || isFamigliaLoading || isMembriLoading;
  

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
                <TableHead className="text-center" title="Consenso foto">
                  <span className="flex items-center justify-center gap-1">
                    <Camera className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Foto</span>
                  </span>
                </TableHead>
                <TableHead className="text-center" title="Consenso social media">
                  <span className="flex items-center justify-center gap-1">
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Social</span>
                  </span>
                </TableHead>
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
                membri.map((membro) => (
                  <TableRow
                    key={membro.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleEdit(membro)}
                  >
                    <TableCell className="font-medium">{membro.nome} {membro.cognome}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(membro.dataNascita)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{familyAddress}</TableCell>
                    {/* Consenso Foto */}
                    <TableCell className="text-center">
                      {membro.consensoFoto ? (
                        <span title="Consenso foto concesso">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        </span>
                      ) : (
                        <span title="Consenso foto non concesso">
                          <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        </span>
                      )}
                    </TableCell>
                    {/* Consenso Social */}
                    <TableCell className="text-center">
                      {membro.consensoSocial ? (
                        <span title="Consenso social concesso">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        </span>
                      ) : (
                        <span title="Consenso social non concesso">
                          <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        </span>
                      )}
                    </TableCell>
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
                ))
              ) : (
                !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nessun membro trovato. Aggiungine uno per creare la tua famiglia.
                    </TableCell>
                  </TableRow>
                )
              )}
               {error && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-destructive">
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
    </div>
  );
}
