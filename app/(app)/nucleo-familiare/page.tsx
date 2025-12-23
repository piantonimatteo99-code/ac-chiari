'use client';

import { useState } from 'react';
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

export interface Familiare {
  id: string;
  nome: string;
  cognome: string;
  dataNascita: string;
  codiceFiscale: string;
  luogoNascita: string;
  telefonoPrincipale: string;
  telefonoSecondario: string;
}

export default function NucleoFamiliarePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFamiliare, setEditingFamiliare] = useState<Familiare | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserDataLoading } = useUserData();

  const familiariQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'familiari'), where('registratoDa', '==', user.uid));
  }, [user, firestore]);

  const { data: familiari, isLoading: isFamiliariLoading, error } = useCollection<Familiare>(familiariQuery);
  
  const isLoading = isUserDataLoading || isFamiliariLoading;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  
  const formatAddress = () => {
    if (!userData) return 'Indirizzo non specificato';
    const { via, numeroCivico, citta, provincia, cap } = userData;
    if (!via || !citta) return 'Indirizzo non specificato';
    return `${via} ${numeroCivico}, ${cap} ${citta} (${provincia})`;
  }

  const handleEdit = (familiare: Familiare) => {
    setEditingFamiliare(familiare);
    setIsDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingFamiliare(null);
    setIsDialogOpen(true);
  }

  const handleDelete = async (familiareId: string) => {
    if (!firestore) return;
    if (window.confirm("Sei sicuro di voler eliminare questo familiare?")) {
      try {
        const docRef = doc(firestore, 'familiari', familiareId);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Errore durante l'eliminazione del familiare:", error);
        alert("Si è verificato un errore.");
      }
    }
  };


  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nucleo Familiare</h1>
        <Button onClick={handleAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Familiare
        </Button>
      </div>
      <AddFamiliareDialog 
        isOpen={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        familiareToEdit={editingFamiliare}
       />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead>Indirizzo</TableHead>
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
              {!isLoading && familiari && familiari.length > 0 ? (
                familiari.map((familiare) => (
                  <TableRow key={familiare.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{familiare.nome} {familiare.cognome}</TableCell>
                    <TableCell>{formatDate(familiare.dataNascita)}</TableCell>
                    <TableCell>{formatAddress()}</TableCell>
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
                          <DropdownMenuItem onSelect={() => handleEdit(familiare)}>Modifica</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleDelete(familiare.id)}>Elimina</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Nessun familiare trovato. Aggiungine uno per iniziare.
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
