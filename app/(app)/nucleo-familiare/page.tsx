'use client';

import { useState, useEffect } from 'react';
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
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { AddFamiliareDialog } from '@/components/add-familiare-dialog';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/src/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';

export interface Membro {
  id: string;
  nome: string;
  cognome: string;
  dataNascita: string;
  codiceFiscale: string;
  luogoNascita: string;
  telefonoPrincipale: string;
  telefonoSecondario: string;
  createdAt?: any;
}

export default function NucleoFamiliarePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
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
  
  const isLoading = isUserDataLoading || (famigliaId ? isMembriLoading : false);
  

  const handleEdit = (membro: Membro) => {
    setEditingMembro(membro);
    setIsDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingMembro(null);
    setIsDialogOpen(true);
  }

  const handleDelete = async (membroId: string) => {
    if (!firestore || !famigliaId) return;
    if (window.confirm("Sei sicuro di voler eliminare questo membro della famiglia?")) {
      try {
        const docRef = doc(firestore, 'famiglie', famigliaId, 'membri', membroId);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Errore durante l'eliminazione:", error);
        alert("Si è verificato un errore.");
      }
    }
  };

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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead>Indirizzo Condiviso</TableHead>
                <TableHead>Stato</TableHead>
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
                  <TableRow key={membro.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{membro.nome} {membro.cognome}</TableCell>
                    <TableCell>{formatDate(membro.dataNascita)}</TableCell>
                    <TableCell>{familyAddress}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-600 border-green-600">Attivo</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => handleEdit(membro)}>Modifica</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleDelete(membro.id)}>Elimina</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Nessun membro trovato. Aggiungine uno per creare la tua famiglia.
                    </TableCell>
                  </TableRow>
                )
              )}
               {error && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-destructive">
                    Si è verificato un errore nel caricamento dei dati. 
                    Potrebbe essere un problema di permessi o l'indirizzo non è stato ancora salvato.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
