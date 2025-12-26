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
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { collection, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserData, useUserData } from '@/src/hooks/use-user-data';
import { useRouter } from 'next/navigation';

const ALL_ROLES: UserData['roles'] = ['admin', 'utente', 'genitore', 'educatore'];

export default function PermissionsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  
  const { userData: adminData, isLoading: isAdminDataLoading } = useUserData();
  const isUserAdmin = useMemo(() => adminData?.roles?.includes('admin'), [adminData]);

  useEffect(() => {
    if (!isAdminDataLoading && !isUserAdmin) {
      router.push('/dashboard');
    }
  }, [isAdminDataLoading, isUserAdmin, router]);
  
  const usersQuery = useMemoFirebase(() => 
    firestore && isUserAdmin ? collection(firestore, 'users') : null, 
    [firestore, isUserAdmin]
  );
  const { data: usersData, isLoading: isUsersLoading, error: usersError } = useCollection<UserData>(usersQuery);

  const [users, setUsers] = useState<UserData[]>([]);

  useEffect(() => {
    if (usersData) {
      const sorted = [...usersData].sort((a, b) => {
        if (a.email === adminData?.email) return -1;
        if (b.email === adminData?.email) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
      setUsers(sorted);
    }
  }, [usersData, adminData]);

  const handleRoleChange = async (userId: string, role: UserData['roles'][number], checked: boolean) => {
    if (!firestore || !isUserAdmin) return;

    const userDocRef = doc(firestore, 'users', userId);
    try {
      if (checked) {
        await updateDoc(userDocRef, { roles: arrayUnion(role) });
      } else {
        await updateDoc(userDocRef, { roles: arrayRemove(role) });
      }
      
      setUsers(currentUsers => 
        currentUsers.map(u => 
          u.id === userId ? { ...u, roles: checked ? [...(u.roles || []), role] : (u.roles || []).filter(r => r !== role) } : u
        )
      );

    } catch (error) {
      console.error("Errore durante l'aggiornamento dei ruoli:", error);
    }
  };
  
  if (isAdminDataLoading || !isUserAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Verifica permessi in corso...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
         <CardHeader>
          <CardTitle>Gestione Permessi e Ruoli</CardTitle>
          <CardDescription>
            Assegna o revoca ruoli agli utenti del sistema. I cambiamenti sono immediati.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome Utente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruoli Attuali</TableHead>
                <TableHead className="text-right">
                  Modifica Ruoli
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUsersLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center">Caricamento utenti...</TableCell></TableRow>
              ) : usersError ? (
                <TableRow><TableCell colSpan={4} className="text-center text-destructive">Si è verificato un errore: {usersError.message}</TableCell></TableRow>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{user.displayName || `${user.nome} ${user.cognome}`}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.length > 0 ? user.roles.map(role => (
                          <Badge key={role} variant={role === 'admin' ? 'destructive' : 'secondary'}>{role}</Badge>
                        )) : <Badge variant="outline">Nessun ruolo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button
                            aria-haspopup="true"
                            size="sm"
                            variant="outline"
                            disabled={user.email === 'piantonimatteo.99@gmail.com' && adminData?.email === user.email}
                          >
                            Gestisci
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Assegna Ruoli</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {ALL_ROLES.map(role => (
                            <DropdownMenuCheckboxItem
                              key={role}
                              checked={user.roles?.includes(role)}
                              onCheckedChange={(checked) => handleRoleChange(user.id, role, checked)}
                              onSelect={(e) => e.preventDefault()}
                            >
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="text-center">Nessun utente trovato.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
