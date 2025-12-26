'use client';

import { useState, useMemo, useEffect } from 'react';
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
  const { userData: adminData, isLoading: isAdminDataLoading } = useUserData();

  const usersQuery = useMemoFirebase(() => 
    firestore ? collection(firestore, 'users') : null, 
    [firestore]
  );
  const { data: usersData, isLoading: isUsersLoading, error: usersError } = useCollection<UserData>(usersQuery);

  const membriQuery = useMemoFirebase(() => 
    firestore ? query(collectionGroup(firestore, 'membri')) : null, 
    [firestore]
  );
  const { data: membriData, isLoading: isMembriLoading, error: membriError } = useCollection<Membro>(membriQuery);
  
  const combinedData = useMemo(() => {
    if (!usersData || !membriData) return [];

    const combined: CombinedUser[] = [];

    usersData.forEach(user => {
      combined.push({
        id: user.id,
        type: 'Utente',
        nomeCompleto: user.displayName || `${user.nome} ${user.cognome}`,
        identificativo: user.email,
        data: user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('it-IT') : 'N/A',
        isUserActive: true,
        source: user,
      });
    });

    membriData.forEach(membro => {
      combined.push({
        id: membro.id,
        type: 'Familiare',
        nomeCompleto: `${membro.nome} ${membro.cognome}`,
        identificativo: membro.codiceFiscale || 'N/A',
        data: membro.dataNascita ? new Date(membro.dataNascita).toLocaleDateString('it-IT') : 'N/A',
        isUserActive: false,
        source: membro,
      });
    });

    return combined.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
  }, [usersData, membriData]);

  const isCheckingPermissions = isAdminDataLoading;
  const isUserAdmin = !!adminData && adminData.roles?.includes('admin');
  const areTableDataLoading = isUsersLoading || isMembriLoading;
  const dataError = usersError || membriError;

  useEffect(() => {
    // Redirect only when loading is finished and user is not an admin.
    if (!isCheckingPermissions && !isUserAdmin) {
      router.push('/dashboard');
    }
  }, [isCheckingPermissions, isUserAdmin, router]);
  
  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const newDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
            if (!isNaN(newDate.getTime())) return dateString;
        }
        return dateString;
    }
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  if (isCheckingPermissions) {
    return <div className="flex items-center justify-center min-h-screen">Verifica permessi in corso...</div>;
  }
  
  if (!isUserAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Accesso non autorizzato. Reindirizzamento...</div>;
  }
  
  return (
     <div className="flex flex-col gap-4">
      <Card>
         <CardHeader>
          <CardTitle>Anagrafe Utenti e Familiari</CardTitle>
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
              {areTableDataLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Caricamento anagrafe...</TableCell></TableRow>
              ) : dataError ? (
                <TableRow><TableCell colSpan={6} className="text-center text-destructive">Si è verificato un errore: {dataError.message}</TableCell></TableRow>
              ) : combinedData.length > 0 ? (
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
                <TableRow><TableCell colSpan={6} className="text-center">Nessun utente o familiare trovato.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
