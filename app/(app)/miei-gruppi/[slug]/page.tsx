'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import type { Group } from '../../admin/gestione-gruppi/tutti-i-gruppi/page';
import type { Evento } from '@/components/add-event-dialog';
import { slugify } from '@/lib/utils';
import { useUserData } from '@/src/hooks/use-user-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WeeklyCalendarView } from '@/components/weekly-calendar-view';
import { GroupMembersCard } from '@/components/group-members-card';
import { GroupEventDetailDialog } from '@/components/group-event-detail-dialog';
import { GroupAttendanceTab } from '@/components/group-attendance-tab';
import { GroupPaymentsTab } from '@/components/group-payments-tab';
import { AddEventDialog } from '@/components/add-event-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  CalendarDays,
  FolderOpen,
  PlusCircle,
  ChevronRight,
  Tag,
  ClipboardList,
  Coins,
} from 'lucide-react';
import Link from 'next/link';
import { format, isFuture } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';

export default function GruppoDettaglioPage() {
  const firestore = useFirestore();
  const params = useParams();
  const { user } = useUser();
  const { userData } = useUserData();
  const slug = params?.slug as string;

  const isAdmin = useMemo(() => userData?.roles?.includes('admin') ?? false, [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore') ?? false, [userData]);
  const canEdit = isAdmin || isEducatore;

  // ---- Fetch user's groups ----
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    if (isAdmin) return collection(firestore, 'gruppi');
    return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
  }, [firestore, user, isAdmin]);
  const { data: userGroups, isLoading: isLoadingGroup } = useCollection<Group>(groupsQuery);

  // ---- Resolve group from slug ----
  const group = useMemo(() => {
    if (!userGroups) return null;
    return userGroups.find((g) => slugify(g.name) === slug) ?? null;
  }, [userGroups, slug]);

  // ---- Fetch events for this group ----
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !group?.id) return null;
    return query(
      collection(firestore, 'eventi'),
      where('groupIds', 'array-contains', group.id)
    );
  }, [firestore, group?.id]);
  const { data: events, isLoading: isLoadingEvents } = useCollection<Evento>(eventsQuery);

  // ---- Dialog state ----
  const [selectedEvent, setSelectedEvent] = useState<Evento | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  const handleEventClick = (event: Evento) => {
    setSelectedEvent(event);
    setIsDetailOpen(true);
  };

  // ---- Stats ----
  const nextEvent = useMemo(() => {
    if (!events) return null;
    const upcoming = events.filter((e) => {
      const d = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
      return isFuture(d);
    });
    if (upcoming.length === 0) return null;
    return upcoming.reduce((nearest, e) => {
      const nd = nearest.startDate?.toDate ? nearest.startDate.toDate() : new Date(nearest.startDate);
      const ed = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
      return ed < nd ? e : nearest;
    });
  }, [events]);

  const nextEventLabel = useMemo(() => {
    if (!nextEvent) return null;
    const d = nextEvent.startDate?.toDate ? nextEvent.startDate.toDate() : new Date(nextEvent.startDate);
    return format(d, 'd MMM yyyy', { locale: itLocale });
  }, [nextEvent]);

  // ---- Loading ----
  if (isLoadingGroup) {
    return (
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Tag className="h-12 w-12 text-muted-foreground opacity-40" />
        <div>
          <h2 className="text-xl font-semibold">Gruppo non trovato</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Non hai i permessi per visualizzare questo gruppo o non esiste.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/miei-gruppi">
            <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
            Torna ai gruppi
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Page Header ---- */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/miei-gruppi" className="hover:text-foreground transition-colors">
              I Miei Gruppi
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{group.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAddEventOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuovo Impegno
          </Button>
        )}
      </div>

      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {isLoadingEvents ? '—' : (events?.length ?? '—')}
              </p>
              <p className="text-xs text-muted-foreground">Educatori assegnati</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {group.educatorIds && group.educatorIds.length > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    {group.educatorIds.length} educatori
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Nessuno</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-2.5 rounded-lg bg-blue-500/10">
              <CalendarDays className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {isLoadingEvents ? '—' : (events?.length ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Impegni in calendario</p>
              {nextEventLabel && (
                <p className="text-xs text-blue-500 mt-1 font-medium">
                  Prossimo: {nextEventLabel}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-2.5 rounded-lg bg-amber-500/10">
              <FolderOpen className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {isLoadingEvents ? '—' : (events?.filter((e) => e.isProject).length ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Progetti attivi</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Main Tabs ---- */}
      <Tabs defaultValue="calendario" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="calendario" className="flex items-center gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" /> Calendario
          </TabsTrigger>
          <TabsTrigger value="componenti" className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Componenti
          </TabsTrigger>
          <TabsTrigger value="presenze" className="flex items-center gap-1.5 text-xs">
            <ClipboardList className="h-3.5 w-3.5" /> Presenze
          </TabsTrigger>
          <TabsTrigger value="pagamenti" className="flex items-center gap-1.5 text-xs">
            <Coins className="h-3.5 w-3.5" /> Pagamenti
          </TabsTrigger>
          <TabsTrigger value="documenti" className="flex items-center gap-1.5 text-xs">
            <FolderOpen className="h-3.5 w-3.5" /> Documenti
          </TabsTrigger>
        </TabsList>

        {/* ---- Calendario Tab ---- */}
        <TabsContent value="calendario" className="mt-0">
          {isLoadingEvents ? (
            <Skeleton className="h-[500px] rounded-xl" />
          ) : (
            <div className="h-[600px]">
              <WeeklyCalendarView
                events={events ?? []}
                onEventClick={handleEventClick}
              />
            </div>
          )}
        </TabsContent>

        {/* ---- Componenti Tab ---- */}
        <TabsContent value="componenti" className="mt-0">
          <GroupMembersCard groupId={group.id} groupName={group.name} memberIds={group.memberIds || []} />
        </TabsContent>

        {/* ---- Presenze Tab ---- */}
        <TabsContent value="presenze" className="mt-0">
          <GroupAttendanceTab
            groupId={group.id}
            memberIds={group.memberIds || []}
            events={events ?? []}
          />
        </TabsContent>

        {/* ---- Pagamenti Tab ---- */}
        <TabsContent value="pagamenti" className="mt-0">
          <GroupPaymentsTab
            groupId={group.id}
            memberIds={group.memberIds || []}
          />
        </TabsContent>

        {/* ---- Documenti Tab ---- */}
        <TabsContent value="documenti" className="mt-0">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center gap-3">
            <FolderOpen className="h-12 w-12 opacity-30" />
            <div>
              <p className="font-medium">Documenti del Gruppo</p>
              <p className="text-sm mt-1">
                I documenti allegati agli impegni sono accessibili aprendo il singolo evento dal calendario.
              </p>
            </div>
            <Button variant="outline" onClick={() => setIsAddEventOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Crea un progetto con Drive
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ---- Dialogs ---- */}
      <GroupEventDetailDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        event={selectedEvent}
        groupId={group.id}
        groupName={group.name}
        memberIds={group.memberIds || []}
        canEdit={canEdit}
      />
      <AddEventDialog
        isOpen={isAddEventOpen}
        onOpenChange={setIsAddEventOpen}
      />
    </div>
  );
}
