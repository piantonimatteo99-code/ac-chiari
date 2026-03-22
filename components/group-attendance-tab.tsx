'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collectionGroup } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Minus, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isAfter, isBefore } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import type { Evento } from '@/components/add-event-dialog';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';

interface Partecipante {
  id: string;
  membroId: string;
  presente: boolean;
  ref?: any;
  _ref?: any;
}

interface GroupAttendanceTabProps {
  groupId: string;
  memberIds: string[];
  events: Evento[];
}

function getSchoolYear(date: Date): number {
  return date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
}

function getSchoolYears(events: Evento[]): number[] {
  const years = new Set<number>();
  events.forEach(e => {
    const d = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
    years.add(getSchoolYear(d));
  });
  if (years.size === 0) years.add(getSchoolYear(new Date()));
  return Array.from(years).sort((a, b) => b - a);
}

export function GroupAttendanceTab({ groupId, memberIds, events }: GroupAttendanceTabProps) {
  const firestore = useFirestore();

  const schoolYears = useMemo(() => getSchoolYears(events), [events]);
  const [selectedYear, setSelectedYear] = useState<number>(
    () => schoolYears[0] ?? getSchoolYear(new Date())
  );
  const yearIdx = schoolYears.indexOf(selectedYear);

  // Filtered + sorted events for the selected school year (Sep Y → Aug Y+1)
  const yearEvents = useMemo(() => {
    const yearStart = new Date(selectedYear, 8, 1);
    const yearEnd = new Date(selectedYear + 1, 7, 31, 23, 59, 59);
    return events
      .filter(e => {
        const d = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
        return !isBefore(d, yearStart) && !isAfter(d, yearEnd);
      })
      .sort((a, b) => {
        const da = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
        const db = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
        return da.getTime() - db.getTime();
      });
  }, [events, selectedYear]);

  // Members
  const membriQuery = useMemoFirebase(() => {
    if (!firestore || memberIds.length === 0) return null;
    return collectionGroup(firestore, 'membri');
  }, [firestore, memberIds]);
  const { data: allMembri } = useCollection<Membro>(membriQuery);

  const membri = useMemo(() => {
    if (!allMembri) return [];
    const idSet = new Set(memberIds);
    return allMembri
      .filter(m => idSet.has(m.id))
      .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'));
  }, [allMembri, memberIds]);

  // All attendance records via collectionGroup('partecipanti')
  // path: presenze/{eventId}/partecipanti/{membroId}
  const partecipantiQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collectionGroup(firestore, 'partecipanti');
  }, [firestore]);
  const { data: allPartecipanti } = useCollection<Partecipante>(partecipantiQuery, { includeRef: true });

  // Build attendance grid: membroId → eventId → boolean|null
  const attendanceGrid = useMemo(() => {
    const grid = new Map<string, Map<string, boolean | null>>();
    membri.forEach(m => {
      const em = new Map<string, boolean | null>();
      yearEvents.forEach(e => em.set(e.id, null));
      grid.set(m.id, em);
    });

    if (allPartecipanti) {
      allPartecipanti.forEach((p: any) => {
        const ref = p.ref ?? p._ref;
        if (!ref) return;
        // Firestore path: presenze/{eventId}/partecipanti/{docId}
        const segments: string[] = ref.path?.split('/') ?? [];
        const eventId = segments[1]; // index 1 = eventId
        const membroId = p.membroId;
        if (eventId && membroId && grid.has(membroId) && grid.get(membroId)!.has(eventId)) {
          grid.get(membroId)!.set(eventId, p.presente);
        }
      });
    }
    return grid;
  }, [allPartecipanti, membri, yearEvents]);

  // Summary stats
  const stats = useMemo(() => {
    let present = 0, absent = 0, unrecorded = 0;
    attendanceGrid.forEach(em => {
      em.forEach(v => {
        if (v === true) present++;
        else if (v === false) absent++;
        else unrecorded++;
      });
    });
    return { present, absent, unrecorded };
  }, [attendanceGrid]);

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Anno Scolastico {selectedYear}/{selectedYear + 1}</h3>
        </div>
        <div className="flex items-center gap-1 border rounded-md">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            disabled={yearIdx >= schoolYears.length - 1}
            onClick={() => { if (yearIdx < schoolYears.length - 1) setSelectedYear(schoolYears[yearIdx + 1]); }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2 min-w-[90px] text-center">{selectedYear}/{selectedYear + 1}</span>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            disabled={yearIdx === 0}
            onClick={() => { if (yearIdx > 0) setSelectedYear(schoolYears[yearIdx - 1]); }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Presenze', value: stats.present, color: 'text-green-600' },
          { label: 'Assenze', value: stats.absent, color: 'text-red-500' },
          { label: 'Non registrate', value: stats.unrecorded, color: 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label} className="p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {yearEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun incontro in questo anno scolastico.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <table className="border-collapse w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-semibold sticky left-0 bg-muted/30 z-10 border-r min-w-[160px]">
                      Componente
                    </th>
                    {yearEvents.map(e => {
                      const d = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
                      return (
                        <th key={e.id} className="p-2 text-center font-medium min-w-[72px]">
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {format(d, 'd MMM', { locale: itLocale })}
                          </div>
                          <div className="text-[9px] text-muted-foreground/70 truncate max-w-[60px]" title={e.title}>
                            {e.title.length > 9 ? e.title.slice(0, 9) + '…' : e.title}
                          </div>
                        </th>
                      );
                    })}
                    <th className="p-3 text-center font-semibold border-l min-w-[72px]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {membri.map(m => {
                    const em = attendanceGrid.get(m.id);
                    const presentiCount = em ? Array.from(em.values()).filter(v => v === true).length : 0;
                    const pct = yearEvents.length > 0 ? Math.round((presentiCount / yearEvents.length) * 100) : 0;
                    return (
                      <tr key={m.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium sticky left-0 bg-background z-10 border-r whitespace-nowrap">
                          {m.cognome} {m.nome}
                        </td>
                        {yearEvents.map(e => {
                          const val = em?.get(e.id) ?? null;
                          return (
                            <td key={e.id} className="p-2 text-center">
                              {val === true ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              ) : val === false ? (
                                <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                              ) : (
                                <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                              )}
                            </td>
                          );
                        })}
                        <td className="p-3 text-center border-l">
                          <Badge variant={pct >= 75 ? 'default' : pct >= 50 ? 'secondary' : 'outline'}
                            className={pct >= 75 ? 'bg-green-600 text-xs' : 'text-xs'}>
                            {pct}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Presente</span>
        <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-400" /> Assente</span>
        <span className="flex items-center gap-1.5"><Minus className="h-3.5 w-3.5 text-muted-foreground/40" /> Non registrato</span>
      </div>
    </div>
  );
}
