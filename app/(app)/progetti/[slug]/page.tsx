'use client';
import { useParams } from 'next/navigation';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from '@/src/firebase';
import { collection, query, where, doc, writeBatch, getDocs, updateDoc } from 'firebase/firestore';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useUserData, type UserData } from '@/src/hooks/use-user-data';
import type { Progetto } from '../page';
import type { Membro } from '../../nucleo-familiare/page';
import type { Group } from '../../admin/gestione-gruppi/tutti-i-gruppi/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Raccolta } from '@/components/raccolta-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NuovaRaccoltaDialog } from '@/components/nuova-raccolta-dialog';
import { Accordion } from '@/components/ui/accordion';
import { RaccoltaCard } from '@/components/raccolta-card';
import DocumentManager from '@/components/document-manager';
import PhotoManager from '@/components/photo-manager';
import MessagePlanner from '@/components/message-planner';
import SocialPlanner from '@/components/social-planner';
import { Textarea } from '@/components/ui/textarea';
import { Archive, ArchiveRestore, CalendarDays, ExternalLink, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { AddEventDialog, type Evento } from '@/components/add-event-dialog';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { AcquistiList } from '@/components/acquisti-list';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Circle } from 'lucide-react';

const formatEventDate = (date: any) => {
    if (!date) return '-';
    let jsDate;
    if (date.toDate) {
        jsDate = date.toDate();
    } else {
        jsDate = new Date(date);
    }
    if (isNaN(jsDate.getTime())) return '';
    return format(jsDate, 'PPP HH:mm', { locale: it });
};

