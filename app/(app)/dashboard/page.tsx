'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/src/firebase';
import { collection, query, where, collectionGroup } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { useNotifications } from '@/src/hooks/use-notifications';
import Link from 'next/link';
import {
  format,
  isFuture,
  isToday,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  areIntervalsOverlapping,
  startOfDay,
  endOfDay,
  formatDistanceToNow,
} from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  CreditCard,
  Bell,
  BellRing,
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import type { Evento } from '@/components/add-event-dialog';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';


const getCurrentMembershipYear = () => {
  const today = new Date();
  const month = today.getMonth();
  return month >= 8 ? today.getFullYear() : today.getFullYear() - 1;
};

// --- MEMBER COLOR PALETTE (8 distinct colors) ---
const MEMBER_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6',
];

function getMemberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

// ============================================================
// MINI CALENDAR
// ============================================================
interface MiniCalendarProps {
  events: Evento[];
  membri: Membro[];
  filtredMembroId: string | null;
  groups: Group[];
  isEducatore: boolean;
  onEventClick: (e: Evento) => void;
}

function MiniCalendar({ events, membri, filtredMembroId, groups, isEducatore, onEventClick }: MiniCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1, locale: itLocale });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1, locale: itLocale });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, { event: Evento; color: string }[]>();
    monthDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      const dayEvts = events.filter(e => {
        const s = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
        const en = e.endDate?.toDate ? e.endDate.toDate() : new Date(e.endDate);
        return areIntervalsOverlapping({ start: startOfDay(day), end: endOfDay(day) }, { start: s, end: en });
      });

      const dots: { event: Evento; color: string }[] = [];
      if (isEducatore) {
        // Color by group
        dayEvts.forEach(e => {
          const gIdx = groups.findIndex(g => e.groupIds?.includes(g.id));
          dots.push({ event: e, color: getMemberColor(gIdx >= 0 ? gIdx : 0) });
        });
      } else {
        // Color by member
        dayEvts.forEach(e => {
          const mIdx = membri.findIndex(m => e.groupIds?.some(gid => m.groupId === gid));
          dots.push({ event: e, color: getMemberColor(mIdx >= 0 ? mIdx : 0) });
        });
      }

      map.set(key, dots);
    });
    return map;
  }, [monthDays, events, membri, groups, isEducatore]);

  const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">
          {format(currentDate, 'MMMM yyyy', { locale: itLocale }).replace(/^\w/, c => c.toUpperCase())}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {monthDays.map((day, i) => {
          const key = format(day, 'yyyy-MM-dd');
          const dots = eventsByDay.get(key) ?? [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const t = isToday(day);
          const dotsToShow = dots.slice(0, 3); // max 3 dots

          const cell = (
            <div
              className={cn(
                'flex flex-col items-center py-0.5 rounded-md',
                !isCurrentMonth && 'opacity-30',
                t && 'bg-primary/10',
                dots.length > 0 && 'cursor-pointer hover:bg-muted/50 transition-colors',
              )}
            >
              <span className={cn(
                'text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium',
                t && 'bg-primary text-primary-foreground font-bold',
              )}>
                {format(day, 'd')}
              </span>
              <div className="flex gap-0.5 h-2 items-center">
                {dotsToShow.map((dot, di) => (
                  <span
                    key={di}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: dot.color }}
                  />
                ))}
              </div>
            </div>
          );

          if (dots.length === 0) return <div key={i}>{cell}</div>;

          return (
            <Popover key={i}>
              <PopoverTrigger asChild><div>{cell}</div></PopoverTrigger>
              <PopoverContent className="w-56 p-0" side="top">
                <div className="p-2 text-xs font-semibold border-b text-center">
                  {format(day, 'EEEE d MMMM', { locale: itLocale })}
                </div>
                <ScrollArea className="max-h-40">
                  <div className="p-2 space-y-1">
                    {dots.map(({ event, color }, di) => (
                      <button key={di} onClick={() => onEventClick(event)}
                        className="w-full text-left flex items-center gap-2 p-1.5 rounded hover:bg-muted text-xs">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {event.title}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// UPCOMING EVENTS CARD
// ============================================================
function UpcomingEventsCard({ events, groups, isEducatore }: { events: Evento[]; groups: Group[]; isEducatore: boolean }) {
  const upcoming = useMemo(() => {
    return events
      .filter(e => {
        const d = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
        return isFuture(d) || isToday(d);
      })
      .sort((a, b) => {
        const da = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
        const db = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
        return da.getTime() - db.getTime();
      })
      .slice(0, 6);
  }, [events]);

  if (upcoming.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Prossimi Impegni
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground text-sm py-8">
          Nessun impegno in programma.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" /> Prossimi Impegni
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {upcoming.map((e, i) => {
            const d = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
            const groupNames = groups.filter(g => e.groupIds?.includes(g.id)).map(g => g.name).join(', ');
            const gIdx = groups.findIndex(g => e.groupIds?.includes(g.id));
            const color = getMemberColor(gIdx >= 0 ? gIdx : i);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="shrink-0 rounded-lg overflow-hidden w-10 text-center"
                  style={{ backgroundColor: color + '20', borderLeft: `3px solid ${color}` }}>
                  <p className="text-[10px] font-bold uppercase p-1" style={{ color }}>{format(d, 'MMM', { locale: itLocale })}</p>
                  <p className="text-base font-black leading-none pb-1" style={{ color }}>{format(d, 'd')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {e.allDay ? 'Tutto il giorno' : format(d, 'HH:mm')}
                    {groupNames && ` · ${groupNames}`}
                  </p>
                </div>
                {e.completed && (
                  <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] shrink-0">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Fatto
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// MEMBERSHIP CARD
// ============================================================
function MembershipCard({ membri }: { membri: Membro[] }) {
  const year = getCurrentMembershipYear();
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" /> Tesseramento {year}/{year + 1}
        </CardTitle>
        <Link href="/iscrizioni" passHref>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            Gestisci
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {membri.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun componente familiare trovato.</p>
        ) : (
          <div className="space-y-3">
            {membri.map((m, i) => {
              const isTesserato = m.tesseramento === year;
              return (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: getMemberColor(i) }}>
                      {m.nome?.[0]}{m.cognome?.[0]}
                    </div>
                    <span className="text-sm font-medium">{m.nome} {m.cognome}</span>
                  </div>
                  <Badge variant={isTesserato ? 'default' : 'destructive'}
                    className={cn('text-xs', isTesserato && 'bg-green-600 hover:bg-green-700')}>
                    {isTesserato ? `Tesserato ${year}` : 'Da rinnovare'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// PAYMENTS DUE CARD
// ============================================================
interface Raccolta {
  id: string;
  nome: string;
  importo?: number;
  scadenza?: any;
  stato?: string;
  groupIds?: string[];
  payments?: { membroId: string; amount: number }[];
  memberIds?: string[];
}

function PaymentsDueCard({ raccolte, membriIds }: { raccolte: Raccolta[]; membriIds: string[] }) {
  const due = useMemo(() => {
    return raccolte
      .filter(r => r.stato !== 'conclusa')
      .filter(r => {
        const paidIds = new Set((Array.isArray(r.payments) ? r.payments : []).map(p => p.membroId));
        return membriIds.some(id => !paidIds.has(id));
      })
      .slice(0, 5);
  }, [raccolte, membriIds]);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-amber-500" /> Pagamenti in Scadenza
        </CardTitle>
        <Link href="/iscrizioni" passHref>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            Paga Ora
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {due.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600 py-4 justify-center">
            <CheckCircle2 className="h-4 w-4" /> Tutto in regola!
          </div>
        ) : (
          <div className="space-y-3">
            {due.map(r => {
              const d = r.scadenza?.toDate ? r.scadenza.toDate() : r.scadenza ? new Date(r.scadenza) : null;
              const paidIds = new Set((Array.isArray(r.payments) ? r.payments : []).map(p => p.membroId));
              const unpaidCount = membriIds.filter(id => !paidIds.has(id)).length;
              return (
                <div key={r.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.nome}</p>
                      {d && (
                        <p className="text-xs text-muted-foreground">
                          Scadenza: {format(d, 'd MMM yyyy', { locale: itLocale })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {r.importo != null && (
                      <p className="text-sm font-bold">
                        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(r.importo)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{unpaidCount} da pagare</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// RECENT ATTENDANCE CARD (genitore)
// ============================================================
interface PartecipanteDoc {
  id: string;
  membroId: string;
  presente: boolean;
  nome?: string;
  cognome?: string;
  registratoAt?: any;
  ref?: any;
}

function RecentAttendanceCard({ userId, membri }: { userId: string; membri: Membro[] }) {
  const firestore = useFirestore();
  const memberIdSet = useMemo(() => new Set(membri.map(m => m.id)), [membri]);

  const partecipantiQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collectionGroup(firestore, 'partecipanti');
  }, [firestore]);
  const { data: allPartecipanti } = useCollection<PartecipanteDoc>(partecipantiQuery, { includeRef: true });

  const recent = useMemo(() => {
    if (!allPartecipanti) return [];
    return allPartecipanti
      .filter((p: any) => memberIdSet.has(p.membroId))
      .sort((a: any, b: any) => {
        const ta = a.registratoAt?.toDate ? a.registratoAt.toDate().getTime() : 0;
        const tb = b.registratoAt?.toDate ? b.registratoAt.toDate().getTime() : 0;
        return tb - ta;
      })
      .slice(0, 6);
  }, [allPartecipanti, memberIdSet]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-indigo-500" /> Presenze Recenti
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessuna presenza registrata.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((p: any, i) => {
              const membro = membri.find(m => m.id === p.membroId);
              const ts = p.registratoAt?.toDate ? p.registratoAt.toDate() : null;
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ backgroundColor: getMemberColor(membri.findIndex(m => m.id === p.membroId)) }}>
                      {membro?.nome?.[0]}{membro?.cognome?.[0]}
                    </div>
                    <span className="font-medium">{membro ? `${membro.nome} ${membro.cognome}` : p.nome ?? 'Membro'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ts && <span className="text-xs text-muted-foreground">{format(ts, 'd MMM', { locale: itLocale })}</span>}
                    {p.presente ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// NOTICES CARD (live from Firestore)
// ============================================================
const NOTIFICA_ICONS: Record<string, string> = {
  pagamento: '💳', evento: '📅', iscrizione: '📝',
  magazzino: '📦', generale: '📢', feedback: '💬',
};
const NOTIFICA_BG: Record<string, string> = {
  pagamento: 'bg-amber-500/10 text-amber-600',
  evento: 'bg-blue-500/10 text-blue-600',
  iscrizione: 'bg-purple-500/10 text-purple-600',
  magazzino: 'bg-red-500/10 text-red-600',
  generale: 'bg-green-500/10 text-green-600',
  feedback: 'bg-gray-500/10 text-gray-600',
};

function NoticesCard() {
  const { notifiche, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const recent = notifiche.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          {unreadCount > 0
            ? <BellRing className="h-4 w-4 text-primary animate-pulse" />
            : <Bell className="h-4 w-4 text-primary" />}
          Avvisi & Comunicazioni
          {unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </CardTitle>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Segna tutte lette
          </button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center px-4">
            <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">Nessun avviso al momento</p>
          </div>
        ) : (
          <div className="divide-y">
            {recent.map(n => {
              const ts = n.createdAt?.toDate ? n.createdAt.toDate() : n.createdAt ? new Date(n.createdAt) : null;
              const inner = (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors group',
                    !n.letta && 'bg-primary/5'
                  )}
                  onClick={() => markAsRead(n.id)}
                >
                  <div className={cn('rounded-full p-1.5 text-xs shrink-0 mt-0.5', NOTIFICA_BG[n.type] ?? 'bg-muted text-muted-foreground')}>
                    {NOTIFICA_ICONS[n.type] ?? '🔔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm leading-tight', !n.letta ? 'font-semibold' : 'font-medium')}>
                        {n.title}
                      </p>
                      {!n.letta && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    {ts && (
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        {formatDistanceToNow(ts, { addSuffix: true, locale: itLocale })}
                      </p>
                    )}
                  </div>
                  {n.href && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </div>
              );
              return n.href
                ? <Link key={n.id} href={n.href} className="block">{inner}</Link>
                : <div key={n.id}>{inner}</div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// PAGE
// ============================================================
export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserLoading, resolvedFamilyId } = useUserData();

  const isAdmin = useMemo(() => userData?.roles?.includes('admin') ?? false, [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore') ?? false, [userData]);

  // My groups (for educatori/admin)
  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData) return null;
    if (isAdmin || isEducatore) {
      if (isAdmin) return collection(firestore, 'gruppi');
      return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
    }
    return null;
  }, [firestore, user, userData, isAdmin, isEducatore]);
  const { data: myGroups } = useCollection<Group>(myGroupsQuery);

  // All events
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'eventi');
  }, [firestore]);
  const { data: allEvents } = useCollection<Evento>(eventsQuery);

  // Family members — always fetch regardless of role (an educator can also have children)
  // Use resolvedFamilyId so linked family members see the correct nucleus
  const membriQuery = useMemoFirebase(() => {
    if (!firestore || !resolvedFamilyId) return null;
    return collection(firestore, 'famiglie', resolvedFamilyId, 'membri');
  }, [firestore, resolvedFamilyId]);
  const { data: familyMembri } = useCollection<Membro>(membriQuery);

  // Relevant events: for educators = their groups; for genitore = all; for hybrid = union
  const relevantEvents = useMemo(() => {
    if (!allEvents) return [];
    if ((isEducatore || isAdmin) && myGroups && myGroups.length > 0) {
      const gids = new Set(myGroups.map(g => g.id));
      // Start with educator's group events
      const educatorEvents = allEvents.filter(e => e.groupIds?.some(gid => gids.has(gid)));
      // Add events for family members' groups (hybrid users)
      const familyGroupIds = new Set((familyMembri ?? []).map(m => m.groupId).filter(Boolean) as string[]);
      if (familyGroupIds.size > 0) {
        const familyEvents = allEvents.filter(e =>
          !educatorEvents.includes(e) && e.groupIds?.some(gid => familyGroupIds.has(gid))
        );
        return [...educatorEvents, ...familyEvents];
      }
      return educatorEvents;
    }
    return allEvents;
  }, [allEvents, myGroups, isEducatore, isAdmin, familyMembri]);

  // Raccolte (payments)
  const raccoltaQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (isEducatore || isAdmin) return collection(firestore, 'raccolte');
    if (myGroups && myGroups.length > 0) {
      const gid = myGroups[0].id;
      return query(collection(firestore, 'raccolte'), where('groupIds', 'array-contains', gid));
    }
    return null;
  }, [firestore, myGroups, isAdmin, isEducatore]);
  const { data: raccolte } = useCollection<Raccolta>(raccoltaQuery);

  const membri: Membro[] = familyMembri ?? [];
  const membriIds = membri.map(m => m.id);

  const hourStr = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buongiorno';
    if (h < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  }, []);

  if (isUserLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {hourStr}, {userData?.displayName?.split(' ')[0] ?? 'benvenuto'} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: itLocale }).replace(/^\w/, c => c.toUpperCase())}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <Badge variant="secondary">Admin</Badge>}
          {isEducatore && !isAdmin && <Badge variant="secondary">Educatore</Badge>}
        </div>
      </div>

      {/* ── Banner: completa il profilo (solo utenti nuovi senza dati) ── */}
      {!isAdmin && !isEducatore && membri.length === 0 && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-800 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Completa il tuo profilo</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Per usare tutte le funzionalità (iscrizioni, pagamenti, presenze) aggiungi i tuoi dati anagrafici
              oppure collegati al nucleo familiare già esistente.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/nucleo-familiare" passHref>
              <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                Vai al Nucleo Familiare
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main grid */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <UpcomingEventsCard
            events={relevantEvents}
            groups={myGroups ?? []}
            isEducatore={isEducatore || isAdmin}
          />

          {/* Presenze recenti — visibile per chiunque abbia componenti familiari */}
          {membri.length > 0 && (
            <RecentAttendanceCard userId={user?.uid ?? ''} membri={membri} />
          )}

          {/* Pagamenti — per componenti familiari se presenti, altrimenti skip */}
          {(membriIds.length > 0 || isAdmin) && (
            <PaymentsDueCard
              raccolte={raccolte ?? []}
              membriIds={membriIds}
            />
          )}

          {/* Avvisi */}
          <NoticesCard />
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Mini Calendar */}
          <Card>
            <CardHeader className="pb-0 pt-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Calendario
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <MiniCalendar
                events={relevantEvents}
                membri={membri}
                filtredMembroId={null}
                groups={myGroups ?? []}
                isEducatore={isEducatore || isAdmin}
                onEventClick={() => {}}
              />

              {/* Color legend: groups (educator/admin) */}
              {(isEducatore || isAdmin) && myGroups && myGroups.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <Separator />
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mt-2">Legenda gruppi</p>
                  {myGroups.slice(0, 5).map((g, i) => (
                    <div key={g.id} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getMemberColor(i) }} />
                      <span className="text-xs text-muted-foreground truncate">{g.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Color legend: family members */}
              {membri.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <Separator />
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mt-2">Legenda componenti</p>
                  {membri.slice(0, 5).map((m, i) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getMemberColor(i + (myGroups?.length ?? 0)) }} />
                      <span className="text-xs text-muted-foreground truncate">{m.nome} {m.cognome}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* I Miei Gruppi — visible for educator/admin */}
          {(isEducatore || isAdmin) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" /> I Miei Gruppi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!myGroups || myGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nessun gruppo assegnato.</p>
                ) : (
                  <div className="space-y-2">
                    {myGroups.map((g, i) => (
                      <div key={g.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getMemberColor(i) }} />
                          <span className="text-sm font-medium">{g.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {g.memberIds?.length ?? 0} componenti
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tesseramento — visibile per chiunque abbia componenti familiari */}
          {membri.length > 0 && (
            <MembershipCard membri={membri} />
          )}
        </div>
      </div>


    </div>
  );
}
