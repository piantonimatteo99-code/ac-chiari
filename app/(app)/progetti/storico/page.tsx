'use client';
import { useMemo } from 'react';

import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Progetto } from '../page';

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

export default function StoricoProgettiPage() {
    const firestore = useFirestore();

    const archivedProgettiQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'progetti'), 
            where('status', '==', 'archiviato')
        );
    }, [firestore]);
    
    const { data: rawProgetti, isLoading } = useCollection<Progetto>(archivedProgettiQuery);

    const progetti = useMemo(() => {
        if (!rawProgetti) return [];
        return [...rawProgetti].sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA;
        });
    }, [rawProgetti]);

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/progetti">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Archive className="h-6 w-6 text-muted-foreground" />
                            Storico Progetti
                        </h1>
                        <p className="text-muted-foreground mt-1">Elenco dei progetti conclusi e archiviati.</p>
                    </div>
                </div>
            </div>

            {isLoading && (
                 <Card>
                    <CardContent>
                        <p className="text-center text-muted-foreground py-10">Caricamento storico progetti...</p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && (!progetti || progetti.length === 0) && (
                <Card>
                    <CardContent>
                        <p className="text-center text-muted-foreground py-10">
                            Non ci sono progetti archiviati nello storico.
                        </p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && progetti && progetti.length > 0 && (
                <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50 transition-colors">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nome Progetto</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">Descrizione</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Data Creazione</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {progetti.map(progetto => (
                                    <tr key={progetto.id} className="border-b transition-colors hover:bg-muted/50 group">
                                        <td className="p-4 align-middle font-medium">
                                            <Link href={`/progetti/${progetto.slug}`} className="hover:text-primary transition-colors">
                                                {progetto.name}
                                            </Link>
                                        </td>
                                        <td className="p-4 align-middle text-muted-foreground hidden md:table-cell">
                                            <div className="max-w-[400px] truncate" title={progetto.description}>
                                                {progetto.description || '-'}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">
                                            {formatDate(progetto.createdAt)}
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <Button variant="ghost" size="icon" asChild>
                                                <Link href={`/progetti/${progetto.slug}`}>
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
