'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/src/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Group } from '../admin/gestione-gruppi/tutti-i-gruppi/page';
import type { Evento } from '@/components/add-event-dialog';
import { slugify } from '@/lib/utils';
import { useUserData } from '@/src/hooks/use-user-data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Users } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';

function GroupCard({ group, events }: { group: Group; events: Evento[] }) {
  const nextEvent = useMemo(() => {
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

  return (
    <Link href={`/miei-gruppi/${slugify(group.name)}`}>
      <Card className="hover:border-primary hover:shadow-md transition-all h-full flex flex-col justify-between group">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {group.name}
            </CardTitle>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
          <CardDescription>
            Gestisci il gruppo, i componenti e le attività.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>
                {group.educatorIds?.length ?? 0}{' '}
                {(group.educatorIds?.length ?? 0) === 1 ? 'educatore' : 'educatori'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                {events.length} {events.length === 1 ? 'impegno' : 'impegni'}
              </span>
            </div>
          </div>
          {nextEvent && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Prossimo: {nextEventLabel} — {nextEvent.title}
              </Badge>
            </div>
          )}
          {!nextEvent && events.length > 0 && (
            <p className="text-xs text-muted-foreground">Nessun impegno futuro</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function MieiGruppiPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserLoading } = useUserData();

  const isAdmin = useMemo(() => userData?.roles?.includes('admin') ?? false, [userData]);

  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData) return null;
    if (isAdmin) return collection(firestore, 'gruppi');
    if (userData.roles?.includes('educatore')) {
      return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
    }
    return null;
  }, [firestore, user, userData, isAdmin]);

  const { data: myGroups, isLoading: isLoadingGroups } = useCollection<Group>(myGroupsQuery);

  // Fetch all events to compute quick stats
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !myGroups || myGroups.length === 0) return null;
    return collection(firestore, 'eventi');
  }, [firestore, myGroups]);
  const { data: allEvents } = useCollection<Evento>(eventsQuery);

  const eventsByGroup = useMemo(() => {
    const map: Record<string, Evento[]> = {};
    if (!allEvents || !myGroups) return map;
    myGroups.forEach((g) => { map[g.id] = []; });
    allEvents.forEach((e) => {
      e.groupIds?.forEach((gid) => {
        if (map[gid]) map[gid].push(e);
      });
    });
    return map;
  }, [allEvents, myGroups]);

  const isLoading = isUserLoading || isLoadingGroups;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">I Miei Gruppi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Seleziona un gruppo per vedere il calendario, i ragazzi e gestire le presenze.
          </p>
        </div>
        {myGroups && myGroups.length > 0 && (
          <Badge variant="secondary" className="text-sm">
            {myGroups.length} {myGroups.length === 1 ? 'gruppo' : 'gruppi'}
          </Badge>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!myGroups || myGroups.length === 0) && (
        <Card className="flex flex-col items-center justify-center p-10 text-center">
          <CardHeader>
            <CardTitle>Nessun gruppo assegnato</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Nessun gruppo è stato ancora creato. Inizia dalla sezione 'Gestione Gruppi'."
                : 'Al momento non sei assegnato a nessun gruppo. Contatta un amministratore.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && myGroups && myGroups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {myGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              events={eventsByGroup[group.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
