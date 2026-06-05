'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Loader2, Trash2 } from 'lucide-react';
import { useGoogleCalendar } from '@/src/hooks/use-google-calendar';
import { useAuth } from '@/src/firebase';
import { triggerNotification } from '@/lib/trigger-notification';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import { Separator } from './ui/separator';
import { slugify } from '@/lib/utils';
import { ConfirmationDialog } from './confirmation-dialog';
import { isSameDay } from 'date-fns';

/** Adds 1 hour to a HH:mm string; returns new time and whether it crossed midnight. */
function addOneHour(time: string): { time: string; nextDay: boolean } {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + 60;
  const nextDay = totalMinutes >= 24 * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return {
    time: `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`,
    nextDay,
  };
}

export type TipoCampo = 'campo_elementari' | 'campo_medie' | 'campo_estivo';

export const TIPO_CAMPO_LABELS: Record<TipoCampo, string> = {
    campo_elementari: 'Campo Elementari',
    campo_medie: 'Campo Medie',
    campo_estivo: 'Campo Estivo',
};

export interface Campo {
    id: string;
    nome: string;
    tipo: TipoCampo;
    eventoId: string;
    startDate: any;
    endDate: any;
    groupIds: string[];
    createdAt: any;
    status?: 'attivo' | 'archiviato';
    driveFolderId?: string;
    descrizione?: string;
    note?: string;
}

export interface Evento {
    id: string;
    title: string;
    description?: string;
    notes?: string;
    completed?: boolean;
    startDate: any;
    endDate: any;
    allDay: boolean;
    groupIds: string[];
    isProject?: boolean;
    projectId?: string;
    raccoltaId?: string;
    isCampo?: boolean;
    tipoCampo?: TipoCampo;
    campoId?: string;
}

export interface Progetto {
    id: string;
    name: string;
    slug: string;
    description?: string;
    startDate: any;
    endDate: any;
    allDay: boolean;
    groupIds: string[];
    createdAt: any;
    driveFolderId?: string;
    responsabiliIds?: string[];
    status?: 'attivo' | 'archiviato';
}


interface AddEventDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  eventToEdit?: Evento | null;
  initialDate?: Date | null;
}

