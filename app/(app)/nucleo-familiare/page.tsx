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
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { slugify } from '@/lib/utils';

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

  const [famigliaId, setFamigliaId] = useState<string | null>(null);

  // Query to find the family associated with the current user
  const famigliaQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'famiglie'), where('uidCapofamiglia', '==', user.uid));
  }, [user, firestore]);
  
  const { data: famigliaData, isLoading: isFamigliaLoading } = useCollection(famigliaQuery);

  // Determine famigliaId once the family data is loaded
  useEffect(() => {
    if (famigliaData && famigliaData.length > 0) {
      setFamigliaId(famigliaData[0].id);
    } else {
      setFamigliaId(null);
    }
  }, [famigliaData]);

  // Query to get members of the identified family
  const membriQuery = useMemoFirebase(() => {
    if (!famigliaId || !firestore) return null;
    return collection(firestore, 'famiglie', famigliaId, 'membri');
  }, [famigliaId, firestore]);

  const { data: membri, isLoading: isMembriLoading, error } = useCollection<Membro>(membriQuery);
  
  const isLoading = isFamigliaLoading || isMembriLoading || isUserDataLoading;
  
  const getFamilyAddress = () => {
    if (famigliaData && famigliaData.length > 0) {
        const { via, numeroCivico, citta, provincia, cap } = famigliaData[0];
        if (!via || !citta) return 'Indirizzo non specificato';
        return `${via} ${numeroCivico || ''}, ${cap || ''} ${citta} (${provincia || ''})`;
    }
    return 'Nessuna famiglia trovata';
  }

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

  // A new user might not have a family document yet.
  // We derive the famigliaId from the user data address for the dialog.
  const getDerivedFamigliaId = () => {
    if (famigliaId) return famigliaId;
    if (userData) {
      const { via, citta, cap } = userData;
      if (via && citta && cap) {
        return slugify(`${via} ${citta} ${cap}`);
      }
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nucleo Familiare</h1>
        <Button onClick={handleAddNew} disabled={!user}>
          <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Membro
        </Button>
      </div>
      
      {user && (
        <AddFamiliareDialog 
          isOpen={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
          membroToEdit={editingMembro}
          user={user}
          famigliaId={getDerivedFamigliaId()}
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
                    <TableCell>{getFamilyAddress()}</TableCell>
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
