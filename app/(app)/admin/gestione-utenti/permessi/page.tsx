'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserData } from '@/src/hooks/use-user-data';
import { Badge } from '@/components/ui/badge';

const ALL_ROLES = ["utente", "genitore", "educatore", "admin"] as const;
type Role = typeof ALL_ROLES[number];

export default function PermissionsPage() {
  const firestore = useFirestore();
  
  // Memoized query to fetch all users
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: users, isLoading, error } = useCollection<UserData>(usersQuery);

  const handleRoleChange = async (userId: string, role: Role, isChecked: boolean) => {
    if (!firestore) return;
    
    const userDocRef = doc(firestore, 'users', userId);
    
    try {
      if (isChecked) {
        await updateDoc(userDocRef, {
          roles: arrayUnion(role)
        });
      } else {
        await updateDoc(userDocRef, {
          roles: arrayRemove(role)
        });
      }
    } catch (err) {
      console.error("Failed to update role:", err);
      // Optional: Add toast notification for error
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestione Permessi e Ruoli</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Assegnazione Ruoli Utente</CardTitle>
          <CardDescription>
            Assegna o revoca i ruoli per ogni utente del sistema. Le modifiche vengono salvate automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                {ALL_ROLES.map(role => (
                   <TableHead key={role} className="capitalize text-center">{role}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={ALL_ROLES.length + 2} className="text-center">
                    Caricamento utenti...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && users && users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.displayName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    {ALL_ROLES.map(role => (
                      <TableCell key={role} className="text-center">
                        <Checkbox
                          checked={user.roles?.includes(role)}
                          onCheckedChange={(isChecked) => handleRoleChange(user.id, role, !!isChecked)}
                          aria-label={`Assegna ruolo ${role} a ${user.displayName}`}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                 !isLoading && (
                    <TableRow>
                        <TableCell colSpan={ALL_ROLES.length + 2} className="text-center">
                            Nessun utente trovato.
                        </TableCell>
                    </TableRow>
                 )
              )}
               {error && (
                <TableRow>
                  <TableCell colSpan={ALL_ROLES.length + 2} className="text-center text-destructive">
                    Si è verificato un errore nel caricamento degli utenti.
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
