'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  Clock,
  FileText,
  Users,
  CheckSquare,
  AlignLeft,
  StickyNote,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import type { Evento } from '@/components/add-event-dialog';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/src/firebase';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  collectionGroup,
  query,
  where,
} from 'firebase/firestore';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';
import DocumentManager from '@/components/document-manager';

interface Partecipante {
  id: string;
  membroId: string;
  presente: boolean;
  registratoAt?: any;
}

interface Progetto {
  id: string;
  driveFolderId?: string;
  name: string;
}

interface GroupEventDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: Evento | null;
  groupId: string;
  groupName: string;
  memberIds: string[];
  canEdit: boolean;
}

function formatEventDate(event: Evento): string {
  if (!event.startDate) return '—';
  const start = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
  const end = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);

  if (event.allDay) {
    const startStr = format(start, 'EEEE d MMMM yyyy', { locale: itLocale });
    const endIsSameDay =
      format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
    if (endIsSameDay) return startStr.charAt(0).toUpperCase() + startStr.slice(1);
    const endStr = format(end, 'd MMMM yyyy', { locale: itLocale });
    return `${startStr.charAt(0).toUpperCase() + startStr.slice(1)} → ${endStr}`;
  }

  const dateStr = format(start, 'EEEE d MMMM yyyy', { locale: itLocale });
  const startTime = format(start, 'HH:mm');
  const endTime = format(end, 'HH:mm');
  return `${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}, ${startTime} – ${endTime}`;
}

