'use client';

import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useUserData, type UserData } from '@/src/hooks/use-user-data';
import { useMemo } from 'react';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';


export interface Progetto {
    id: string;
    name: string;
    slug: string;
    description?: string;
    startDate: any;
    endDate: any;
    allDay: boolean;
    groupIds: string[];
    raccoltaId?: string;
    driveFolderId?: string;
    createdAt: any;
}

const formatDate = (date: any) => {
    if (!date) return '-';
    let jsDate;
    if (date.toDate) {
        jsDate = date.toDate();
    } else {
        jsDate = new Date(date);
    }
    if (isNaN(jsDate.getTime())) return '';
    return format(jsDate, 'PPP', { locale: it });
};

export default function ProgettiPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { userData, isLoading: isUserLoading } = useUserData();

    // Query for all projects
    const allProgettiQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'progetti'), orderBy('createdAt', 'desc'));
    }, [firestore]);
    const { data: allProgetti, isLoading: isLoadingAllProgetti } = useCollection<Progetto>(allProgettiQuery);

    // Query for educator's groups if applicable
    const myGroupsQuery = useMemoFirebase(() => {
        if (!firestore || !user || !userData?.roles?.includes('educatore')) return null;
        return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
    }, [firestore, user, userData]);
    const { data: myGroups, isLoading: isLoadingMyGroups } = useCollection<Group>(myGroupsQuery);
    
    // Query for family members for 'genitore' role
    const membriQuery = useMemoFirebase(() => {
        if (!firestore || !user || !userData?.roles?.includes('genitore')) return null;
        return collection(firestore, 'famiglie', user.uid, 'membri');
    }, [firestore, user, userData]);
    const { data: membri, isLoading: isLoadingMembri } = useCollection<Membro>(membriQuery);
    
    const userAndFamilyMembers = useMemo((): (UserData | Membro)[] => {
        if (!userData && !membri) return [];
        const allFamilyMembers = [];
        if (userData) allFamilyMembers.push(userData);
        if (membri) allFamilyMembers.push(...membri);
        return allFamilyMembers;
    }, [userData, membri]);

    const progetti = useMemo(() => {
        if (!allProgetti || !userData) return [];

        if (userData.roles?.includes('admin')) {
            return allProgetti;
        }

        if (userData.roles?.includes('educatore')) {
            if (!myGroups) return []; // Still loading groups
            const educatorGroupIds = new Set(myGroups.map(g => g.id));
            return allProgetti.filter(progetto => 
                progetto.groupIds.some(groupId => educatorGroupIds.has(groupId))
            );
        }
        
        if (userData.roles?.includes('genitore')) {
            if (userAndFamilyMembers.length === 0) return [];
            const familyGroupIds = new Set(userAndFamilyMembers.map(m => (m as any).groupId).filter(Boolean));
            if (familyGroupIds.size === 0) return [];
            return allProgetti.filter(progetto => 
                progetto.groupIds.some(groupId => familyGroupIds.has(groupId))
            );
        }

        return [];

    }, [allProgetti, userData, myGroups, userAndFamilyMembers]);

    const isLoading = isUserLoading || isLoadingAllProgetti || isLoadingMyGroups || isLoadingMembri;

    return (
        <>
            {isLoading && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Elenco Progetti</CardTitle>
                        <CardDescription>
                            Qui verranno elencati tutti i progetti creati.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-muted-foreground py-10">Caricamento progetti...</p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && (!progetti || progetti.length === 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Elenco Progetti</CardTitle>
                        <CardDescription>
                            Qui verranno elencati tutti i progetti creati.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-muted-foreground py-10">
                            {userData?.roles?.includes('educatore') ? 'Nessun progetto trovato per i tuoi gruppi.' : 'Nessun progetto disponibile per te al momento.'}
                        </p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && progetti && progetti.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {progetti.map(progetto => (
                        <Link href={`/progetti/${progetto.slug}`} key={progetto.id}>
                            <Card className="hover:border-primary transition-colors h-full flex flex-col justify-between">
                                <CardHeader>
                                    <CardTitle>{progetto.name}</CardTitle>
                                    <CardDescription>Creato il: {formatDate(progetto.createdAt)}</CardDescription>
                                </CardHeader>
                                {progetto.description && (
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground line-clamp-3">{progetto.description}</p>
                                    </CardContent>
                                )}
                                <div className="flex justify-end p-4 mt-auto">
                                    <ArrowRight className="h-5 w-5 text-muted-foreground"/>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </>
    );
}
