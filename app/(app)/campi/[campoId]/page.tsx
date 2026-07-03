'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useDoc, useUser, useCollection } from '@/src/firebase';
import { doc, collection, query, where, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, CalendarDays, GraduationCap, BookOpen, Sun, Tent, Loader2,
  Archive, ArchiveRestore, Users, ClipboardList, UtensilsCrossed, ShoppingCart,
  Calculator, FolderOpen, Image, MessageSquare, Share2, CheckCircle2, Circle,
  PlusCircle, X, ExternalLink, DollarSign,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Campo, TipoCampo } from '@/components/add-event-dialog';
import type { Evento } from '@/components/add-event-dialog';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import type { UserData } from '@/src/hooks/use-user-data';
import type { Raccolta } from '@/components/raccolta-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddEventDialog } from '@/components/add-event-dialog';
import { NuovaRaccoltaDialog } from '@/components/nuova-raccolta-dialog';
import { RaccoltaCard } from '@/components/raccolta-card';
import { Accordion } from '@/components/ui/accordion';
import DocumentManager from '@/components/document-manager';
import PhotoManager from '@/components/photo-manager';
import MessagePlanner from '@/components/message-planner';
import SocialPlanner from '@/components/social-planner';
import { AcquistiList } from '@/components/acquisti-list';
import TabMenuCampo from './tab-menu-campo';
import TabPreventivooCampo from './tab-preventivo-campo';
import TabSpesaCampo from './tab-spesa-campo';

// ─── Config tipi campo ────────────────────────────────────────────────────────
const TIPO_CONFIG: Record<TipoCampo, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  campo_elementari: {
    label: 'Campo Elementari', icon: BookOpen,
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  },
  campo_medie: {
    label: 'Campo Medie', icon: GraduationCap,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  },
  campo_estivo: {
    label: 'Campo Estivo', icon: Sun,
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  },
};

const formatDateRange = (start: any, end: any) => {
  const toDate = (d: any) => d?.toDate ? d.toDate() : new Date(d);
  try {
    const s = toDate(start);
    const e = toDate(end);
    const sStr = format(s, 'd MMMM yyyy', { locale: it });
    const eStr = format(e, 'd MMMM yyyy', { locale: it });
    return sStr === eStr ? sStr : `${sStr} – ${eStr}`;
  } catch { return ''; }
};

const formatEventDate = (date: any) => {
  if (!date) return '-';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, 'PPP HH:mm', { locale: it });
};

// ─── Pill nav ─────────────────────────────────────────────────────────────────
type TabId = 'generale' | 'gruppi' | 'programma' | 'menu' | 'spesa' | 'preventivo' | 'iscrizioni' | 'acquisti' | 'documenti' | 'foto' | 'messaggi' | 'social';

