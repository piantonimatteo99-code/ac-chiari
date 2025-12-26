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
import { MoreHorizontal } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, collectionGroup, query } from 'firebase/firestore';
import { UserData, useUserData } from '@/src/hooks/use-user-data';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';
import { useRouter } from 'next/navigation';

type CombinedUser = {
  id: string;
  type: 'Utente' | 'Familiare';
  nomeCompleto: string;
  identificativo: string; // Email for Utente, CF for Familiare
  data: string; // Nascita for Familiare, Creazione for Utente
  isUserActive: boolean;
  source: UserData | Membro;
};

export default function UsersPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { userData: adminData, isLoading: isAdminLoading } = useUserData();

  // Query for all users
  const usersQuery = useMemoFirebase(() => 
    firestore ? collection(firestore, 'users') : null, 
    [firestore]
  );
  const { data: usersData, isLoading: isUsersLoading, error: usersError } = useCollection<UserData>(usersQuery);

  // Collection group query for all 'membri' across all 'famiglie'
  const membriQuery = useMemoFirebase(() => 
    firestore ? collectionGroup(firestore, 'membri') : null, 
    [firestore]
  );
  const { data: membriData, isLoading: isMembriLoading, error: membriError } = useCollection<Membro>(membriQuery);
  
  const combinedData = useMemo(() => {
    if (!usersData && !membriData) return [];

    const combined: CombinedUser[] = [];

    usersData?.forEach(user => {
      combined.push({
        id: user.id,
        type: 'Utente',
        nomeCompleto: user.displayName || `${user.nome} ${user.cognome}`,
        identificativo: user.email,
        data: user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('it-IT') : '-',
        isUserActive: true, // Assuming all registered users are active
        source: user,
      });
    });

    membriData?.forEach(membro => {
      combined.push({
        id: membro.id,
        type: 'Familiare',
        nomeCompleto: `${membro.nome} ${membro.cognome}`,
        identificativo: membro.codiceFiscale || 'N/A',
        data: membro.dataNascita ? new Date(membro.dataNascita).toLocaleDateString('it-IT') : '-',
        isUserActive: false, // Familiari are not users, so they don't have an "active" user state
        source: membro,
      });
    });

    // Sort by name
    return combined.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
  }, [usersData, membriData]);

  const isLoading = isAdminLoading || isUsersLoading || isMembriLoading;
  const error = usersError || membriError;

  if (!isAdminLoading && (!adminData || !adminData.roles?.includes('admin'))) {
     router.push('/dashboard');
     return <div className="flex items-center justify-center min-h-screen">Accesso non autorizzato.</div>;
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if it's already formatted
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  return (
     <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Anagrafe Utenti e Familiari</h1>
      </div>

      <Card>
         <CardHeader>
          <CardTitle>Elenco Completo</CardTitle>
          <CardDescription>
            Questa tabella mostra sia gli utenti registrati al sistema sia i membri dei nuclei familiari.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome Completo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Email / Codice Fiscale</TableHead>
                <TableHead>Data Nascita / Registrazione</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Caricamento anagrafe...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && combinedData.length > 0 ? (
                combinedData.map((item) => (
                  <TableRow key={`${item.type}-${item.id}`} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{item.nomeCompleto}</TableCell>
                    <TableCell>
                      <Badge variant={item.type === 'Utente' ? 'default' : 'secondary'}>{item.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{item.identificativo}</TableCell>
                    <TableCell>{formatDate(item.data)}</TableCell>
                    <TableCell>
                        {item.type === 'Utente' ? 
                            <Badge variant="outline" className="text-green-600 border-green-600">Attivo</Badge> 
                            : <Badge variant="outline">N/A</Badge>
                        }
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
                    <TableCell colSpan={6} className="text-center">
                      Nessun utente o familiare trovato nel database.
                    </TableCell>
                  </TableRow>
                )
              )}
               {error && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-destructive">
                    Si è verificato un errore nel caricamento dei dati: {error.message}
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
