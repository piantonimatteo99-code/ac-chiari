'use client';

import { useState, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  CalendarDays,
  ClipboardList,
  FileText,
  Loader2,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import type { Evento } from '@/components/add-event-dialog';
import { format, isAfter, isBefore, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ConsiglioVerbali from './verbali';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskConsiglio {
  id: string;
  text: string;
  completed: boolean;
  eventId: string;
  createdAt: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (val?.toDate) return val.toDate();
  return new Date(val);
};

const formatEventDate = (startDate: any, endDate: any): string => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (start.toDateString() === end.toDateString()) {
    return format(start, 'dd.MM.yyyy', { locale: it });
  }
  return `${format(start, 'dd.MM.yyyy', { locale: it })} – ${format(end, 'dd.MM.yyyy', { locale: it })}`;
};

const eventSortKey = (e: Evento) => toDate(e.startDate).getTime();

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  canEdit,
  onToggle,
  onDelete,
}: {
  task: TaskConsiglio;
  canEdit: boolean;
  onToggle: (task: TaskConsiglio) => void;
  onDelete: (task: TaskConsiglio) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors group',
        task.completed && 'bg-muted/40'
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task)}
        disabled={!canEdit}
        className="shrink-0"
      />
      <span
        className={cn(
          'flex-1 text-sm',
          task.completed && 'line-through text-muted-foreground'
        )}
      >
        {task.text}
      </span>
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={() => onDelete(task)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Event Section (Ordine del Giorno) ───────────────────────────────────────

function EventSection({
  event,
  tasks,
  canEdit,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: {
  event: Evento;
  tasks: TaskConsiglio[];
  canEdit: boolean;
  onAddTask: (eventId: string, text: string) => Promise<void>;
  onToggleTask: (task: TaskConsiglio) => Promise<void>;
  onDeleteTask: (task: TaskConsiglio) => Promise<void>;
}) {
  const [newTaskText, setNewTaskText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const text = newTaskText.trim();
    if (!text) return;
    setIsAdding(true);
    try {
      await onAddTask(event.id, text);
      setNewTaskText('');
    } finally {
      setIsAdding(false);
    }
  };

  const eventDate = formatEventDate(event.startDate, event.endDate);
  const completedCount = tasks.filter((t) => t.completed).length;
  const isPast = isBefore(toDate(event.endDate), startOfDay(new Date()));

  return (
    <Card className={cn(isPast && 'opacity-70')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <CardTitle className="text-base">{event.title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{eventDate}</CardDescription>
            </div>
          </div>
          {tasks.length > 0 && (
            <Badge variant={completedCount === tasks.length ? 'default' : 'secondary'} className="shrink-0">
              {completedCount === tasks.length ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <Circle className="h-3 w-3 mr-1" />
              )}
              {completedCount}/{tasks.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground italic py-1">
            Nessun punto all&apos;ordine del giorno. Aggiungine uno qui sotto.
          </p>
        )}

        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            canEdit={canEdit}
            onToggle={onToggleTask}
            onDelete={onDeleteTask}
          />
        ))}

        {canEdit && (
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="Aggiungi punto all'ordine del giorno..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              className="h-9 text-sm"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isAdding || !newTaskText.trim()}
              className="h-9 shrink-0"
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Ordine del Giorno Tab ────────────────────────────────────────────────────

function OrdineDelGiorno({ canEdit, consiglioGroupId }: { canEdit: boolean; consiglioGroupId: string | null }) {
  const firestore = useFirestore();

  // All events
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'eventi'), orderBy('startDate', 'asc'));
  }, [firestore]);
  const { data: allEvents, isLoading: isLoadingEvents } = useCollection<Evento>(eventsQuery);

  // Tasks for consiglio
  const tasksQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'consiglio-tasks');
  }, [firestore]);
  const { data: allTasks, isLoading: isLoadingTasks } = useCollection<TaskConsiglio>(tasksQuery);

  // Filter events that belong to the "consiglio" group
  const consiglioEvents = useMemo(() => {
    if (!allEvents || !consiglioGroupId) return [];
    return allEvents
      .filter((e) => e.groupIds?.includes(consiglioGroupId))
      .sort((a, b) => eventSortKey(b) - eventSortKey(a)); // most recent first
  }, [allEvents, consiglioGroupId]);

  const tasksByEvent = useMemo(() => {
    if (!allTasks) return new Map<string, TaskConsiglio[]>();
    const map = new Map<string, TaskConsiglio[]>();
    for (const task of allTasks) {
      const list = map.get(task.eventId) ?? [];
      list.push(task);
      map.set(task.eventId, list);
    }
    return map;
  }, [allTasks]);

  const handleAddTask = useCallback(
    async (eventId: string, text: string) => {
      if (!firestore) return;
      await addDoc(collection(firestore, 'consiglio-tasks'), {
        text,
        completed: false,
        eventId,
        createdAt: serverTimestamp(),
      });
    },
    [firestore]
  );

  const handleToggleTask = useCallback(
    async (task: TaskConsiglio) => {
      if (!firestore) return;
      await updateDoc(doc(firestore, 'consiglio-tasks', task.id), {
        completed: !task.completed,
      });
    },
    [firestore]
  );

  const handleDeleteTask = useCallback(
    async (task: TaskConsiglio) => {
      if (!firestore) return;
      await deleteDoc(doc(firestore, 'consiglio-tasks', task.id));
    },
    [firestore]
  );

  if (isLoadingEvents || isLoadingTasks) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Caricamento...
      </div>
    );
  }

  if (!consiglioGroupId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            Nessun gruppo di nome <strong>&quot;Consiglio&quot;</strong> trovato nel sistema.
            <br />
            Crea il gruppo in <em>Admin → Gestione Gruppi</em> per abilitare questa sezione.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (consiglioEvents.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            Nessun impegno in calendario per il gruppo <strong>Consiglio</strong>.
            <br />
            Aggiungi un impegno dal <a href="/calendario" className="underline text-primary">Calendario</a> assegnandolo al gruppo Consiglio.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {consiglioEvents.map((event) => (
        <EventSection
          key={event.id}
          event={event}
          tasks={tasksByEvent.get(event.id) ?? []}
          canEdit={canEdit}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
        />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConsiglioPage() {
  const firestore = useFirestore();
  const { userData } = useUserData();

  const canEdit = useMemo(
    () => userData?.roles?.includes('admin') || userData?.roles?.includes('educatore'),
    [userData]
  );

  // Find the "Consiglio" group
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'gruppi');
  }, [firestore]);
  const { data: groups } = useCollection<Group>(groupsQuery);

  const consiglioGroup = useMemo(() => {
    if (!groups) return null;
    return groups.find((g) => g.name?.toLowerCase() === 'consiglio') ?? null;
  }, [groups]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Consiglio</h1>
        <p className="text-sm text-muted-foreground">
          Gestione dell&apos;ordine del giorno e dei verbali del Consiglio AC Chiari.
        </p>
      </div>

      <Tabs defaultValue="ordine-del-giorno" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="ordine-del-giorno" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Ordine del Giorno
          </TabsTrigger>
          <TabsTrigger value="verbali" className="gap-2">
            <FileText className="h-4 w-4" />
            Verbali
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ordine-del-giorno">
          <OrdineDelGiorno canEdit={!!canEdit} consiglioGroupId={consiglioGroup?.id ?? null} />
        </TabsContent>

        <TabsContent value="verbali">
          <ConsiglioVerbali canEdit={!!canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
