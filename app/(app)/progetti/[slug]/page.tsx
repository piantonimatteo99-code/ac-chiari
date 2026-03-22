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
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Raccolta } from '@/components/raccolta-card';
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
import {
    Archive, ArchiveRestore, CalendarDays, PlusCircle,
    LayoutList, FolderOpen, Users, DollarSign, CheckCircle2, Circle,
    ClipboardList, ShoppingCart, FileText, Image, MessageSquare, Share2,
    ChevronRight, ExternalLink, X
} from 'lucide-react';
import Link from 'next/link';
import { AddEventDialog, type Evento } from '@/components/add-event-dialog';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { AcquistiList } from '@/components/acquisti-list';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// ─── helpers ────────────────────────────────────────────────────────────────
const formatEventDate = (date: any) => {
    if (!date) return '-';
    const jsDate = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(jsDate.getTime())) return '';
    return format(jsDate, 'PPP HH:mm', { locale: it });
};

type ViewMode = 'compatta' | 'cartelle';

// ─── Pill navigation ─────────────────────────────────────────────────────────
function PillNav({
    items,
    active,
    onSelect,
}: {
    items: { id: string; label: string; icon?: React.ElementType; isLink?: boolean; href?: string }[];
    active?: string;
    onSelect?: (id: string) => void;
}) {
    return (
        <div className="flex gap-2 flex-wrap text-sm">
            {items.map(item => {
                const base = `flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors`;
                const activeClass = `bg-primary text-primary-foreground border-primary`;
                const inactiveClass = `text-muted-foreground hover:bg-muted hover:text-foreground`;
                if (item.isLink && item.href) {
                    return (
                        <Link key={item.id} href={item.href}
                            className={`${base} border-primary/30 bg-primary/5 text-primary hover:bg-primary/10`}>
                            <ExternalLink className="h-3 w-3" />
                            {item.label}
                        </Link>
                    );
                }
                return (
                    <button key={item.id} onClick={() => onSelect?.(item.id)}
                        className={`${base} ${active === item.id ? activeClass : inactiveClass}`}>
                        {item.icon && <item.icon className="h-3 w-3" />}
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function SectionCard({
    id, icon: Icon, title, description, action, children,
}: {
    id?: string; icon: React.ElementType; title: string;
    description?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-4">
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                        </div>
                        <div>
                            <CardTitle className="text-base">{title}</CardTitle>
                            {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
                        </div>
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </CardHeader>
                <CardContent className="pt-4">{children}</CardContent>
            </Card>
        </section>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
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
    const [availablePhotos, setAvailablePhotos] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('compatta');
    // folder active tab
    const [folderTab, setFolderTab] = useState('generale');
    // compact active page: 'generale' | 'iscrizioni'
    const [compactPage, setCompactPage] = useState<'generale' | 'iscrizioni'>('generale');

    // isEditing groups
    const [isEditingGroups, setIsEditingGroups] = useState(false);
    const [selectedGruppi, setSelectedGruppi] = useState<string[]>([]);

    // ─── Firestore queries ───────────────────────────────────────────────────
    const progettoQuery = useMemoFirebase(() => {
        if (!firestore || !slug) return null;
        return query(collection(firestore, 'progetti'), where('slug', '==', slug));
    }, [firestore, slug]);
    const { data: progettiData, isLoading: isLoadingProgetto } = useCollection<Progetto>(progettoQuery);
    const progetto = useMemo(() => progettiData?.[0], [progettiData]);

    const raccoltaDocRef = useMemoFirebase(() => {
        if (!firestore || !progetto?.raccoltaId) return null;
        return doc(firestore, 'raccolte', progetto.raccoltaId);
    }, [firestore, progetto?.raccoltaId]);
    const { data: raccoltaData, isLoading: isLoadingRaccolta } = useDoc<Raccolta>(raccoltaDocRef);

    const allGroupsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'gruppi') : null, [firestore]);
    const { data: allGroups, isLoading: isLoadingAllGroups } = useCollection<Group>(allGroupsQuery);

    const eduUsersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('roles', 'array-contains', 'educatore'));
    }, [firestore]);
    const { data: eduUsers, isLoading: isLoadingEduUsers } = useCollection<UserData>(eduUsersQuery);

    const archivedProjectsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'progetti'), where('status', '==', 'archiviato'));
    }, [firestore]);
    const { data: archivedProjects } = useCollection<Progetto>(archivedProjectsQuery);

    const projectEventsQuery = useMemoFirebase(() => {
        if (!firestore || !progetto) return null;
        return query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id));
    }, [firestore, progetto]);
    const { data: rawProjectEvents, isLoading: isLoadingEvents } = useCollection<Evento>(projectEventsQuery);

    const projectEvents = useMemo(() => {
        if (!rawProjectEvents) return [];
        return [...rawProjectEvents].sort((a, b) => {
            const dA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
            const dB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
            return dA.getTime() - dB.getTime();
        });
    }, [rawProjectEvents]);

    // Permission queries
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

    const userAndFamilyMembers = useMemo(() => {
        const list: any[] = [];
        if (userData) list.push(userData);
        if (membri) list.push(...membri);
        return list;
    }, [userData, membri]);

    const hasPermission = useMemo(() => {
        if (isLoadingProgetto || isUserLoading || isLoadingGroups || isLoadingMembri) return false;
        if (!progetto || !userData || !user) return false;
        if (userData.roles?.includes('admin')) return true;
        if (userData.roles?.includes('educatore')) {
            if (!myGroups) return false;
            const ids = new Set(myGroups.map(g => g.id));
            return progetto.groupIds.some(id => ids.has(id));
        }
        if (userData.roles?.includes('genitore')) {
            const ids = new Set(userAndFamilyMembers.map((m: any) => m.groupId).filter(Boolean));
            return progetto.groupIds.some(id => ids.has(id));
        }
        return false;
    }, [progetto, userData, user, myGroups, userAndFamilyMembers, isLoadingProgetto, isUserLoading, isLoadingGroups, isLoadingMembri]);

    const canEdit = useMemo(() => {
        if (!userData) return false;
        return userData.roles?.includes('admin') || userData.roles?.includes('educatore');
    }, [userData]);

    const suggestedProjects = useMemo(() => {
        if (!archivedProjects || !progetto) return [];
        const words = [...(progetto.name || '').toLowerCase().split(/\s+/),
            ...(progetto.description || '').toLowerCase().split(/\s+/)].filter(w => w.length > 3);
        return archivedProjects.map(p => {
            let score = 0;
            const tw = [...(p.name || '').toLowerCase().split(/\s+/), ...(p.description || '').toLowerCase().split(/\s+/)];
            words.forEach(w => { if (tw.some(t => t.includes(w))) score++; });
            return { project: p, score };
        }).filter(p => p.score > 0 && p.project.id !== progetto.id)
          .sort((a, b) => b.score - a.score).slice(0, 3).map(p => p.project);
    }, [archivedProjects, progetto]);

    useEffect(() => {
        if (progetto?.groupIds) setSelectedGruppi(progetto.groupIds);
        if (progetto) {
            setDescription(progetto.description || '');
            setSelectedResponsabili(progetto.responsabiliIds || []);
        }
    }, [progetto]);

    // ─── Handlers ────────────────────────────────────────────────────────────
    const handleLinkRaccoltaToProgetto = useCallback(async (raccoltaId: string) => {
        if (!firestore || !progetto) return;
        const batch = writeBatch(firestore);
        batch.update(doc(firestore, 'progetti', progetto.id), { raccoltaId });
        const snap = await getDocs(query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id)));
        if (!snap.empty) batch.update(snap.docs[0].ref, { raccoltaId });
        await batch.commit();
    }, [firestore, progetto]);

    const handleGroupToggle = (groupId: string, checked: boolean) => {
        setSelectedGruppi(prev => checked ? [...prev, groupId] : prev.filter(id => id !== groupId));
    };

    const handleSaveGroups = useCallback(async () => {
        if (!firestore || !progetto) return;
        setIsSavingGroups(true);
        try {
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, 'progetti', progetto.id), { groupIds: selectedGruppi });
            const snap = await getDocs(query(collection(firestore, 'eventi'), where('projectId', '==', progetto.id)));
            if (!snap.empty) batch.update(snap.docs[0].ref, { groupIds: selectedGruppi });
            if (progetto.raccoltaId) batch.update(doc(firestore, 'raccolte', progetto.raccoltaId), { gruppiId: selectedGruppi });
            await batch.commit();
            setIsEditingGroups(false);
        } catch (e) { console.error(e); } finally { setIsSavingGroups(false); }
    }, [firestore, progetto, selectedGruppi]);

    const handleSaveGenerale = async () => {
        if (!firestore || !progetto) return;
        setIsSavingGenerale(true);
        try {
            await updateDoc(doc(firestore, 'progetti', progetto.id), { description, responsabiliIds: selectedResponsabili });
            setIsEditingGenerale(false);
        } catch (e) { console.error(e); } finally { setIsSavingGenerale(false); }
    };

    const handleToggleArchive = async () => {
        if (!firestore || !progetto) return;
        const newStatus = progetto.status === 'archiviato' ? 'attivo' : 'archiviato';
        await updateDoc(doc(firestore, 'progetti', progetto.id), { status: newStatus });
    };

    const handleToggleEventCompleted = async (evento: Evento) => {
        if (!firestore || !canEdit) return;
        await updateDoc(doc(firestore, 'eventi', evento.id), { completed: !evento.completed });
    };

    const handleResponsabileToggle = (userId: string, checked: boolean) => {
        setSelectedResponsabili(prev => checked ? [...prev, userId] : prev.filter(id => id !== userId));
    };

    // ─── Loading / auth ───────────────────────────────────────────────────────
    if (isUserLoading || isLoadingProgetto) return <div>Caricamento...</div>;
    if (!progetto || !hasPermission) return <div>Progetto non trovato o permessi insufficienti.</div>;

    // ─── Shared sub-components ────────────────────────────────────────────────

    const GeneraleInfo = () => (
        <div className="space-y-4">
            {/* Descrizione */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                    <Label className="text-sm font-semibold">Descrizione</Label>
                    {isEditingGenerale ? (
                        <Textarea value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Inserisci una descrizione..." rows={4} />
                    ) : (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {progetto.description || 'Nessuna descrizione.'}
                        </p>
                    )}
                </div>
                {canEdit && !isEditingGenerale && (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => setIsEditingGenerale(true)}>
                        Modifica
                    </Button>
                )}
            </div>

            {/* Responsabili */}
            <div>
                <Label className="text-sm font-semibold">Responsabili</Label>
                {isEditingGenerale ? (
                    <div className="grid gap-2 mt-2 p-4 border rounded-md bg-muted/30">
                        {isLoadingEduUsers ? <p className="text-sm text-muted-foreground">Caricamento...</p> :
                            eduUsers && eduUsers.length > 0 ? eduUsers.map(u => (
                                <div key={u.id} className="flex items-center space-x-2">
                                    <Checkbox id={`resp-${u.id}`} checked={selectedResponsabili.includes(u.id)}
                                        onCheckedChange={c => handleResponsabileToggle(u.id, !!c)} />
                                    <Label htmlFor={`resp-${u.id}`} className="text-sm font-medium leading-none">
                                        {u.displayName || u.email}
                                    </Label>
                                </div>
                            )) : <p className="text-sm text-muted-foreground">Nessun utente eleggibile.</p>}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {progetto.responsabiliIds?.length ? (
                            eduUsers?.filter(u => progetto.responsabiliIds?.includes(u.id)).map(u => (
                                <span key={u.id} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
                                    {u.displayName || u.email}
                                </span>
                            ))
                        ) : <p className="text-sm text-muted-foreground">Nessun responsabile assegnato.</p>}
                    </div>
                )}
                {isEditingGenerale && (
                    <div className="flex gap-2 justify-end mt-3">
                        <Button variant="outline" size="sm" onClick={() => setIsEditingGenerale(false)}>Annulla</Button>
                        <Button size="sm" onClick={handleSaveGenerale} disabled={isSavingGenerale}>
                            {isSavingGenerale && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salva Modifiche
                        </Button>
                    </div>
                )}
            </div>

            {suggestedProjects.length > 0 && (
                <>
                    <Separator />
                    <div>
                        <Label className="text-sm font-semibold">Storico: Progetti Simili</Label>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-2">
                            {suggestedProjects.map(p => (
                                <Link href={`/progetti/${p.slug}`} key={p.id} className="block group">
                                    <div className="p-3 rounded-lg border bg-card shadow-sm group-hover:border-primary transition-all">
                                        <h3 className="font-semibold text-sm line-clamp-1">{p.name}</h3>
                                        {p.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{p.description}</p>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    // Compact groups: chip list with optional edit popover
    const GruppiCompact = () => {
        const selectedNames = allGroups?.filter(g => selectedGruppi.includes(g.id)).map(g => g.name) ?? [];
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                        {isLoadingAllGroups ? <span className="text-xs text-muted-foreground">Caricamento...</span> :
                            selectedNames.length > 0 ? selectedNames.map(name => (
                                <span key={name} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                    {name}
                                </span>
                            )) : <span className="text-xs text-muted-foreground">Nessun gruppo selezionato.</span>}
                    </div>
                    {canEdit && !isEditingGroups && (
                        <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={() => setIsEditingGroups(true)}>
                            Modifica
                        </Button>
                    )}
                </div>
                {isEditingGroups && (
                    <div className="mt-3 p-3 border rounded-lg bg-muted/30 space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {allGroups?.map(group => (
                                <button key={group.id}
                                    onClick={() => handleGroupToggle(group.id, !selectedGruppi.includes(group.id))}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                        selectedGruppi.includes(group.id)
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background text-muted-foreground border-muted-foreground/30 hover:border-primary hover:text-primary'
                                    }`}>
                                    {selectedGruppi.includes(group.id) && <X className="h-2.5 w-2.5" />}
                                    {group.name}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => { setIsEditingGroups(false); setSelectedGruppi(progetto.groupIds || []); }}>Annulla</Button>
                            <Button size="sm" onClick={handleSaveGroups} disabled={isSavingGroups}>
                                {isSavingGroups && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salva
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const IscrizioniSummary = ({ showLink = false }: { showLink?: boolean }) => (
        <div className="space-y-3">
            {isLoadingRaccolta ? (
                <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : raccoltaData ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg border bg-card p-3 text-center">
                            <p className="text-2xl font-bold text-primary">{raccoltaData.confermatiIds?.length ?? 0}</p>
                            <p className="text-xs text-muted-foreground mt-1">Iscritti confermati</p>
                        </div>
                        {raccoltaData.faseCaparra?.attiva && (
                            <div className="rounded-lg border bg-card p-3 text-center">
                                <p className="text-2xl font-bold text-amber-600">{raccoltaData.caparraPaidIds?.length ?? 0}</p>
                                <p className="text-xs text-muted-foreground mt-1">Caparra pagata</p>
                            </div>
                        )}
                        {raccoltaData.faseSaldo?.attiva && (
                            <div className="rounded-lg border bg-card p-3 text-center">
                                <p className="text-2xl font-bold text-green-600">{raccoltaData.saldoPaidIds?.length ?? 0}</p>
                                <p className="text-xs text-muted-foreground mt-1">Saldo pagato</p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                        <div>
                            <p className="text-xs text-muted-foreground">Raccolta</p>
                            <p className="text-sm font-semibold">{raccoltaData.nome}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={raccoltaData.archived ? 'secondary' : 'default'}>
                                {raccoltaData.archived ? 'Archiviata' : 'Attiva'}
                            </Badge>
                            {showLink && (
                                <Link href={`/progetti/${slug}/iscrizioni`}>
                                    <Button size="sm" variant="outline" className="gap-1.5">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Gestisci
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </>
            ) : canEdit ? (
                <div className="flex items-center gap-3 p-3 border border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground flex-1">Nessuna raccolta fondi collegata.</p>
                    <Button size="sm" variant="outline" onClick={() => setIsRaccoltaDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-3.5 w-3.5" />Crea Raccolta
                    </Button>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">Nessuna raccolta fondi collegata.</p>
            )}
        </div>
    );

    const PianoContent = () => (
        <div>
            {isLoadingEvents ? (
                <p className="text-center text-muted-foreground p-8">Caricamento impegni...</p>
            ) : projectEvents.length > 0 ? (
                <div className="space-y-2">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[50px]" />
                                    <TableHead className="min-w-[150px]">Impegno</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Note</TableHead>
                                    <TableHead className="text-right">Azioni</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projectEvents.map(evento => (
                                    <TableRow key={evento.id} className={evento.completed ? 'bg-muted/30' : ''}>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" disabled={!canEdit}
                                                onClick={() => handleToggleEventCompleted(evento)}
                                                className={evento.completed ? 'text-green-600' : 'text-muted-foreground'}>
                                                {evento.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`font-medium ${evento.completed ? 'line-through text-muted-foreground' : ''}`}>
                                                {evento.title}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-xs text-muted-foreground">
                                                <span>{formatEventDate(evento.startDate)}</span>
                                                <span>{formatEventDate(evento.endDate)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[250px]">
                                            {evento.notes
                                                ? <p className="text-sm line-clamp-1">{evento.notes}</p>
                                                : <span className="text-xs text-muted-foreground/50 italic">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {canEdit && (
                                                <Button variant="ghost" size="sm"
                                                    onClick={() => { setEditingEvent(evento); setIsEventDialogOpen(true); }}>
                                                    Modifica
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <p className="text-xs text-center text-muted-foreground pt-2 border-t">
                        Sincronizzati col Calendario generale.
                    </p>
                </div>
            ) : (
                <div className="text-center text-muted-foreground p-8 border border-dashed rounded-lg">
                    <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p>Nessun impegno in programma.</p>
                </div>
            )}
        </div>
    );

    // Folder section definitions
    const folderSections = [
        { id: 'generale',   label: 'Generale' },
        { id: 'iscrizioni', label: 'Iscrizioni', disabled: !canEdit },
        { id: 'gruppi',     label: 'Gruppi',     disabled: !canEdit },
        { id: 'piano',      label: 'Piano Impegni' },
        { id: 'acquisti',   label: 'Acquisti' },
        { id: 'documenti',  label: 'Documenti' },
        { id: 'foto',       label: 'Foto' },
        { id: 'messaggi',   label: 'Messaggi',   disabled: !canEdit },
        { id: 'social',     label: 'Social' },
    ];

    const docManagerProps = {
        projectId: progetto.id, projectName: progetto.name,
        driveFolderId: progetto.driveFolderId, canEdit,
        onFolderCreated: async (folderId: string) => {
            if (firestore && progetto) await updateDoc(doc(firestore, 'progetti', progetto.id), { driveFolderId: folderId });
        },
    };
    const photoManagerProps = {
        ...docManagerProps, groupIds: progetto.groupIds || [], onPhotosChange: setAvailablePhotos,
    };
    const messagePlannerProps = {
        projectId: progetto.id, projectName: progetto.name,
        projectDescription: progetto.description,
        projectStartDate: progetto.startDate?.toDate ? progetto.startDate.toDate().toLocaleDateString('it-IT') : undefined,
        projectEndDate: progetto.endDate?.toDate ? progetto.endDate.toDate().toLocaleDateString('it-IT') : undefined,
        canEdit,
    };
    const socialPlannerProps = {
        ...messagePlannerProps, groupIds: progetto.groupIds || [], availablePhotos,
    };

    // ─── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6">
            {/* Shared dialogs */}
            <NuovaRaccoltaDialog
                isOpen={isRaccoltaDialogOpen} onOpenChange={setIsRaccoltaDialogOpen}
                raccoltaToEdit={raccoltaData}
                initialData={!raccoltaData && progetto ? { nome: `Raccolta per: ${progetto.name}`, gruppiId: progetto.groupIds } : undefined}
                onSaveSuccess={handleLinkRaccoltaToProgetto}
            />
            <AddEventDialog
                isOpen={isEventDialogOpen} onOpenChange={setIsEventDialogOpen} eventToEdit={editingEvent}
                {...(progetto && !editingEvent ? { defaultProjectData: { isProject: true, projectId: progetto.id, groupIds: progetto.groupIds } } : {})}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold">{progetto.name}</h1>
                    {progetto.status === 'archiviato' && (
                        <span className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-sm font-medium">Archiviato</span>
                    )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* View toggle */}
                    <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
                        <button onClick={() => setViewMode('compatta')}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${viewMode === 'compatta' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            <LayoutList className="h-3.5 w-3.5" />Compatta
                        </button>
                        <button onClick={() => setViewMode('cartelle')}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${viewMode === 'cartelle' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            <FolderOpen className="h-3.5 w-3.5" />Cartelle
                        </button>
                    </div>
                    {canEdit && (
                        <Button variant={progetto.status === 'archiviato' ? 'outline' : 'secondary'}
                            className={progetto.status !== 'archiviato' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200' : ''}
                            onClick={handleToggleArchive}>
                            {progetto.status === 'archiviato'
                                ? <><ArchiveRestore className="w-4 h-4 mr-2" />Ripristina</>
                                : <><Archive className="w-4 h-4 mr-2" />Archivia</>}
                        </Button>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                VISUALIZZAZIONE COMPATTA — due capsule: Generale | Iscrizioni
            ════════════════════════════════════════════════════════════════ */}
            {viewMode === 'compatta' && (
                <div className="space-y-5">
                    {/* Top-level page pills */}
                    <div className="flex gap-2">
                        {(['generale', 'iscrizioni'] as const).map(p => (
                            <button key={p} onClick={() => setCompactPage(p)}
                                className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-colors capitalize ${
                                    compactPage === p
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}>
                                {p === 'generale' ? 'Generale' : 'Iscrizioni'}
                            </button>
                        ))}
                    </div>

                    {/* ── GENERALE page: all sections scrollable ─────────── */}
                    {compactPage === 'generale' && (
                        <div className="space-y-4">
                            <SectionCard id="generale" icon={ClipboardList} title="Generale"
                                description="Informazioni generali e responsabili">
                                <GeneraleInfo />
                            </SectionCard>

                            {canEdit && (
                                <SectionCard id="gruppi" icon={Users} title="Gruppi Coinvolti"
                                    description="Gruppi che partecipano al progetto">
                                    <GruppiCompact />
                                </SectionCard>
                            )}

                            <SectionCard id="piano" icon={CalendarDays} title="Piano Impegni"
                                description="Scadenze e appuntamenti"
                                action={canEdit ? (
                                    <Button size="sm" onClick={() => { setEditingEvent(null); setIsEventDialogOpen(true); }}>
                                        <PlusCircle className="mr-2 h-4 w-4" />Nuovo
                                    </Button>
                                ) : undefined}>
                                <PianoContent />
                            </SectionCard>

                            <SectionCard id="acquisti" icon={ShoppingCart} title="Acquisti">
                                <AcquistiList projectId={progetto.id} canEdit={canEdit} />
                            </SectionCard>

                            <SectionCard id="documenti" icon={FileText} title="Documenti">
                                <DocumentManager {...docManagerProps} />
                            </SectionCard>

                            <SectionCard id="foto" icon={Image} title="Foto">
                                <PhotoManager {...photoManagerProps} />
                            </SectionCard>

                            {canEdit && (
                                <SectionCard id="messaggi" icon={MessageSquare} title="Messaggi">
                                    <MessagePlanner {...messagePlannerProps} />
                                </SectionCard>
                            )}

                            <SectionCard id="social" icon={Share2} title="Social Media">
                                <SocialPlanner {...socialPlannerProps} />
                            </SectionCard>
                        </div>
                    )}

                    {/* ── ISCRIZIONI page ────────────────────────────────── */}
                    {compactPage === 'iscrizioni' && (
                        <SectionCard icon={Users} title="Iscrizioni"
                            description="Riepilogo e gestione iscrizioni"
                            action={
                                <Link href={`/progetti/${slug}/iscrizioni`}>
                                    <Button size="sm" variant="outline" className="gap-1.5">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Gestisci completo
                                    </Button>
                                </Link>
                            }>
                            <IscrizioniSummary showLink={false} />
                        </SectionCard>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                VISUALIZZAZIONE CARTELLE — pill nav + content panel
            ════════════════════════════════════════════════════════════════ */}
            {viewMode === 'cartelle' && (
                <div className="space-y-4">
                    {/* Pill navigation */}
                    <div className="flex gap-2 flex-wrap">
                        {folderSections.filter(s => !s.disabled).map(s => (
                            <button key={s.id} onClick={() => setFolderTab(s.id)}
                                className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                                    folderTab === s.id
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}>
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Content panels */}
                    {folderTab === 'generale' && (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Dettagli Progetto</CardTitle>
                                        <CardDescription>Informazioni generali e responsabili</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent><GeneraleInfo /></CardContent>
                            </Card>

                            {/* Iscrizioni summary inside Generale */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="h-5 w-5 text-primary" />Riepilogo Iscrizioni
                                        </CardTitle>
                                        <CardDescription>Dati riassuntivi della raccolta fondi</CardDescription>
                                    </div>
                                    {canEdit && (
                                        <Link href={`/progetti/${slug}/iscrizioni`}>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <ExternalLink className="h-4 w-4" />Gestisci Iscrizioni
                                            </Button>
                                        </Link>
                                    )}
                                </CardHeader>
                                <CardContent><IscrizioniSummary showLink={false} /></CardContent>
                            </Card>
                        </div>
                    )}

                    {folderTab === 'iscrizioni' && (
                        isLoadingRaccolta ? <p>Caricamento...</p> : raccoltaData ? (
                            <Accordion type="single" collapsible className="w-full">
                                <RaccoltaCard raccolta={raccoltaData} onEdit={() => setIsRaccoltaDialogOpen(true)} />
                            </Accordion>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Gestione Iscrizioni</CardTitle>
                                    <CardDescription>Crea una raccolta fondi per questo progetto.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button onClick={() => setIsRaccoltaDialogOpen(true)} disabled={!canEdit}>
                                        Crea Raccolta Fondi
                                    </Button>
                                </CardContent>
                            </Card>
                        )
                    )}

                    {folderTab === 'gruppi' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Gruppi Coinvolti</CardTitle>
                                <CardDescription>Seleziona i gruppi che partecipano al progetto.</CardDescription>
                            </CardHeader>
                            <CardContent><GruppiCompact /></CardContent>
                        </Card>
                    )}

                    {folderTab === 'piano' && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-primary" />Piano Impegni
                                    </CardTitle>
                                    <CardDescription>Scadenze, date e appuntamenti.</CardDescription>
                                </div>
                                {canEdit && (
                                    <Button size="sm" onClick={() => { setEditingEvent(null); setIsEventDialogOpen(true); }}>
                                        <PlusCircle className="mr-2 h-4 w-4" />Nuovo Impegno
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent><PianoContent /></CardContent>
                        </Card>
                    )}

                    {folderTab === 'acquisti' && <AcquistiList projectId={progetto.id} canEdit={canEdit} />}
                    {folderTab === 'documenti' && <DocumentManager {...docManagerProps} />}
                    {folderTab === 'foto' && <PhotoManager {...photoManagerProps} />}
                    {folderTab === 'messaggi' && <MessagePlanner {...messagePlannerProps} />}
                    {folderTab === 'social' && <SocialPlanner {...socialPlannerProps} />}
                </div>
            )}
        </div>
    );
}
