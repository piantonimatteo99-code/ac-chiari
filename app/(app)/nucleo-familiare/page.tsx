'use client';

import { useState, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { collection, query, where } from 'firebase/firestore';

interface Familiare {
  id: string;
  nome: string;
  cognome: string;
  dataNascita: string;
  codiceFiscale: string;
}

export default function NucleoFamiliarePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

  const familiariQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'familiari'), where('registratoDa', '==', user.uid));
  }, [user, firestore]);

  const { data: familiari, isLoading, error } = useCollection<Familiare>(familiariQuery);

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
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Familiare
        </Button>
      </div>
      <AddFamiliareDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead>Codice Fiscale</TableHead>
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
                    <TableCell>{familiare.codiceFiscale}</TableCell>
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
                          <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                          <DropdownMenuItem>Modifica</DropdownMenuItem>
                          <DropdownMenuItem>Elimina</DropdownMenuItem>
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
