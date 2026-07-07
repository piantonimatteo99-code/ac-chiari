'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, collectionGroup } from 'firebase/firestore';
import type { UserData } from '@/src/hooks/use-user-data';
import type { Membro } from '../../nucleo-familiare/page';
import type { Group } from '../../admin/gestione-gruppi/tutti-i-gruppi/page';
import { Badge } from '@/components/ui/badge';

interface Famiglia {
    id: string;
    uidCapofamiglia: string;
    emailCapofamiglia: string;
    via?: string;
    numeroCivico?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
}

interface MembroViewModel {
    id: string;
    nome: string;
    cognome: string;
    dataNascita?: string;
    groupName?: string;
    tesseramento?: number;
}

interface FamigliaViewModel {
    id: string;
    capofamiglia: string;
    indirizzo: string;
    membri: MembroViewModel[];
}

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/D';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data non valida';
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return 'Data non valida';
    }
};

const getCurrentMembershipYear = () => {
  const today = new Date();
  const month = today.getMonth(); // 0-11 (September is 8)
  return month >= 8 ? today.getFullYear() : today.getFullYear() - 1;
};

export default function FamigliePage() {
    const firestore = useFirestore();

    const famiglieQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'famiglie');
    }, [firestore]);
    const { data: famiglieData, isLoading: isLoadingFamiglie } = useCollection<Famiglia>(famiglieQuery);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: usersData, isLoading: isLoadingUsers } = useCollection<UserData>(usersQuery);

    const membriQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collectionGroup(firestore, 'membri');
    }, [firestore]);
    const { data: membriData, isLoading: isLoadingMembri } = useCollection<Membro & { ref?: any, groupId?: string, groupName?: string }>(membriQuery, { includeRef: true });
    
    const groupsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'gruppi');
    }, [firestore]);
    const { data: groupsData, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);
    
    const [searchTerm, setSearchTerm] = useState('');


    const userMap = useMemo(() => {
        if (!usersData) return new Map<string, UserData>();
        return new Map(usersData.map(u => [u.id, u]));
    }, [usersData]);

    const memberToGroupMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!groupsData) return map;
        groupsData.forEach(group => {
            if (group.memberIds) {
                group.memberIds.forEach(memberId => {
                    map.set(memberId, group.name);
                });
            }
        });
        return map;
    }, [groupsData]);


    const famiglieViewModel = useMemo(() => {
        if (!famiglieData || !membriData || !usersData) return [];

        const membriByFamiglia = new Map<string, (Membro & { groupId?: string, groupName?: string })[]>();
        membriData.forEach(membro => {
            const familyId = membro.ref?.parent.parent?.id;
            if (familyId) {
                if (!membriByFamiglia.has(familyId)) {
                    membriByFamiglia.set(familyId, []);
                }
                membriByFamiglia.get(familyId)?.push(membro);
            }
        });
        
        return famiglieData.map((famiglia): FamigliaViewModel => {
            const capofamigliaUser = userMap.get(famiglia.uidCapofamiglia);
            const capofamigliaName = capofamigliaUser?.displayName || famiglia.emailCapofamiglia;
            const indirizzo = `${famiglia.via || ''} ${famiglia.numeroCivico || ''}, ${famiglia.citta || ''}`.trim();
            
            const membri: MembroViewModel[] = [];

            // Aggiungi gli altri membri dalla sotto-collezione
            const altriMembri = membriByFamiglia.get(famiglia.id)?.map(m => ({
                id: m.id,
                nome: m.nome,
                cognome: m.cognome,
                dataNascita: m.dataNascita,
                groupName: memberToGroupMap.get(m.id) || m.groupName,
                tesseramento: m.tesseramento,
            })) || [];

            // Aggiungi il capofamiglia da users SOLO se non è già presente nella sotto-collezione membri
            const capofamigliaGiaPresente = altriMembri.some(m => m.id === famiglia.uidCapofamiglia);

            if (!capofamigliaGiaPresente && capofamigliaUser && capofamigliaUser.nome && capofamigliaUser.cognome && capofamigliaUser.dataNascita) {
                membri.push({
                    id: capofamigliaUser.id,
                    nome: capofamigliaUser.nome,
                    cognome: capofamigliaUser.cognome,
                    dataNascita: capofamigliaUser.dataNascita,
                    groupName: memberToGroupMap.get(capofamigliaUser.id) || capofamigliaUser.groupName,
                    tesseramento: capofamigliaUser.tesseramento,
                });
            }

            membri.push(...altriMembri);

            return {
                id: famiglia.id,
                capofamiglia: capofamigliaName,
                indirizzo: indirizzo,
                membri: membri,
            };
        });

    }, [famiglieData, membriData, userMap, usersData, memberToGroupMap]);
    
     const filteredData = useMemo(() => {
        if (!searchTerm) return famiglieViewModel;
        const lowercasedFilter = searchTerm.toLowerCase();
        return famiglieViewModel.filter(famiglia =>
            famiglia.capofamiglia.toLowerCase().includes(lowercasedFilter) ||
            famiglia.indirizzo.toLowerCase().includes(lowercasedFilter) ||
            famiglia.membri.map(m => `${m.nome} ${m.cognome}`).join(', ').toLowerCase().includes(lowercasedFilter)
        );
    }, [famiglieViewModel, searchTerm]);

    const isLoading = isLoadingFamiglie || isLoadingUsers || isLoadingMembri || isLoadingGroups;
    
    const currentMembershipYear = getCurrentMembershipYear();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestione Famiglie</CardTitle>
                <CardDescription>
                    Elenco dei nuclei familiari registrati. Ogni riga rappresenta una famiglia con i suoi componenti.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Capofamiglia</TableHead>
                            <TableHead>Indirizzo</TableHead>
                            <TableHead className="w-full">Componenti del Nucleo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">Caricamento famiglie...</TableCell>
                            </TableRow>
                        )}
                        {!isLoading && filteredData.length > 0 ? (
                            filteredData.map(famiglia => (
                                <TableRow key={famiglia.id} className="align-top">
                                    <TableCell className="font-medium">{famiglia.capofamiglia}</TableCell>
                                    <TableCell>{famiglia.indirizzo}</TableCell>
                                    <TableCell>
                                        {famiglia.membri.length > 0 ? (
                                            <Table className='bg-muted/50 rounded-md'>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Nome e Cognome</TableHead>
                                                        <TableHead>Data di Nascita</TableHead>
                                                        <TableHead>Gruppo</TableHead>
                                                        <TableHead>Tesserato</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {famiglia.membri.map(membro => {
                                                      const isTesserato = membro.tesseramento === currentMembershipYear;
                                                      return (
                                                        <TableRow key={membro.id}>
                                                            <TableCell>{membro.nome} {membro.cognome}</TableCell>
                                                            <TableCell>{formatDate(membro.dataNascita)}</TableCell>
                                                            <TableCell>{membro.groupName || ''}</TableCell>
                                                            <TableCell>
                                                                {isTesserato ? (
                                                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">Tesserato</Badge>
                                                                ) : (
                                                                    <Badge variant="destructive">Non Tesserato</Badge>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                      );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        ) : 'Nessun membro aggiunto'}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">Nessuna famiglia trovata.</TableCell>
                                </TableRow>
                            )
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