export function AddEventDialog({ isOpen, onOpenChange, eventToEdit, initialDate }: AddEventDialogProps) {
    const firestore = useFirestore();
    const auth = useAuth();
    const isEditing = !!eventToEdit;

    // Event state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>(new Date());
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    const [allDay, setAllDay] = useState(true);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [completed, setCompleted] = useState(false);
    
    // Project state
    const [isProject, setIsProject] = useState(false);

    // Campo state
    const [isCampo, setIsCampo] = useState(false);
    const [tipoCampo, setTipoCampo] = useState<TipoCampo>('campo_estivo');
    
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const { isConnected, broadcastEvent } = useGoogleCalendar();
    const [pushToGcal, setPushToGcal] = useState(false);
    
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);


    const groupsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'gruppi');
    }, [firestore]);
    const { data: groups, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);
    
    const resetForm = useCallback((defaultDate?: Date | null) => {
        const now = defaultDate ?? new Date();
        setTitle('');
        setDescription('');
        setStartDate(now);
        setEndDate(now);
        setAllDay(true);
        setStartTime('09:00');
        setEndTime('10:00');
        setSelectedGroups([]);
        setError(null);
        setIsSaving(false);
        setIsProject(false);
        setIsCampo(false);
        setTipoCampo('campo_estivo');
        setNotes('');
        setCompleted(false);
        setPushToGcal(!!isConnected);
    }, [isConnected]);

    useEffect(() => {
        if (isOpen) {
             if (isEditing && eventToEdit) {
                setTitle(eventToEdit.title);
                setDescription(eventToEdit.description || '');
                const start = eventToEdit.startDate?.toDate ? eventToEdit.startDate.toDate() : new Date(eventToEdit.startDate);
                const end = eventToEdit.endDate?.toDate ? eventToEdit.endDate.toDate() : new Date(eventToEdit.endDate);
                setStartDate(start);
                setEndDate(end);
                setAllDay(eventToEdit.allDay);
                 if (!eventToEdit.allDay) {
                    setStartTime(format(start, 'HH:mm'));
                    setEndTime(format(end, 'HH:mm'));
                }
                setSelectedGroups(eventToEdit.groupIds);
                setIsProject(eventToEdit.isProject || false);
                setIsCampo(eventToEdit.isCampo || false);
                setTipoCampo(eventToEdit.tipoCampo || 'campo_estivo');
                setNotes(eventToEdit.notes || '');
                setCompleted(eventToEdit.completed || false);

             } else {
                resetForm(initialDate);
            }
        }
    }, [isOpen, eventToEdit, isEditing, resetForm, initialDate]);

    useEffect(() => {
        if (startDate && endDate && startDate > endDate) {
            setEndDate(startDate);
        }
    }, [startDate, endDate]);

    // Auto-update end time to startTime + 1h when start time changes (non-allDay events)
    useEffect(() => {
        if (allDay) return;
        const { time: newEndTime, nextDay } = addOneHour(startTime);
        setEndTime(newEndTime);
        if (nextDay && startDate) {
            const nextDate = new Date(startDate);
            nextDate.setDate(nextDate.getDate() + 1);
            setEndDate(nextDate);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startTime, allDay]);
    
    const handleGroupToggle = (groupId: string, isChecked: boolean) => {
        setSelectedGroups(prev => 
            isChecked ? [...prev, groupId] : prev.filter(id => id !== groupId)
        );
    };

    const handleSave = async () => {
        setError(null);
        if (!title) { setError("Il titolo è obbligatorio."); return; }
        if (!startDate || !endDate) { setError("Le date di inizio e fine sono obbligatorie."); return; }
        if (selectedGroups.length === 0) { setError("Seleziona almeno un gruppo."); return; }
        
        const finalStartDate = new Date(startDate);
        const finalEndDate = new Date(endDate);

        if (!allDay) {
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            finalStartDate.setHours(startHours, startMinutes, 0, 0);

            const [endHours, endMinutes] = endTime.split(':').map(Number);
            finalEndDate.setHours(endHours, endMinutes, 0, 0);
        } else {
            finalStartDate.setHours(0, 0, 0, 0);
            finalEndDate.setHours(23, 59, 59, 999);
        }
        
        if (finalEndDate < finalStartDate) {
            setError("La data e l'ora di fine non possono essere precedenti a quelle di inizio.");
            return;
        }

        setIsSaving(true);
        
        try {
            if (!firestore) throw new Error("Firestore non disponibile.");

            if (isEditing && eventToEdit) {
                // --- UPDATE LOGIC ---
                const batch = writeBatch(firestore);

                // 1. Update the Event document
                const eventDocRef = doc(firestore, 'eventi', eventToEdit.id);
                const eventData = {
                    title,
                    description,
                    notes,
                    completed,
                    startDate: finalStartDate,
                    endDate: finalEndDate,
                    allDay,
                    groupIds: selectedGroups,
                };
                batch.update(eventDocRef, eventData);

                // 2. If it's a project, update the linked Project document
                if (eventToEdit.isProject && eventToEdit.projectId) {
                    const projectDocRef = doc(firestore, 'progetti', eventToEdit.projectId);
                    const projectData = {
                        name: title,
                        slug: slugify(title),
                        description,
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        allDay,
                        groupIds: selectedGroups,
                    };
                    batch.update(projectDocRef, projectData);
                }

                // 3. If it's a campo event, update the linked Campo document
                if (eventToEdit.isCampo && eventToEdit.campoId) {
                    const campoDocRef = doc(firestore, 'campi', eventToEdit.campoId);
                    batch.update(campoDocRef, {
                        nome: title,
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        groupIds: selectedGroups,
                    });
                }

                await batch.commit();

                // Sync update with Google Calendar (fire-and-forget with auth token)
                auth.currentUser?.getIdToken().then(token =>
                    fetch('/api/calendar/broadcast', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            action: 'update',
                            oldEvent: {
                                title: eventToEdit.title,
                                startDate: eventToEdit.startDate?.toDate ? eventToEdit.startDate.toDate().toISOString() : new Date(eventToEdit.startDate).toISOString(),
                                endDate: eventToEdit.endDate?.toDate ? eventToEdit.endDate.toDate().toISOString() : new Date(eventToEdit.endDate).toISOString(),
                                allDay: eventToEdit.allDay,
                                groupIds: eventToEdit.groupIds,
                            },
                            newEvent: {
                                title,
                                description: description || notes,
                                startDate: finalStartDate.toISOString(),
                                endDate: finalEndDate.toISOString(),
                                allDay,
                                groupIds: selectedGroups,
                            }
                        })
                    })
                ).catch(console.error);

                // Trigger notifica broadcast
                const startFormatted = format(finalStartDate, 'd MMMM yyyy', { locale: itLocale });
                triggerNotification({
                  eventType: 'evento_modificato',
                  title: `📅 Impegno modificato: ${title}`,
                  body: `L'impegno "${title}" è stato aggiornato (${startFormatted}).`,
                  href: '/calendario',
                });

            } else {
                // --- CREATE LOGIC ---
                if (isCampo) {
                    // Create both Campo and Evento
                    const batch = writeBatch(firestore);

                    const campoDocRef = doc(collection(firestore, 'campi'));
                    const eventoDocRef = doc(collection(firestore, 'eventi'));

                    const campoData: Omit<Campo, 'id'> = {
                        nome: title,
                        tipo: tipoCampo,
                        eventoId: eventoDocRef.id,
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        groupIds: selectedGroups,
                        createdAt: serverTimestamp(),
                        status: 'attivo',
                    };
                    batch.set(campoDocRef, campoData);

                    const eventoData: Omit<Evento, 'id' | 'raccoltaId' | 'isProject' | 'projectId'> = {
                        title,
                        description,
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        allDay,
                        groupIds: selectedGroups,
                        isCampo: true,
                        tipoCampo,
                        campoId: campoDocRef.id,
                        notes: '',
                        completed: false,
                    };
                    batch.set(eventoDocRef, eventoData);

                    await batch.commit();

                    const startFormatted = format(finalStartDate, 'd MMMM yyyy', { locale: itLocale });
                    triggerNotification({
                        eventType: 'evento_nuovo',
                        title: `⛺ Nuovo campo: ${title}`,
                        body: `È stato creato il campo "${title}" con inizio il ${startFormatted}.`,
                        href: '/campi',
                    });

                } else if (isProject) {
                    // Create both Progetto and Evento
                    const batch = writeBatch(firestore);
                    
                    const progettoDocRef = doc(collection(firestore, 'progetti'));
                    const progettoId = progettoDocRef.id;
                    const progettoData: Omit<Progetto, 'id'> = {
                        name: title,
                        slug: slugify(title),
                        description,
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        allDay,
                        groupIds: selectedGroups,
                        createdAt: serverTimestamp(),
                    };
                    batch.set(progettoDocRef, progettoData);

                    const eventoDocRef = doc(collection(firestore, 'eventi'));
                    const eventoData: Omit<Evento, 'id' | 'raccoltaId'> = {
                        title,
                        description,
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        allDay,
                        groupIds: selectedGroups,
                        isProject: true,
                        projectId: progettoId,
                        notes: '',
                        completed: false,
                    };
                    batch.set(eventoDocRef, eventoData);

                    await batch.commit();

                    // Trigger notifica progetto/evento
                    const startFormatted = format(finalStartDate, 'd MMMM yyyy', { locale: itLocale });
                    triggerNotification({
                      eventType: 'progetto_nuovo',
                      title: `🚀 Nuovo evento: ${title}`,
                      body: `È stato creato l'evento "${title}" con inizio il ${startFormatted}.`,
                      href: '/progetti',
                    });

                    // Fire-and-forget: create Drive folder in background (non-blocking)
                    // This will silently fail if Drive is not yet configured, which is fine
                    fetch('/api/drive/folders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectId: progettoId, projectName: title }),
                    }).catch((e) => console.warn('Drive folder creation skipped (Drive not configured):', e));

                } else {
                    // Create a simple Event
                    const eventData: Omit<Evento, 'id' | 'projectId' | 'isProject'> = {
                        title,
                        description,
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        allDay,
                        groupIds: selectedGroups,
                        notes,
                        completed,
                    };
                    await addDoc(collection(firestore, 'eventi'), { ...eventData, createdAt: serverTimestamp() });

                    // Trigger notifica nuovo evento
                    const startFormatted = format(finalStartDate, 'd MMMM yyyy', { locale: itLocale });
                    triggerNotification({
                      eventType: 'evento_nuovo',
                      title: `📅 Nuovo impegno: ${title}`,
                      body: `È stato aggiunto un nuovo impegno: "${title}" il ${startFormatted}.`,
                      href: '/calendario',
                    });
                }

                // Fire-and-forget sync: push to creator + all subscribed users
                if (pushToGcal) {
                    broadcastEvent({
                        title,
                        description: description || notes,
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        allDay,
                        groupIds: selectedGroups,
                    }).catch(console.error);
                }
            }

            onOpenChange(false);
        } catch (error) {
            console.error("Errore durante il salvataggio:", error);
            setError(`Si è verificato un errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async () => {
        if (!firestore || !eventToEdit) return;
        
        setIsSaving(true);
        setError(null);
        
        try {
            const batch = writeBatch(firestore);

            // Delete the event
            const eventDocRef = doc(firestore, 'eventi', eventToEdit.id);
            batch.delete(eventDocRef);

            // If it's a project, delete the project as well
            if (eventToEdit.isProject && eventToEdit.projectId) {
                const projectDocRef = doc(firestore, 'progetti', eventToEdit.projectId);
                batch.delete(projectDocRef);
            }
            
            await batch.commit();

            // Sync delete with Google Calendar (fire-and-forget with auth token)
            auth.currentUser?.getIdToken().then(token =>
                fetch('/api/calendar/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        action: 'delete',
                        groupIds: eventToEdit.groupIds,
                        title: eventToEdit.title,
                        startDate: eventToEdit.startDate?.toDate ? eventToEdit.startDate.toDate().toISOString() : new Date(eventToEdit.startDate).toISOString(),
                        allDay: eventToEdit.allDay,
                    })
                })
            ).catch(console.error);

            // Trigger notifica eliminazione evento
            triggerNotification({
              eventType: 'evento_rimosso',
              title: `❌ Impegno annullato: ${eventToEdit.title}`,
              body: `L'impegno "${eventToEdit.title}" è stato eliminato dal calendario.`,
              href: '/calendario',
            });

            onOpenChange(false);

        } catch (err) {
            setError(`Errore durante l'eliminazione: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Modifica Impegno' : 'Nuovo Impegno'}</DialogTitle>
                    <DialogDescription>
                        Aggiungi un nuovo impegno al calendario per i gruppi selezionati.
                    </DialogDescription>
                </DialogHeader>
                 <div className="flex-1 overflow-y-auto p-1 -mr-2 pr-4">
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Titolo</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Descrizione</Label>
                            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Note / Esito</Label>
                            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note sull'andamento o esito dell'impegno..." />
                        </div>
                        {isEditing && (
                            <div className="flex items-center space-x-2">
                                <Checkbox id="completed" checked={completed} onCheckedChange={(checked) => setCompleted(!!checked)} />
                                <Label htmlFor="completed">Completato</Label>
                            </div>
                        )}
                         <div className="grid gap-3">
                            <Label>Gruppi di destinazione</Label>
                            <ScrollArea className="h-24 rounded-md border">
                                <div className="px-3 py-2 space-y-2">
                                    {groups && groups.length > 0 ? groups.map(group => (
                                        <div key={group.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`group-${group.id}`}
                                                checked={selectedGroups.includes(group.id)}
                                                onCheckedChange={(checked) => handleGroupToggle(group.id, !!checked)}
                                            />
                                            <label htmlFor={`group-${group.id}`} className="text-sm font-medium leading-none">
                                                {group.name}
                                            </label>
                                        </div>
                                    )) : <p className="text-sm text-muted-foreground">Nessun gruppo trovato.</p>}
                                </div>
                            </ScrollArea>
                        </div>
                        <div className="grid grid-cols-1 gap-4 items-start">
                            <div className="grid gap-2">
                                <Label htmlFor="start-date">Inizio</Label>
                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                    <DatePicker date={startDate} setDate={setStartDate}/>
                                    {!allDay && <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-[120px]"/>}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="end-date">Fine</Label>
                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                    <DatePicker date={endDate} setDate={setEndDate} disabled={startDate ? { before: startDate } : undefined} />
                                    {!allDay && (
                                      <Input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        min={startDate && endDate && isSameDay(startDate, endDate) ? startTime : undefined}
                                        className="w-[120px]"
                                      />
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="all-day" checked={allDay} onCheckedChange={setAllDay} />
                            <Label htmlFor="all-day">Tutto il giorno</Label>
                        </div>
                        
                        {!isEditing && isConnected && (
                            <div className="flex items-center space-x-2 mt-2">
                                <Checkbox id="push-gcal" checked={pushToGcal} onCheckedChange={(c) => setPushToGcal(!!c)} />
                                <Label htmlFor="push-gcal" className="font-normal text-sm">
                                    Sincronizza con <b>Google Calendar</b>
                                    <span className="text-muted-foreground ml-1">(tu + iscritti ai gruppi)</span>
                                </Label>
                            </div>
                        )}

                        <Separator />
                        
                        <div className="flex items-center space-x-2">
                           <Switch id="is-campo" checked={isCampo} onCheckedChange={(v) => { setIsCampo(v); if (v) setIsProject(false); }} disabled={isEditing}/>
                           <Label htmlFor="is-campo">⛺ Crea un campo da questo impegno</Label>
                       </div>
                       {isCampo && (
                           <div className="pl-6 space-y-2">
                               <Label className="text-sm">Tipo di campo</Label>
                               <div className="flex flex-col gap-2">
                                 {(['campo_elementari', 'campo_medie', 'campo_estivo'] as TipoCampo[]).map(tipo => (
                                   <label key={tipo} className={`flex items-center gap-2 p-2 border rounded-md cursor-pointer text-sm transition-colors ${tipoCampo === tipo ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}>
                                     <input type="radio" name="tipoCampo" value={tipo} checked={tipoCampo === tipo} onChange={() => setTipoCampo(tipo)} className="sr-only" />
                                     <span>{TIPO_CAMPO_LABELS[tipo]}</span>
                                   </label>
                                 ))}
                               </div>
                               <p className="text-xs text-muted-foreground">Verrà creata una sezione dedicata in /campi con gestione alloggi, pullman, spesa e preventivo.</p>
                           </div>
                       )}
                       {!isCampo && (
                         <div className="flex items-center space-x-2">
                           <Switch id="is-project" checked={isProject} onCheckedChange={setIsProject} disabled={isEditing}/>
                           <Label htmlFor="is-project">Crea un progetto da questo impegno</Label>
                         </div>
                       )}
                       {!isCampo && isProject && (
                           <div className="pl-6 text-sm text-muted-foreground">
                               Verrà creata una pagina dedicata al progetto in `/progetti/{slugify(title)}`. Potrai gestire la raccolta fondi e altri dettagli da lì.
                           </div>
                       )}
                    </div>
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}
                
                <DialogFooter className="border-t pt-4 sm:justify-between">
                     <div className='flex justify-start'>
                        {isEditing && (
                            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={isSaving}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Elimina
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                            Annulla
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {isSaving ? 'Salvataggio...' : (isEditing ? 'Salva Modifiche' : 'Crea Impegno')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        {isEditing && (
            <ConfirmationDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title="Sei sicuro di voler eliminare questo impegno?"
                description="Se l'impegno è legato a un progetto, anche il progetto verrà eliminato. L'operazione non è reversibile."
                onConfirm={handleDelete}
                confirmLabel="Elimina"
                confirmVariant="destructive"
            />
        )}
        </>
    );
}
