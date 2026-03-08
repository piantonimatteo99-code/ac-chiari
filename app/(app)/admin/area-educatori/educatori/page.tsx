'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import { UserData, useUserData } from '@/src/hooks/use-user-data';
import { Badge } from '@/components/ui/badge';
import type { EducatorRole } from "../ruoli-educatori/page";
import { useMemo } from "react";
import type { Group } from "../../gestione-gruppi/tutti-i-gruppi/page";

export default function EducatoriPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();
  
  const educatoriQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('roles', 'array-contains', 'educatore'));
  }, [firestore]);

  const { data: educatori, isLoading: isLoadingEducatori } = useCollection<UserData>(educatoriQuery);
  
  const ruoliQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'ruoli-educatori');
  }, [firestore]);
  
  const { data: ruoli, isLoading: isLoadingRuoli } = useCollection<EducatorRole>(ruoliQuery);

  const gruppiQuery = useMemoFirebase(() => {
    if (!firestore || !userData || !user) return null;
    
    // Admins see all groups
    if (userData.roles?.includes('admin')) {
        return collection(firestore, 'gruppi');
    }
    
    // Educators see only the groups they are assigned to
    if (userData.roles?.includes('educatore')) {
        return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
    }
    
    return null; // No query for other roles
  }, [firestore, userData, user]);
  
  const {data: gruppi, isLoading: isLoadingGruppi } = useCollection<Group>(gruppiQuery);


  const educatorRoleMap = useMemo(() => {
    if(!ruoli) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    ruoli.forEach(ruolo => {
        ruolo.assignedEducators.forEach(educatorId => {
            if(!map.has(educatorId)){
                map.set(educatorId, []);
            }
            map.get(educatorId)?.push(ruolo.name);
        });
    });
    return map;
  }, [ruoli])

  const educatorGroupMap = useMemo(() => {
    if(!gruppi) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    gruppi.forEach(gruppo => {
        gruppo.educatorIds.forEach(educatorId => {
            if(!map.has(educatorId)){
                map.set(educatorId, []);
            }
            map.get(educatorId)?.push(gruppo.name);
        });
    });
    return map;
  }, [gruppi])


  const isLoading = isLoadingEducatori || isLoadingRuoli || isLoadingGruppi;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Elenco Educatori</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Educatori Registrati</CardTitle>
          <CardDescription>
            Questa tabella mostra tutti gli utenti con il ruolo di "educatore", i ruoli specifici e i gruppi a cui sono assegnati.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome e Cognome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruoli Specifici</TableHead>
                <TableHead>Gruppi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    Caricamento educatori...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && educatori && educatori.length > 0 ? (
                educatori.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.displayName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {educatorRoleMap.get(user.id)?.map(roleName => (
                            <Badge key={roleName} variant="default">{roleName}</Badge>
                        )) || <span className="text-xs text-muted-foreground">Nessun ruolo specifico</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {educatorGroupMap.get(user.id)?.map(groupName => (
                          <Badge key={groupName} variant={'secondary'}>{groupName}</Badge>
                        )) || <span className="text-xs text-muted-foreground">Nessun gruppo</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                 !isLoading && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center">
                            Nessun educatore trovato.
                        </TableCell>
                    </TableRow>
                 )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