export default function ProgettoDettaglioPage() {
    const params = useParams();
    const { slug } = params;
    const firestore = useFirestore();
    const { user } = useUser();
    const { userData, isLoading: isUserLoading } = useUserData();
    const [isSavingGroups, setIsSavingGroups] = useState(false);
    const [isRaccoltaDialogOpen, setIsRaccoltaDialogOpen] = useState(false);

    const [description, setDescription] = useState('');
    const [selectedResponsabili, setSelectedResponsabili] = useState<string[]>([]);
    const [isEditingGenerale, setIsEditingGenerale] = useState(false);
    const [isSavingGenerale, setIsSavingGenerale] = useState(false);

    const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Evento | null>(null);

    // Photos available for social planner
    const [availablePhotos, setAvailablePhotos] = useState<any[]>([]);

    // Fetch the project by slug
    const progettoQuery = useMemoFirebase(() => {
        if (!firestore || !slug) return null;
        return query(collection(firestore, 'progetti'), where('slug', '==', slug));
    }, [firestore, slug]);

    const { data: progettiData, isLoading: isLoadingProgetto } = useCollection<Progetto>(progettoQuery);
    const progetto = useMemo(() => progettiData?.[0], [progettiData]);
    
    // Fetch the associated fundraiser if it exists
    const raccoltaDocRef = useMemoFirebase(() => {
        if (!firestore || !progetto?.raccoltaId) return null;
        return doc(firestore, 'raccolte', progetto.raccoltaId);
    }, [firestore, progetto?.raccoltaId]);
    const { data: raccoltaData, isLoading: isLoadingRaccolta } = useDoc<Raccolta>(raccoltaDocRef);

    // Fetch all groups for the group management tab
    const allGroupsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'gruppi') : null, [firestore]);
    const { data: allGroups, isLoading: isLoadingAllGroups } = useCollection<Group>(allGroupsQuery);

    const [selectedGruppi, setSelectedGruppi] = useState<string[]>([]);

    useEffect(() => {
        if(progetto?.groupIds) {
            setSelectedGruppi(progetto.groupIds);
        }
        if (progetto) {
            setDescription(progetto.description || '');
            setSelectedResponsabili(progetto.responsabiliIds || []);
        }
    }, [progetto]);

    // Fetch edu users for responsabili selection
    const eduUsersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('roles', 'array-contains', 'educatore'));
    }, [firestore]);
    const { data: eduUsers, isLoading: isLoadingEduUsers } = useCollection<UserData>(eduUsersQuery);

    // Fetch archived projects for suggestions
    const archivedProjectsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'progetti'), where('status', '==', 'archiviato'));
    }, [firestore]);
    const { data: archivedProjects, isLoading: isLoadingArchived } = useCollection<Progetto>(archivedProjectsQuery);

    const suggestedProjects = useMemo(() => {
        if (!archivedProjects || !progetto) return [];
        const currentWords = [...(progetto.name || '').toLowerCase().split(/\s+/), ...(progetto.description || '').toLowerCase().split(/\s+/)].filter(w => w.length > 3);
        
        return archivedProjects.map(p => {
            let score = 0;
            const targetWords = [...(p.name || '').toLowerCase().split(/\s+/), ...(p.description || '').toLowerCase().split(/\s+/)];
            currentWords.forEach(w => {
                if (targetWords.some(tw => tw.includes(w))) score++;
            });
            return { project: p, score };
        })
        .filter(p => p.score > 0 && p.project.id !== progetto.id)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(p => p.project);
    }, [archivedProjects, progetto]);

    // Fetch project's events
    const projectEventsQuery = useMemoFirebase(() => {
        if (!firestore || !progetto) return null;
        return query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id));
    }, [firestore, progetto]);
    const { data: rawProjectEvents, isLoading: isLoadingEvents } = useCollection<Evento>(projectEventsQuery);

    const projectEvents = useMemo(() => {
        if (!rawProjectEvents) return [];
        return [...rawProjectEvents].sort((a, b) => {
            const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
            const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
            return dateA.getTime() - dateB.getTime();
        });
    }, [rawProjectEvents]);

    const handleToggleEventCompleted = async (evento: Evento) => {
        if (!firestore || !canEdit) return;
        try {
            await updateDoc(doc(firestore, 'eventi', evento.id), {
                completed: !evento.completed
            });
        } catch (e) {
            console.error("Error toggling completion:", e);
        }
    };

    // --- PERMISSION LOGIC ---
    const myGroupsQuery = useMemoFirebase(() =>
        (user && userData?.roles?.includes('educatore'))
        ? query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid))
        : null,
    [firestore, user, userData]);
    const { data: myGroups, isLoading: isLoadingGroups } = useCollection<Group>(myGroupsQuery);

    const membriQuery = useMemoFirebase(() => {
        if (!firestore || !user || !userData?.roles?.includes('genitore')) return null;
        return collection(firestore, 'famiglie', user.uid, 'membri');
    }, [firestore, user, userData]);
    const { data: membri, isLoading: isLoadingMembri } = useCollection<Membro>(membriQuery);
    
    const userAndFamilyMembers = useMemo((): (typeof userData | Membro)[] => {
        if (!userData && !membri) return [];
        const allFamilyMembers = [];
        if (userData) allFamilyMembers.push(userData);
        if (membri) allFamilyMembers.push(...membri);
        return allFamilyMembers;
    }, [userData, membri]);

    const hasPermission = useMemo(() => {
        if (isLoadingProgetto || isUserLoading || isLoadingGroups || isLoadingMembri) return false;
        if (!progetto || !userData || !user) return false;
        if (userData.roles?.includes('admin')) return true;
        
        if (userData.roles?.includes('educatore')) {
            if (!myGroups) return false; 
            const educatorGroupIds = new Set(myGroups.map(g => g.id));
            return progetto.groupIds.some(gid => educatorGroupIds.has(gid));
        }

        if (userData.roles?.includes('genitore')) {
            if (!userAndFamilyMembers) return false; 
            const familyGroupIds = new Set(userAndFamilyMembers.map(m => (m as any).groupId).filter(Boolean));
            return progetto.groupIds.some(gid => familyGroupIds.has(gid));
        }
        return false;
    }, [progetto, userData, user, myGroups, userAndFamilyMembers, isLoadingProgetto, isUserLoading, isLoadingGroups, isLoadingMembri]);
    // --- END PERMISSION LOGIC ---
    
    const canEdit = useMemo(() => {
        if (!userData) return false;
        return userData.roles?.includes('admin') || userData.roles?.includes('educatore');
    }, [userData]);

    const handleLinkRaccoltaToProgetto = useCallback(async (raccoltaId: string) => {
        if (!firestore || !progetto) return;
        try {
            const batch = writeBatch(firestore);

            const progettoDocRef = doc(firestore, 'progetti', progetto.id);
            batch.update(progettoDocRef, { raccoltaId: raccoltaId });

            const eventQuery = query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id));
            const eventSnapshot = await getDocs(eventQuery);
            if (!eventSnapshot.empty) {
                const eventDocRef = eventSnapshot.docs[0].ref;
                batch.update(eventDocRef, { raccoltaId: raccoltaId });
            }
            await batch.commit();
        } catch (error) {
            console.error("Error linking fundraiser to project:", error);
        }
    }, [firestore, progetto]);

    const handleGroupToggle = (groupId: string, isChecked: boolean) => {
        setSelectedGruppi(prev => 
            isChecked ? [...prev, groupId] : prev.filter(id => id !== groupId)
        );
    };

    const handleSaveGroups = useCallback(async () => {
        if (!firestore || !progetto) return;
        setIsSavingGroups(true);
        try {
            const batch = writeBatch(firestore);
            
            // Update Project
            const progettoDocRef = doc(firestore, 'progetti', progetto.id);
            batch.update(progettoDocRef, { groupIds: selectedGruppi });

            // Update linked Event
            const eventQuery = query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id));
            const eventSnapshot = await getDocs(eventQuery);
            if (!eventSnapshot.empty) {
                const eventDocRef = eventSnapshot.docs[0].ref;
                batch.update(eventDocRef, { groupIds: selectedGruppi });
            }

            // If a raccolta is linked, update it too
            if (progetto.raccoltaId) {
                const raccoltaDocRef = doc(firestore, 'raccolte', progetto.raccoltaId);
                batch.update(raccoltaDocRef, { gruppiId: selectedGruppi });
            }

            await batch.commit();
            // Add toast notification for success
        } catch (error) {
            console.error("Error saving groups:", error);
            // Add toast notification for error
        } finally {
            setIsSavingGroups(false);
        }
    }, [firestore, progetto, selectedGruppi]);

    const handleSaveGenerale = async () => {
        if (!firestore || !progetto) return;
        setIsSavingGenerale(true);
        try {
            const progettoDocRef = doc(firestore, 'progetti', progetto.id);
            await updateDoc(progettoDocRef, {
                description,
                responsabiliIds: selectedResponsabili
            });
            setIsEditingGenerale(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingGenerale(false);
        }
    };

    const handleToggleArchive = async () => {
        if (!firestore || !progetto) return;
        try {
            const newStatus = progetto.status === 'archiviato' ? 'attivo' : 'archiviato';
            const progettoDocRef = doc(firestore, 'progetti', progetto.id);
            await updateDoc(progettoDocRef, { status: newStatus });
        } catch (e) {
            console.error(e);
        }
    };

    const handleResponsabileToggle = (userId: string, isChecked: boolean) => {
        setSelectedResponsabili(prev => 
            isChecked ? [...prev, userId] : prev.filter(id => id !== userId)
        );
    };

    const isLoading = isUserLoading || isLoadingProgetto;

    if (isLoading) {
        return <div>Caricamento...</div>;
    }

    if (!progetto || !hasPermission) {
        return <div>Progetto non trovato o non hai i permessi per visualizzarlo.</div>;
    }

    // Render page
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold">{progetto.name}</h1>
                    {progetto.status === 'archiviato' && (
                        <span className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-sm font-medium">Archiviato</span>
                    )}
                </div>
                {canEdit && (
                    <Button 
                        variant={progetto.status === 'archiviato' ? 'outline' : 'secondary'} 
                        className={progetto.status !== 'archiviato' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200' : ''}
                        onClick={handleToggleArchive}
                    >
                        {progetto.status === 'archiviato' ? (
                            <><ArchiveRestore className="w-4 h-4 mr-2" /> Ripristina Progetto</>
                        ) : (
                            <><Archive className="w-4 h-4 mr-2" /> Archivia Progetto</>
                        )}
                    </Button>
                )}
            </div>
            
            <NuovaRaccoltaDialog 
                isOpen={isRaccoltaDialogOpen}
                onOpenChange={setIsRaccoltaDialogOpen}
                raccoltaToEdit={raccoltaData}
                initialData={!raccoltaData && progetto ? { nome: `Raccolta per: ${progetto.name}`, gruppiId: progetto.groupIds } : undefined}
                onSaveSuccess={handleLinkRaccoltaToProgetto}
            />

            <AddEventDialog 
                isOpen={isEventDialogOpen}
                onOpenChange={setIsEventDialogOpen}
                eventToEdit={editingEvent}
                // Pre-fill per nuovi eventi
                {...(progetto && !editingEvent ? {
                  defaultProjectData: {
                    isProject: true,
                    projectId: progetto.id,
                    groupIds: progetto.groupIds
                  }
                } : {})}
            />

            <Tabs defaultValue="generale" className="w-full">
                <TabsList className="mb-4 flex-wrap h-auto justify-start">
                    <TabsTrigger value="generale">Generale</TabsTrigger>
                    <TabsTrigger value="iscrizioni" disabled={!canEdit}>Iscrizioni</TabsTrigger>
                    <TabsTrigger value="gruppi" disabled={!canEdit}>Gruppi</TabsTrigger>
                    <TabsTrigger value="piano">Piano Impegni</TabsTrigger>
                    <TabsTrigger value="acquisti">Acquisti</TabsTrigger>
                    <TabsTrigger value="documenti">Documenti</TabsTrigger>
                    <TabsTrigger value="foto">Foto</TabsTrigger>
                    <TabsTrigger value="messaggi" disabled={!canEdit}>Messaggi</TabsTrigger>
                    <TabsTrigger value="social">Social</TabsTrigger>
                </TabsList>

                <TabsContent value="generale" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Dettagli Progetto</CardTitle>
                                <CardDescription>Informazioni generali e responsabili</CardDescription>
                            </div>
                            {canEdit && (
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => isEditingGenerale ? handleSaveGenerale() : setIsEditingGenerale(true)}
                                    disabled={isSavingGenerale}
                                >
                                    {isSavingGenerale && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isEditingGenerale ? 'Salva Modifiche' : 'Modifica Dettagli'}
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-base font-semibold">Descrizione</Label>
                                {isEditingGenerale ? (
                                    <Textarea 
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Inserisci una descrizione per il progetto..."
                                        rows={4}
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {progetto.description || "Nessuna descrizione per questo progetto."}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-base font-semibold">Responsabili (Educatori / Admin)</Label>
                                {isEditingGenerale ? (
                                    <div className="grid gap-2 mt-2 p-4 border rounded-md bg-muted/30">
                                        {isLoadingEduUsers ? <p className="text-sm text-muted-foreground">Caricamento utenti...</p> : (
                                            eduUsers && eduUsers.length > 0 ? eduUsers.map(u => (
                                                <div key={u.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`resp-${u.id}`}
                                                        checked={selectedResponsabili.includes(u.id)}
                                                        onCheckedChange={(checked) => handleResponsabileToggle(u.id, !!checked)}
                                                    />
                                                    <Label htmlFor={`resp-${u.id}`} className="text-sm font-medium leading-none">
                                                        {u.displayName || u.email}
                                                    </Label>
                                                </div>
                                            )) : <p className="text-sm text-muted-foreground">Nessun utente eleggibile trovato.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {progetto.responsabiliIds && progetto.responsabiliIds.length > 0 ? (
                                            eduUsers?.filter(u => progetto.responsabiliIds?.includes(u.id)).map(u => (
                                                <span key={u.id} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
                                                    {u.displayName || u.email}
                                                </span>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground">Nessun responsabile assegnato.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {suggestedProjects && suggestedProjects.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Storico: Progetti Simili Archiviati</CardTitle>
                                <CardDescription>Progetti passati che presentano parole chiave simili nel titolo o descrizione.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {suggestedProjects.map(p => (
                                        <Link href={`/progetti/${p.slug}`} key={p.id} className="block group">
                                            <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm group-hover:border-primary transition-all h-full">
                                                <h3 className="font-semibold text-sm line-clamp-1">{p.name}</h3>
                                                {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
                
                <TabsContent value="iscrizioni" className="mt-4">
                     {isLoadingRaccolta ? (
                        <p>Caricamento...</p>
                    ) : raccoltaData ? (
                        <Accordion type="single" collapsible className="w-full">
                           <RaccoltaCard raccolta={raccoltaData} onEdit={() => setIsRaccoltaDialogOpen(true)} />
                        </Accordion>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Gestione Iscrizioni e Raccolta Fondi</CardTitle>
                                <CardDescription>
                                    Collega o gestisci una raccolta fondi per le iscrizioni a questo progetto.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={() => setIsRaccoltaDialogOpen(true)} disabled={!canEdit}>
                                    Crea Raccolta Fondi
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="gruppi" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Gruppi Coinvolti</CardTitle>
                            <CardDescription>
                                Seleziona i gruppi che parteciperanno a questo progetto.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <ScrollArea className="h-64 rounded-md border p-4">
                                {isLoadingAllGroups ? <p>Caricamento gruppi...</p> : (
                                    <div className="space-y-2">
                                        {allGroups && allGroups.length > 0 ? allGroups.map(group => (
                                            <div key={group.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`group-${group.id}`}
                                                    checked={selectedGruppi.includes(group.id)}
                                                    onCheckedChange={(checked) => handleGroupToggle(group.id, !!checked)}
                                                />
                                                <Label htmlFor={`group-${group.id}`} className="text-sm font-medium leading-none">
                                                    {group.name}
                                                </Label>
                                            </div>
                                        )) : <p className="text-sm text-muted-foreground">Nessun gruppo trovato.</p>}
                                    </div>
                                )}
                            </ScrollArea>
                            <div className='flex justify-end'>
                                <Button onClick={handleSaveGroups} disabled={isSavingGroups}>
                                    {isSavingGroups && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salva Modifiche Gruppi
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="piano" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarDays className="h-5 w-5 text-primary" />
                                    Piano Impegni
                                </CardTitle>
                                <CardDescription>
                                    Scadenze, date e appuntamenti per la realizzazione del progetto.
                                </CardDescription>
                            </div>
                            {canEdit && (
                                <Button size="sm" onClick={() => { setEditingEvent(null); setIsEventDialogOpen(true); }}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Nuovo Impegno
                                </Button>
                            )}
                        </CardHeader>
                         <CardContent>
                             {isLoadingEvents ? (
                                <p className="text-center text-muted-foreground p-8">Caricamento impegni...</p>
                            ) : projectEvents && projectEvents.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="w-[50px]"></TableHead>
                                                    <TableHead className="min-w-[150px]">Impegno</TableHead>
                                                    <TableHead>Scadenza / Data</TableHead>
                                                    <TableHead>Note</TableHead>
                                                    <TableHead className="text-right">Azioni</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {projectEvents.map((evento) => (
                                                    <TableRow key={evento.id} className={evento.completed ? "bg-muted/30" : ""}>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={!canEdit}
                                                                onClick={() => handleToggleEventCompleted(evento)}
                                                                className={evento.completed ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-muted-foreground"}
                                                            >
                                                                {evento.completed ? (
                                                                    <CheckCircle2 className="h-5 w-5" />
                                                                ) : (
                                                                    <Circle className="h-5 w-5" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className={`font-medium ${evento.completed ? "line-through text-muted-foreground" : ""}`}>
                                                                {evento.title}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col text-xs text-muted-foreground">
                                                                <span>Inizio: {formatEventDate(evento.startDate)}</span>
                                                                <span>Fine: {formatEventDate(evento.endDate)}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="max-w-[300px]">
                                                            <div className="flex flex-col gap-1">
                                                                {evento.description && <p className="text-xs italic text-muted-foreground line-clamp-1">{evento.description}</p>}
                                                                {evento.notes ? (
                                                                    <p className="text-sm">{evento.notes}</p>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground/50 italic">Nessun commento</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {canEdit && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    onClick={() => { setEditingEvent(evento); setIsEventDialogOpen(true); }}
                                                                >
                                                                    Modifica
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <p className="text-xs text-center text-muted-foreground mt-4 pt-4 border-t">
                                        Gli impegni aggiunti qui sono sincronizzati col Calendario generale.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground p-8 border border-dashed rounded-lg">
                                    <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p>Nessun impegno in programma per questo progetto.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="acquisti" className="mt-4">
                    <AcquistiList projectId={progetto.id} canEdit={canEdit} />
                </TabsContent>

                <TabsContent value="documenti" className="mt-4">
                    <DocumentManager
                        projectId={progetto.id}
                        projectName={progetto.name}
                        driveFolderId={progetto.driveFolderId}
                        canEdit={canEdit}
                        onFolderCreated={async (folderId) => {
                            if (firestore && progetto) {
                                await updateDoc(doc(firestore, 'progetti', progetto.id), { driveFolderId: folderId });
                            }
                        }}
                    />
                </TabsContent>

                <TabsContent value="foto" className="mt-4">
                    <PhotoManager
                        projectId={progetto.id}
                        projectName={progetto.name}
                        driveFolderId={progetto.driveFolderId}
                        canEdit={canEdit}
                        onFolderCreated={async (folderId) => {
                            if (firestore && progetto) {
                                await updateDoc(doc(firestore, 'progetti', progetto.id), { driveFolderId: folderId });
                            }
                        }}
                        onPhotosChange={setAvailablePhotos}
                    />
                </TabsContent>

                <TabsContent value="messaggi" className="mt-4">
                    <MessagePlanner
                        projectId={progetto.id}
                        projectName={progetto.name}
                        projectDescription={progetto.description}
                        projectStartDate={progetto.startDate?.toDate ? progetto.startDate.toDate().toLocaleDateString('it-IT') : undefined}
                        projectEndDate={progetto.endDate?.toDate ? progetto.endDate.toDate().toLocaleDateString('it-IT') : undefined}
                        canEdit={canEdit}
                    />
                </TabsContent>

                <TabsContent value="social" className="mt-4">
                    <SocialPlanner
                        projectId={progetto.id}
                        projectName={progetto.name}
                        canEdit={canEdit}
                        availablePhotos={availablePhotos}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