const ALL_TABS: { id: TabId; label: string; icon: React.ElementType; onlyEdit?: boolean }[] = [
  { id: 'generale', label: 'Generale', icon: ClipboardList },
  { id: 'gruppi', label: 'Gruppi', icon: Users, onlyEdit: true },
  { id: 'programma', label: 'Programma', icon: CalendarDays },
  { id: 'menu', label: 'Menù', icon: UtensilsCrossed },
  { id: 'spesa', label: 'Spesa', icon: ShoppingCart },
  { id: 'preventivo', label: 'Preventivo', icon: Calculator },
  { id: 'iscrizioni', label: 'Iscrizioni', icon: DollarSign },
  { id: 'acquisti', label: 'Acquisti', icon: PlusCircle },
  { id: 'documenti', label: 'Documenti', icon: FolderOpen },
  { id: 'foto', label: 'Foto', icon: Image },
  { id: 'messaggi', label: 'Messaggi', icon: MessageSquare, onlyEdit: true },
  { id: 'social', label: 'Social', icon: Share2 },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CampoDetailPage() {
  const { campoId } = useParams<{ campoId: string }>();
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserLoading } = useUserData();

  const [activeTab, setActiveTab] = useState<TabId>('generale');
  const [costoSpesaMenu, setCostoSpesaMenu] = useState<number | undefined>(undefined);

  // Editing state
  const [isEditingGenerale, setIsEditingGenerale] = useState(false);
  const [isSavingGenerale, setIsSavingGenerale] = useState(false);
  const [descrizione, setDescrizione] = useState('');
  const [note, setNote] = useState('');

  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const [selectedGruppi, setSelectedGruppi] = useState<string[]>([]);
  const [isSavingGroups, setIsSavingGroups] = useState(false);

  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Evento | null>(null);
  const [isRaccoltaDialogOpen, setIsRaccoltaDialogOpen] = useState(false);
  const [availablePhotos, setAvailablePhotos] = useState<any[]>([]);

  // ─── Firestore queries ────────────────────────────────────────────────────
  const campoDocRef = useMemoFirebase(
    () => firestore ? doc(firestore, 'campi', campoId) : null,
    [firestore, campoId]
  );
  const { data: campo, isLoading: isLoadingCampo } = useDoc<Campo>(campoDocRef);

  const allGroupsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'gruppi') : null, [firestore]);
  const { data: allGroups } = useCollection<Group>(allGroupsQuery);

  const myGroupsQuery = useMemoFirebase(() =>
    (firestore && user && userData?.roles?.includes('educatore'))
      ? query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid))
      : null,
    [firestore, user, userData]);
  const { data: myGroups, isLoading: isLoadingMyGroups } = useCollection<Group>(myGroupsQuery);

  const campoEventsQuery = useMemoFirebase(() =>
    (firestore && campo) ? query(collection(firestore, 'eventi'), where('campoId', '==', campoId)) : null,
    [firestore, campo, campoId]);
  const { data: rawCampoEvents, isLoading: isLoadingEvents } = useCollection<Evento>(campoEventsQuery);

  const campoEvents = useMemo(() => {
    if (!rawCampoEvents) return [];
    return [...rawCampoEvents].sort((a, b) => {
      const dA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
      const dB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
      return dA.getTime() - dB.getTime();
    });
  }, [rawCampoEvents]);

  const raccoltaDocRef = useMemoFirebase(() =>
    firestore && (campo as any)?.raccoltaId ? doc(firestore, 'raccolte', (campo as any).raccoltaId) : null,
    [firestore, campo]);
  const { data: raccoltaData, isLoading: isLoadingRaccolta } = useDoc<Raccolta>(raccoltaDocRef);

  // ─── Permissions ──────────────────────────────────────────────────────────
  const isAdmin = useMemo(() => userData?.roles?.includes('admin') ?? false, [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore') ?? false, [userData]);
  const canEdit = useMemo(() => isAdmin || isEducatore, [isAdmin, isEducatore]);

  const hasPermission = useMemo(() => {
    if (!campo || !userData || !user) return false;
    if (isAdmin) return true;
    if (isEducatore) {
      // still loading myGroups → can't decide yet, don't deny
      if (isLoadingMyGroups || !myGroups) return false;
      const myGroupIds = new Set(myGroups.map(g => g.id));
      return (campo.groupIds || []).some(id => myGroupIds.has(id));
    }
    // altri ruoli: accesso negato alla pagina campo
    return false;
  }, [campo, userData, user, isAdmin, isEducatore, myGroups, isLoadingMyGroups]);

  // Init state from campo data
  useEffect(() => {
    if (campo) {
      setDescrizione((campo as any).descrizione || '');
      setNote((campo as any).note || '');
      setSelectedGruppi(campo.groupIds || []);
    }
  }, [campo]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveGenerale = async () => {
    if (!firestore) return;
    setIsSavingGenerale(true);
    try {
      await updateDoc(doc(firestore, 'campi', campoId), { descrizione, note });
      setIsEditingGenerale(false);
    } catch (e) { console.error(e); } finally { setIsSavingGenerale(false); }
  };

  const handleSaveGroups = useCallback(async () => {
    if (!firestore || !campo) return;
    setIsSavingGroups(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'campi', campoId), { groupIds: selectedGruppi });
      // Also update linked evento
      const evSnap = await getDocs(query(collection(firestore, 'eventi'), where('campoId', '==', campoId)));
      if (!evSnap.empty) batch.update(evSnap.docs[0].ref, { groupIds: selectedGruppi });
      if ((campo as any).raccoltaId) {
        batch.update(doc(firestore, 'raccolte', (campo as any).raccoltaId), { gruppiId: selectedGruppi });
      }
      await batch.commit();
      setIsEditingGroups(false);
    } catch (e) { console.error(e); } finally { setIsSavingGroups(false); }
  }, [firestore, campo, campoId, selectedGruppi]);

  const handleToggleArchive = async () => {
    if (!firestore || !campo) return;
    const newStatus = campo.status === 'archiviato' ? 'attivo' : 'archiviato';
    await updateDoc(doc(firestore, 'campi', campoId), { status: newStatus });
  };

  const handleToggleEventCompleted = async (evento: Evento) => {
    if (!firestore || !canEdit) return;
    await updateDoc(doc(firestore, 'eventi', evento.id), { completed: !evento.completed });
  };

  const handleLinkRaccoltaToCampo = useCallback(async (raccoltaId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'campi', campoId), { raccoltaId });
  }, [firestore, campoId]);

  const handleFolderCreated = useCallback(async (folderId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'campi', campoId), { driveFolderId: folderId });
  }, [firestore, campoId]);

  // ─── Loading / Auth ───────────────────────────────────────────────────────
  // Show loader while data is still loading (prevents flashing permission-denied)
  if (isLoadingCampo || isUserLoading || (isEducatore && isLoadingMyGroups)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campo) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/campi"><ArrowLeft className="h-4 w-4 mr-2" />Torna ai campi</Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Campo non trovato.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasPermission && campo) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/campi"><ArrowLeft className="h-4 w-4 mr-2" />Torna ai campi</Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Non hai i permessi per visualizzare questo campo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const tipoConfig = TIPO_CONFIG[campo.tipo] ?? TIPO_CONFIG.campo_estivo;
  const Icon = tipoConfig.icon;

  const visibleTabs = ALL_TABS.filter(t => !t.onlyEdit || canEdit);

  // ─── Sub-components ───────────────────────────────────────────────────────
  const GeneraleContent = () => (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <Label className="text-sm font-semibold">Descrizione</Label>
          {isEditingGenerale ? (
            <Textarea value={descrizione} onChange={e => setDescrizione(e.target.value)}
              placeholder="Inserisci una descrizione..." rows={3} />
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{descrizione || 'Nessuna descrizione.'}</p>
          )}
        </div>
        {canEdit && !isEditingGenerale && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setIsEditingGenerale(true)}>
            Modifica
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-semibold">Note</Label>
        {isEditingGenerale ? (
          <Textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note aggiuntive..." rows={2} />
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note || 'Nessuna nota.'}</p>
        )}
      </div>

      {isEditingGenerale && (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => { setIsEditingGenerale(false); setDescrizione((campo as any).descrizione || ''); setNote((campo as any).note || ''); }}>
            Annulla
          </Button>
          <Button size="sm" onClick={handleSaveGenerale} disabled={isSavingGenerale}>
            {isSavingGenerale && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva
          </Button>
        </div>
      )}

      <Separator />

      <div>
        <Label className="text-sm font-semibold">Tipo di campo</Label>
        <div className="mt-2">
          <Badge variant="secondary" className={`gap-1.5 ${tipoConfig.color}`}>
            <Icon className="h-4 w-4" />
            {tipoConfig.label}
          </Badge>
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold">Date</Label>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDateRange(campo.startDate, campo.endDate)}
        </p>
      </div>

      {canEdit && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Archivia campo</p>
              <p className="text-xs text-muted-foreground">Il campo sparirà dalla sidebar e dai campi attivi.</p>
            </div>
            <Button
              variant={campo.status === 'archiviato' ? 'outline' : 'secondary'}
              className={campo.status !== 'archiviato' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-300' : ''}
              onClick={handleToggleArchive}
              size="sm"
            >
              {campo.status === 'archiviato'
                ? <><ArchiveRestore className="w-4 h-4 mr-2" />Ripristina</>
                : <><Archive className="w-4 h-4 mr-2" />Archivia</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const GruppiContent = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {allGroups?.filter(g => selectedGruppi.includes(g.id)).map(g => (
            <span key={g.id} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{g.name}</span>
          )) || <span className="text-xs text-muted-foreground">Nessun gruppo.</span>}
        </div>
        {canEdit && !isEditingGroups && (
          <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={() => setIsEditingGroups(true)}>Modifica</Button>
        )}
      </div>
      {isEditingGroups && (
        <div className="mt-3 p-3 border rounded-lg bg-muted/30 space-y-3">
          <div className="flex flex-wrap gap-2">
            {allGroups?.map(group => (
              <button key={group.id}
                onClick={() => setSelectedGruppi(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedGruppi.includes(group.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-muted-foreground/30 hover:border-primary hover:text-primary'}`}>
                {selectedGruppi.includes(group.id) && <X className="h-2.5 w-2.5" />}
                {group.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setIsEditingGroups(false); setSelectedGruppi(campo.groupIds || []); }}>Annulla</Button>
            <Button size="sm" onClick={handleSaveGroups} disabled={isSavingGroups}>
              {isSavingGroups && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const ProgrammaContent = () => (
    <div>
      {isLoadingEvents ? (
        <p className="text-center text-muted-foreground p-8">Caricamento impegni...</p>
      ) : campoEvents.length > 0 ? (
        <div className="space-y-2">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[50px]" />
                  <TableHead>Impegno</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Note</TableHead>
                  {canEdit && <TableHead className="text-right">Azioni</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {campoEvents.map(evento => (
                  <TableRow key={evento.id} className={evento.completed ? 'bg-muted/30' : ''}>
                    <TableCell>
                      <Button variant="ghost" size="icon" disabled={!canEdit}
                        onClick={() => handleToggleEventCompleted(evento)}
                        className={evento.completed ? 'text-green-600' : 'text-muted-foreground'}>
                        {evento.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${evento.completed ? 'line-through text-muted-foreground' : ''}`}>{evento.title}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span>{formatEventDate(evento.startDate)}</span>
                        <span>{formatEventDate(evento.endDate)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {evento.notes ? <p className="text-sm line-clamp-1">{evento.notes}</p> : <span className="text-xs text-muted-foreground/50 italic">—</span>}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingEvent(evento); setIsEventDialogOpen(true); }}>Modifica</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-center text-muted-foreground pt-2 border-t">Sincronizzati col Calendario generale.</p>
        </div>
      ) : (
        <div className="text-center text-muted-foreground p-8 border border-dashed rounded-lg">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p>Nessun impegno in programma.</p>
          {canEdit && (
            <Button size="sm" className="mt-3" onClick={() => { setEditingEvent(null); setIsEventDialogOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" />Aggiungi impegno
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const IscrizioniContent = () => (
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
          {canEdit && (
            <Accordion type="single" collapsible className="w-full">
              <RaccoltaCard raccolta={raccoltaData} onEdit={() => setIsRaccoltaDialogOpen(true)} />
            </Accordion>
          )}
        </>
      ) : canEdit ? (
        <div className="flex items-center gap-3 p-4 border border-dashed rounded-lg">
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

  // Shared props
  const docManagerProps = {
    projectId: campoId,
    projectName: campo.nome,
    driveFolderId: campo.driveFolderId,
    canEdit,
    onFolderCreated: handleFolderCreated,
  };
  const photoManagerProps = { ...docManagerProps, groupIds: campo.groupIds || [], onPhotosChange: setAvailablePhotos };
  const messagePlannerProps = {
    projectId: campoId, projectName: campo.nome,
    projectDescription: (campo as any).descrizione,
    projectStartDate: campo.startDate?.toDate ? campo.startDate.toDate().toLocaleDateString('it-IT') : undefined,
    projectEndDate: campo.endDate?.toDate ? campo.endDate.toDate().toLocaleDateString('it-IT') : undefined,
    canEdit,
  };
  const socialPlannerProps = { ...messagePlannerProps, groupIds: campo.groupIds || [], availablePhotos };

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Shared dialogs */}
      <NuovaRaccoltaDialog
        isOpen={isRaccoltaDialogOpen} onOpenChange={setIsRaccoltaDialogOpen}
        raccoltaToEdit={raccoltaData}
        initialData={!raccoltaData && campo ? { nome: `Raccolta per: ${campo.nome}`, gruppiId: campo.groupIds } : undefined}
        onSaveSuccess={handleLinkRaccoltaToCampo}
      />
      <AddEventDialog
        isOpen={isEventDialogOpen} onOpenChange={setIsEventDialogOpen} eventToEdit={editingEvent}
      />

      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href="/campi">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Tutti i campi
        </Link>
      </Button>

      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border ${tipoConfig.bgColor}`}>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-background/60">
            <Tent className={`h-6 w-6 ${tipoConfig.color}`} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${tipoConfig.color}`}>
              {campo.nome}
              {campo.status === 'archiviato' && (
                <span className="ml-2 text-sm font-normal bg-background/60 text-muted-foreground px-2 py-0.5 rounded-md">Archiviato</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDateRange(campo.startDate, campo.endDate)}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className={`self-start sm:self-auto text-sm gap-1.5 px-3 py-1 ${tipoConfig.color}`}>
          <Icon className="h-4 w-4" />
          {tipoConfig.label}
        </Badge>
      </div>

      {/* Pill navigation */}
      <div className="flex gap-2 flex-wrap">
        {visibleTabs.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${activeTab === tab.id ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground border-border'}`}>
              <TabIcon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {(() => { const T = ALL_TABS.find(t => t.id === activeTab)?.icon ?? ClipboardList; return <T className="h-4 w-4" />; })()}
            </div>
            <CardTitle className="text-base">
              {ALL_TABS.find(t => t.id === activeTab)?.label}
            </CardTitle>
          </div>
          {/* Tab-specific actions */}
          {activeTab === 'programma' && canEdit && (
            <Button size="sm" onClick={() => { setEditingEvent(null); setIsEventDialogOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" />Nuovo
            </Button>
          )}
          {activeTab === 'iscrizioni' && canEdit && raccoltaData && (
            <Button size="sm" variant="outline" onClick={() => setIsRaccoltaDialogOpen(true)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />Gestisci
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-5">
          {activeTab === 'generale' && <GeneraleContent />}
          {activeTab === 'gruppi' && <GruppiContent />}
          {activeTab === 'programma' && <ProgrammaContent />}
          {activeTab === 'menu' && (
            <TabMenuCampo
              campoId={campoId}
              canEdit={canEdit}
              raccoltaId={(campo as any).raccoltaId}
              onCostoSpesaChange={setCostoSpesaMenu}
            />
          )}
          {activeTab === 'spesa' && (
            <TabSpesaCampo campoId={campoId} />
          )}
          {activeTab === 'preventivo' && (
            <TabPreventivooCampo
              campoId={campoId}
              costoSpesaCalcolato={costoSpesaMenu}
            />
          )}
          {activeTab === 'iscrizioni' && <IscrizioniContent />}
          {activeTab === 'acquisti' && (
            <AcquistiList projectId={campoId} canEdit={canEdit} collectionRoot="campi" />
          )}
          {activeTab === 'documenti' && (
            <DocumentManager
              projectId={campoId}
              projectName={campo.nome}
              driveFolderId={campo.driveFolderId}
              canEdit={canEdit}
              onFolderCreated={handleFolderCreated}
              folderApiEndpoint="/api/drive/campi-folder"
            />
          )}
          {activeTab === 'foto' && (
            <PhotoManager
              projectId={campoId}
              projectName={campo.nome}
              groupIds={campo.groupIds || []}
              driveFolderId={campo.driveFolderId}
              canEdit={canEdit}
              onFolderCreated={handleFolderCreated}
              onPhotosChange={setAvailablePhotos}
              folderApiEndpoint="/api/drive/campi-folder"
            />
          )}
          {activeTab === 'messaggi' && canEdit && (
            <MessagePlanner
              projectId={campoId}
              projectName={campo.nome}
              projectDescription={(campo as any).descrizione}
              projectStartDate={campo.startDate?.toDate ? campo.startDate.toDate().toLocaleDateString('it-IT') : undefined}
              projectEndDate={campo.endDate?.toDate ? campo.endDate.toDate().toLocaleDateString('it-IT') : undefined}
              canEdit={canEdit}
              collectionRoot="campi"
            />
          )}
          {activeTab === 'social' && (
            <SocialPlanner
              projectId={campoId}
              projectName={campo.nome}
              projectDescription={(campo as any).descrizione}
              projectStartDate={campo.startDate?.toDate ? campo.startDate.toDate().toLocaleDateString('it-IT') : undefined}
              projectEndDate={campo.endDate?.toDate ? campo.endDate.toDate().toLocaleDateString('it-IT') : undefined}
              groupIds={campo.groupIds || []}
              canEdit={canEdit}
              availablePhotos={availablePhotos}
              collectionRoot="campi"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