export function GroupEventDetailDialog({
  isOpen,
  onOpenChange,
  event,
  groupId,
  groupName,
  memberIds,
  canEdit,
}: GroupEventDetailDialogProps) {
  const firestore = useFirestore();
  const [attendanceSaving, setAttendanceSaving] = useState<Record<string, boolean>>({});
  const [localAttendance, setLocalAttendance] = useState<Record<string, boolean>>({});
  const [savedFeedback, setSavedFeedback] = useState<Record<string, boolean>>({});

  // -------- Members of this group (filtered by memberIds) --------
  const membriQuery = useMemoFirebase(() => {
    if (!firestore || !memberIds || memberIds.length === 0) return null;
    return collectionGroup(firestore, 'membri');
  }, [firestore, memberIds]);
  const { data: allMembri } = useCollection<Membro>(membriQuery);

  const placeholdersQuery = useMemoFirebase(() => {
    if (!firestore || !memberIds || memberIds.length === 0) return null;
    return collection(firestore, 'imported-members');
  }, [firestore, memberIds]);
  const { data: allPlaceholders } = useCollection<any>(placeholdersQuery);

  const membri = useMemo(() => {
    if (!allMembri && !allPlaceholders) return [];
    if (!memberIds) return [];
    const memberIdSet = new Set(memberIds);
    
    const validMembri = (allMembri || []).filter(m => memberIdSet.has(m.id));
    const validPlaceholders = (allPlaceholders || []).filter(m => memberIdSet.has(m.id)).map(p => ({
        ...p,
        isPlaceholder: true
    }));

    return [...validMembri, ...validPlaceholders].sort((a, b) => 
        `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it')
    );
  }, [allMembri, allPlaceholders, memberIds]);

  // -------- Existing attendance for this event --------
  const presenzaColRef = useMemoFirebase(() => {
    if (!firestore || !event?.id) return null;
    return collection(firestore, 'presenze', event.id, 'partecipanti');
  }, [firestore, event?.id]);
  const { data: partecipanti } = useCollection<Partecipante>(presenzaColRef);

  // -------- Project (for Drive) --------
  const progettoDocRef = useMemoFirebase(() => {
    if (!firestore || !event?.isProject || !event?.projectId) return null;
    return doc(firestore, 'progetti', event.projectId);
  }, [firestore, event?.isProject, event?.projectId]);
  const { data: progetto } = useDoc<Progetto>(progettoDocRef);

  // Sync local attendance state from Firestore data
  useEffect(() => {
    if (!partecipanti) return;
    const map: Record<string, boolean> = {};
    partecipanti.forEach((p) => {
      map[p.membroId] = p.presente;
    });
    setLocalAttendance(map);
  }, [partecipanti]);

  // Reset when dialog opens on a new event
  useEffect(() => {
    if (isOpen) {
      setSavedFeedback({});
    }
  }, [isOpen, event?.id]);

  const handleTogglePresenza = useCallback(
    async (membro: Membro, presente: boolean) => {
      if (!firestore || !event?.id) return;

      // Optimistic update
      setLocalAttendance((prev) => ({ ...prev, [membro.id]: presente }));
      setAttendanceSaving((prev) => ({ ...prev, [membro.id]: true }));

      try {
        const presenzaRef = doc(
          firestore,
          'presenze',
          event.id,
          'partecipanti',
          membro.id
        );
        await setDoc(
          presenzaRef,
          {
            membroId: membro.id,
            nome: membro.nome,
            cognome: membro.cognome,
            presente,
            registratoAt: serverTimestamp(),
          },
          { merge: true }
        );
        setSavedFeedback((prev) => ({ ...prev, [membro.id]: true }));
        setTimeout(() => {
          setSavedFeedback((prev) => ({ ...prev, [membro.id]: false }));
        }, 1800);
      } catch (err) {
        console.error('Errore salvataggio presenza:', err);
        // Revert
        setLocalAttendance((prev) => ({ ...prev, [membro.id]: !presente }));
      } finally {
        setAttendanceSaving((prev) => ({ ...prev, [membro.id]: false }));
      }
    },
    [firestore, event?.id]
  );

  if (!event) return null;

  const dateStr = formatEventDate(event);
  const presentCount = Object.values(localAttendance).filter(Boolean).length;
  const totalMembers = membri?.length ?? 0;
  const hasProject = event.isProject && event.projectId;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl leading-tight">{event.title}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {dateStr}
              </DialogDescription>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {event.completed && (
                <Badge className="bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Completato
                </Badge>
              )}
              {hasProject && (
                <Badge variant="outline">Progetto</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator className="shrink-0" />

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="dettagli" className="h-full flex flex-col">
            <TabsList className="shrink-0 w-full grid grid-cols-3">
              <TabsTrigger value="dettagli" className="flex items-center gap-1.5">
                <AlignLeft className="h-3.5 w-3.5" /> Dettagli
              </TabsTrigger>
              <TabsTrigger value="presenze" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Presenze
                {totalMembers > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {presentCount}/{totalMembers}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="documenti" className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Documenti
              </TabsTrigger>
            </TabsList>

            {/* ---- Tab: Dettagli ---- */}
            <TabsContent value="dettagli" className="flex-1 overflow-y-auto mt-3 space-y-4 pr-1">
              {event.description ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <AlignLeft className="h-3.5 w-3.5" /> Descrizione
                  </p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{event.description}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nessuna descrizione per questo impegno.</p>
              )}

              {event.notes && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <StickyNote className="h-3.5 w-3.5" /> Note / Esito
                    </p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{event.notes}</p>
                  </div>
                </>
              )}

              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Durata
                  </p>
                  <p>{event.allDay ? 'Tutto il giorno' : 'Con orario'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5" /> Stato
                  </p>
                  <p>{event.completed ? 'Completato' : 'In programma'}</p>
                </div>
              </div>
            </TabsContent>

            {/* ---- Tab: Presenze ---- */}
            <TabsContent value="presenze" className="flex-1 mt-3 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <p className="text-sm text-muted-foreground">
                  {totalMembers === 0
                    ? 'Nessun ragazzo nel gruppo.'
                    : `${presentCount} presenti su ${totalMembers} ragazzi`}
                </p>
                {totalMembers > 0 && (
                  <div
                    className="h-2 rounded-full bg-muted overflow-hidden"
                    style={{ width: '120px' }}
                  >
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{
                        width: `${totalMembers > 0 ? (presentCount / totalMembers) * 100 : 0}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-2">
                  {(!membri || membri.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nessun ragazzo iscritto al gruppo &quot;{groupName}&quot;.
                    </p>
                  )}
                  {membri &&
                    [...membri]
                      .sort((a, b) =>
                        `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it')
                      )
                      .map((m) => {
                        const presente = localAttendance[m.id] ?? false;
                        const isSaving = attendanceSaving[m.id] ?? false;
                        const wasSaved = savedFeedback[m.id] ?? false;

                        return (
                          <div
                            key={m.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              presente
                                ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800'
                                : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <Checkbox
                              id={`presenza-${m.id}`}
                              checked={presente}
                              onCheckedChange={(checked) =>
                                canEdit
                                  ? handleTogglePresenza(m, !!checked)
                                  : undefined
                              }
                              disabled={!canEdit || isSaving}
                              className="shrink-0"
                            />
                            <label
                              htmlFor={`presenza-${m.id}`}
                              className="flex-1 text-sm font-medium cursor-pointer select-none flex items-center gap-2"
                            >
                              {m.cognome} {m.nome}
                              {(m as any).isPlaceholder && (
                                  <Badge
                                   variant="outline"
                                   className="text-[10px] text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 px-1.5 py-0 h-4"
                                 >
                                   Da confermare
                                 </Badge>
                              )}
                            </label>
                            {isSaving && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                            )}
                            {!isSaving && wasSaved && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            )}
                            {!isSaving && !wasSaved && (
                              <span
                                className={`text-xs shrink-0 ${
                                  presente ? 'text-green-600 font-medium' : 'text-muted-foreground'
                                }`}
                              >
                                {presente ? 'Presente' : 'Assente'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ---- Tab: Documenti ---- */}
            <TabsContent value="documenti" className="flex-1 mt-3 overflow-y-auto">
              {hasProject ? (
                <DocumentManager
                  projectId={event.projectId!}
                  projectName={event.title}
                  driveFolderId={progetto?.driveFolderId}
                  canEdit={canEdit}
                  onFolderCreated={() => {
                    // Folder created — DocumentManager will reload automatically
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center gap-3">
                  <FileText className="h-10 w-10 opacity-30" />
                  <div>
                    <p className="text-sm font-medium">Nessun documento collegato</p>
                    <p className="text-xs mt-1">
                      Gli allegati Drive sono disponibili solo per gli impegni di tipo Progetto.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
