'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { collection, doc, deleteDoc, Firestore, query, where } from 'firebase/firestore';
import { GroupDialog } from '@/components/group-dialog';
import { UserData, useUserData } from '@/src/hooks/use-user-data';

export interface Group {
    id: string;
    name: string;
    educatorIds: string[]; // array of user IDs for educators
    memberIds: string[]; // array of member IDs
    sortOrder?: number; // optional ordering field managed from Gestione Pagine
}

const deleteGroup = async (firestore: Firestore, groupId: string) => {
    try {
        await deleteDoc(doc(firestore, 'gruppi', groupId));
    } catch (err) {
        console.error("Errore durante l'eliminazione del gruppo:", err);
    }
};

export default function GestioneTuttiGruppiPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const firestore = useFirestore();
    const { userData } = useUserData();

    const canManageGroups = useMemo(() => {
        return userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');
    }, [userData]);

    const groupsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'gruppi');
    }, [firestore]);
    const { data: groups, isLoading: isLoadingGroups, error } = useCollection<Group>(groupsQuery);

    const educatorsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('roles', 'array-contains', 'educatore'));
    }, [firestore]);
    const { data: educators, isLoading: isLoadingEducators } = useCollection<UserData>(educatorsQuery);

    const educatorMap = useMemo(() => {
        if (!educators) return {};
        return educators.reduce((acc, edu) => {
            acc[edu.id] = edu.displayName;
            return acc;
        }, {} as { [key: string]: string });
    }, [educators]);

    const handleAddNew = () => {
        setEditingGroup(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (group: Group) => {
        setEditingGroup(group);
        setIsDialogOpen(true);
    };

    const isLoading = isLoadingGroups || isLoadingEducators;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Tutti i Gruppi</h1>
                {canManageGroups && (
                    <Button onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Gruppo
                    </Button>
                )}
            </div>

            <GroupDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                groupToEdit={editingGroup}
            />

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome Gruppo</TableHead>
                                <TableHead>Educatori Assegnati</TableHead>
                                <TableHead>Componenti</TableHead>
                                {canManageGroups && <TableHead><span className="sr-only">Azioni</span></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={canManageGroups ? 4 : 3} className="text-center">Caricamento gruppi...</TableCell>
                                </TableRow>
                            )}
                            {!isLoading && groups && groups.length > 0 ? (
                                groups.map(group => (
                                    <TableRow key={group.id}>
                                        <TableCell className="font-medium">{group.name}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 items-start">
                                                {group.educatorIds && group.educatorIds.length > 0 ? (
                                                    group.educatorIds.map(eduId => (
                                                        <Badge key={eduId} variant="outline">
                                                            {educatorMap[eduId] || 'ID non trovato'}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Nessuno</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground">Da implementare</span>
                                        </TableCell>
                                        {canManageGroups && (
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => handleEdit(group)}>Modifica</DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onSelect={() => {
                                                                if (!firestore) return;
                                                                deleteGroup(firestore, group.id);
                                                            }}
                                                            className="text-destructive"
                                                        >
                                                            Elimina
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            ) : (
                                !isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={canManageGroups ? 4 : 3} className="text-center h-24">
                                            Nessun gruppo definito. Inizia creandone uno nuovo.
                                        </TableCell>
                                    </TableRow>
                                )
                            )}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={canManageGroups ? 4 : 3} className="text-center text-destructive">
                                        Si è verificato un errore nel caricamento dei gruppi.
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
