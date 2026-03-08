'use client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { collection, doc, deleteDoc, Firestore, query, where } from 'firebase/firestore';
import { EducatorRoleDialog } from '@/components/educator-role-dialog';
import { UserData } from '@/src/hooks/use-user-data';

export interface EducatorRole {
    id: string;
    name: string;
    accessiblePages: string[]; // array of page paths
    assignedEducators: string[]; // array of user IDs
}

// Dedicated delete function outside the component
const deleteEducatorRole = async (firestore: Firestore, roleId: string) => {
    try {
        await deleteDoc(doc(firestore, 'ruoli-educatori', roleId));
    } catch (err) {
        console.error("Errore durante l'eliminazione del ruolo:", err);
    }
};


export default function RuoliEducatoriPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<EducatorRole | null>(null);
    const firestore = useFirestore();

    const rolesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'ruoli-educatori');
    }, [firestore]);

    const { data: roles, isLoading: isLoadingRoles, error } = useCollection<EducatorRole>(rolesQuery);

    const educatorsQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return query(collection(firestore, 'users'), where('roles', 'array-contains', 'educatore'));
    }, [firestore])
    const {data: educators, isLoading: isLoadingEducators } = useCollection<UserData>(educatorsQuery);

    const educatorMap = useMemo(() => {
        if (!educators) return {};
        return educators.reduce((acc, edu) => {
            acc[edu.id] = edu.displayName;
            return acc;
        }, {} as {[key: string]: string});
    }, [educators]);

    const handleAddNew = () => {
        setEditingRole(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (role: EducatorRole) => {
        setEditingRole(role);
        setIsDialogOpen(true);
    };

    const pageLabels: { [key: string]: string } = {
        '/dashboard': 'Dashboard',
        '/miei-gruppi': 'I Miei Gruppi',
        '/iscrizioni': 'Iscrizioni',
        '/nucleo-familiare': 'Nucleo Familiare',
        '/contabilita/conto': 'Contabilità / Conto',
        '/contabilita/raccolte': 'Contabilità / Raccolte attive',
        '/contabilita/transazioni-da-controllare': 'Contabilità / Transazioni da Controllare',
        '/contabilita/pagamenti-contanti': 'Contabilità / Pagamenti Contanti',
        '/contabilita/spese': 'Contabilità / Spese',
        '/contabilita/storico': 'Contabilità / Raccolte concluse',
        '/tesserati/tariffe': 'Tesserati / Tariffe',
        '/tesserati/nuovi-iscritti': 'Tesserati / Nuovi Iscritti',
        '/tesserati/tesserati': 'Tesserati / Tesserati',
        '/tesserati/famiglie': 'Tesserati / Famiglie',
        '/tesserati/archivio': 'Tesserati / Archivio'
    };
    
    const isLoading = isLoadingRoles || isLoadingEducators;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Ruoli degli Educatori</h1>
                <Button onClick={handleAddNew}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Ruolo
                </Button>
            </div>

            <EducatorRoleDialog 
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                roleToEdit={editingRole}
            />

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ruolo</TableHead>
                                <TableHead>Pagine Visualizzabili</TableHead>
                                <TableHead>Educatori Assegnati</TableHead>
                                <TableHead><span className="sr-only">Azioni</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">Caricamento ruoli...</TableCell>
                                </TableRow>
                            )}
                            {!isLoading && roles && roles.length > 0 ? (
                                roles.map(role => (
                                    <TableRow key={role.id}>
                                        <TableCell className="font-medium">{role.name}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 items-start">
                                                {role.accessiblePages?.map(page => <Badge key={page} variant="secondary">{pageLabels[page] || page}</Badge>)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 items-start">
                                                {role.assignedEducators && role.assignedEducators.length > 0 ? (
                                                    role.assignedEducators.map(eduId => (
                                                        <Badge key={eduId} variant="outline">
                                                            {educatorMap[eduId] || 'Utente non trovato'}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Nessuno</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => handleEdit(role)}>Modifica</DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onSelect={() => {
                                                        if (!firestore) return;
                                                        deleteEducatorRole(firestore, role.id)
                                                    }} 
                                                    className="text-destructive"
                                                >
                                                    Elimina
                                                </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                !isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">
                                            Nessun ruolo definito. Inizia creandone uno nuovo.
                                        </TableCell>
                                    </TableRow>
                                )
                            )}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-destructive">
                                        Si è verificato un errore nel caricamento dei ruoli.
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
