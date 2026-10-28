'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, PlusCircle, CalendarDays, Loader2, Unlink, RefreshCw, Settings2, AlertTriangle, Info, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { it } from 'date-fns/locale';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, query, where, doc, Timestamp, updateDoc } from 'firebase/firestore';
import type { Group } from '../admin/gestione-gruppi/tutti-i-gruppi/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddEventDialog, type Evento } from '@/components/add-event-dialog';
import { areIntervalsOverlapping, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { useUserData } from '@/src/hooks/use-user-data';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnnualCalendarView } from '@/components/annual-calendar-view';
import { WeeklyCalendarView } from '@/components/weekly-calendar-view';
import { useGoogleCalendar } from '@/src/hooks/use-google-calendar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EventDetailDialog } from '@/components/event-detail-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Membro } from '../nucleo-familiare/page';
import { getCalendarColorHex, CALENDAR_COLORS, getGroupIndexColor } from '@/lib/calendar-colors';

// Extended event type that can include Google Calendar events
type CalendarEvent = (Evento & { isGoogleCalendar?: false }) | {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  groupIds: string[];
  isGoogleCalendar: true;
  htmlLink?: string;
};

// This is a custom Day component that will render events inside the calendar cell
function DayWithEvents({
  date,
  displayMonth,
  events,
  onEventClick,
  onEmptyClick,
  canAddEvents,
  isSelected,
  groupColors,
  groups,
  ...props
}: {
  date: Date;
  displayMonth: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEmptyClick: (date: Date) => void;
  canAddEvents: boolean;
  isSelected?: boolean;
  /** Per-group hex colors chosen by the user: groupId → colorId */
  groupColors?: Record<string, string>;
  /** Full list of groups — used to derive the automatic index color matching the dashboard */
  groups?: Group[];
}) {
    const isOutside = date.getMonth() !== displayMonth.getMonth();
    
    const dayEvents = useMemo(() => {
        if (isOutside) return [];
        return events
            .filter(event => {
                const startDate = event.startDate instanceof Date ? event.startDate : (event.startDate as any)?.toDate ? (event.startDate as any).toDate() : new Date(event.startDate as any);
                const endDate = event.endDate instanceof Date ? event.endDate : (event.endDate as any)?.toDate ? (event.endDate as any).toDate() : new Date(event.endDate as any);
                
                const dayInterval = { start: startOfDay(date), end: endOfDay(date) };
                const eventInterval = { start: startDate, end: endDate };
                
                return areIntervalsOverlapping(dayInterval, eventInterval);
            })
            .sort((a, b) => {
                const startA = a.startDate instanceof Date ? a.startDate : (a.startDate as any)?.toDate ? (a.startDate as any).toDate() : new Date(a.startDate as any);
                const startB = b.startDate instanceof Date ? b.startDate : (b.startDate as any)?.toDate ? (b.startDate as any).toDate() : new Date(b.startDate as any);
                if (startA.getTime() !== startB.getTime()) return startA.getTime() - startB.getTime();
                const endA = a.endDate instanceof Date ? a.endDate : (a.endDate as any)?.toDate ? (a.endDate as any).toDate() : new Date(a.endDate as any);
                const endB = b.endDate instanceof Date ? b.endDate : (b.endDate as any)?.toDate ? (b.endDate as any).toDate() : new Date(b.endDate as any);
                return endB.getTime() - endA.getTime();
            });
    }, [date, isOutside, events]);

    // Returns the hex color for a non-GCal, non-campo event based on groupColors
    const getEventColor = (event: CalendarEvent): string | undefined => {
        if (event.isGoogleCalendar || (event as any).isCampo) return undefined;
        for (const gId of (event.groupIds ?? [])) {
            const cId = groupColors?.[gId];
            if (cId && cId !== 'default') return getCalendarColorHex(cId);
            // Fall back to dashboard-matching auto color by group index
            const idx = (groups ?? []).findIndex(g => g.id === gId);
            if (idx >= 0) return getGroupIndexColor(idx);
        }
        return undefined;
    };

    const handleCellClick = (e: React.MouseEvent) => {
        if (!isOutside && canAddEvents) {
            onEmptyClick(date);
        } else if (!isOutside) {
            onEmptyClick(date); // still select date even without add permission
        }
    };

    return (
        <div
          className={cn(
            "w-full h-full flex flex-col relative p-0 transition-colors lg:overflow-hidden lg:min-h-0", 
            isOutside && "opacity-30", 
            !isOutside && "cursor-pointer hover:bg-muted/50",
            canAddEvents && !isOutside && "group",
            isSelected && !isOutside && "bg-accent/50 dark:bg-accent/30"
          )}
          onClick={handleCellClick}
        >
            <div className={cn("self-end font-medium p-1 text-sm mr-0.5 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full", isSameDay(date, new Date()) && "bg-primary text-primary-foreground")}>
              {date.getDate()}
            </div>
            
            {/* Desktop (≥1024px): Event bars */}
            <div className="hidden lg:flex flex-1 flex-col overflow-hidden gap-1 pt-0">
                {dayEvents.map((event) => {
                    const startDate = event.startDate instanceof Date ? event.startDate : (event.startDate as any)?.toDate ? (event.startDate as any).toDate() : new Date(event.startDate as any);
                    const endDate = event.endDate instanceof Date ? event.endDate : (event.endDate as any)?.toDate ? (event.endDate as any).toDate() : new Date(event.endDate as any);

                    const isStart = isSameDay(date, startDate);
                    const isEnd = isSameDay(date, endDate);

                    let roundingClass = '';
                    if (isStart && isEnd) {
                        roundingClass = 'rounded-md';
                    } else if (isStart) {
                        roundingClass = 'rounded-l-md';
                    } else if (isEnd) {
                        roundingClass = 'rounded-r-md';
                    } else {
                        roundingClass = 'rounded-none';
                    }
                    
                    const showTitle = isStart || date.getDay() === 1;
                    const isGcal = event.isGoogleCalendar;
                    const isCampoEvent = !isGcal && (event as any).isCampo;
                    const customColor = getEventColor(event);

                    return (
                        <button
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                            className={cn(
                                'text-[11px] leading-tight font-medium block text-left px-1.5 py-0.5 w-full cursor-pointer',
                                'relative w-[calc(100%+1px)] z-10',
                                isGcal
                                  ? 'bg-emerald-500/90 hover:bg-emerald-600 text-white'
                                  : isCampoEvent
                                  ? 'bg-amber-500/90 hover:bg-amber-600 text-white'
                                  : customColor
                                  ? 'text-white hover:opacity-90'
                                  : 'bg-primary/90 hover:bg-primary text-primary-foreground',
                                roundingClass
                            )}
                            style={customColor ? { backgroundColor: customColor } : undefined}
                        >
                            {showTitle ? (
                                <span className="truncate block">{isCampoEvent ? '⛺ ' : ''}{event.title}</span>
                             ) : (
                                <span>&nbsp;</span>
                             )}
                        </button>
                    );
                })}
            </div>

            {/* Below 1024px: Dots */}
            <div className="flex lg:hidden flex-wrap gap-0.5 px-0.5 justify-center pb-1 relative z-10 pointer-events-none mt-auto">
                {dayEvents.slice(0, 4).map(event => {
                    const dotColor = getEventColor(event);
                    return (
                        <div 
                          key={event.id}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            event.isGoogleCalendar ? 'bg-emerald-500'
                              : (event as any).isCampo ? 'bg-amber-500'
                              : !dotColor ? 'bg-primary' : ''
                          )}
                          style={dotColor ? { backgroundColor: dotColor } : undefined}
                        />
                    );
                })}
                {dayEvents.length > 4 && (
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground" />
                )}
            </div>
            {/* Plus hint on hover for empty cells (desktop only, educators/admin) */}
            {canAddEvents && !isOutside && dayEvents.length === 0 && (
              <div className="absolute inset-0 hidden lg:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <PlusCircle className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
        </div>
    );
}

type CalendarView = 'month' | 'year' | 'week';
type FilterMode = 'tutti' | 'personale' | 'famiglia' | string; // string = specific groupId

export default function CalendarioPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserLoading } = useUserData();

  const systemConfigRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'config', 'sistema');
  }, [firestore]);
  const { data: systemConfig } = useDoc<{ modalitaProgrammazione?: boolean }>(systemConfigRef);
  const isProgrammingMode = !!systemConfig?.modalitaProgrammazione;
  const googleCalendar = useGoogleCalendar();

  const canAddEvents = useMemo(() => {
    return userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');
  }, [userData]);

  // Role flags for finer-grained permission checks
  const isAdmin = useMemo(() => userData?.roles?.includes('admin') ?? false, [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore') ?? false, [userData]);

  // Default filter: 'tutti' for admin/educatore, 'personale' for normal users
  const [selectedGroup, setSelectedGroup] = useState<FilterMode>('tutti');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Evento | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string | null>(null);
  /** Group whose color is being edited — opens the color-picker Dialog */
  const [colorPickerGroup, setColorPickerGroup] = useState<{ id: string; name: string } | null>(null);

  // Set default filter once loading is done — non-admin users default to 'personale'
  // Do NOT gate on userData: new users with no Firestore doc must also be filtered
  useEffect(() => {
    if (isUserLoading || !userData) return; // wait for full userData load
    if (!canAddEvents) {
      setSelectedGroup('personale');
    }
  }, [isUserLoading, canAddEvents, userData]);

  // Queries
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'gruppi');
  }, [firestore]);
  const { data: groups } = useCollection<Group>(groupsQuery);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Carica eventi in una finestra statica di ~3 anni:
    // da 1 gennaio dell'anno scorso a 31 dicembre dell'anno prossimo.
    // Copre tutte le viste (mese, settimana, anno) senza caricare tutta la storia.
    const now = new Date();
    const windowStart = new Date(now.getFullYear() - 1, 0, 1);          // 1 Gen anno scorso
    const windowEnd   = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59); // 31 Dic anno prossimo
    return query(
      collection(firestore, 'eventi'),
      where('startDate', '>=', Timestamp.fromDate(windowStart)),
      where('startDate', '<=', Timestamp.fromDate(windowEnd))
    );
  }, [firestore]);
  const { data: events } = useCollection<Evento>(eventsQuery);

  // Family members query (for family filter)
  const resolvedFamilyId = userData?.familyId ?? user?.uid;
  const membriQuery = useMemoFirebase(() => {
    if (!firestore || !resolvedFamilyId) return null;
    return collection(firestore, 'famiglie', resolvedFamilyId, 'membri');
  }, [firestore, resolvedFamilyId]);
  const { data: membri } = useCollection<Membro>(membriQuery);

  // Group IDs from family members (excluding self)
  const familyGroupIds = useMemo(() => {
    const ids = new Set<string>();
    if (userData?.groupId) ids.add(userData.groupId);
    membri?.forEach(m => { if (m.groupId && m.id !== user?.uid) ids.add(m.groupId); });
    return ids;
  }, [userData, membri, user]);

  // Has family members with different groups
  const hasFamilyGroups = useMemo(() => {
    if (!membri || membri.length === 0) return false;
    const myGroupId = userData?.groupId;
    return membri.some(m => m.groupId && m.groupId !== myGroupId && m.id !== user?.uid);
  }, [membri, userData, user]);

  /**
   * Groups visible in the sync-settings panel — three-tier rule:
   *   Admin     → tutti i gruppi
   *   Educatore → proprio + famiglia + gruppi con "edu" nel nome (gruppo coordinamento educatori)
   *   Altri     → proprio + famiglia
   */
  const syncVisibleGroups = useMemo(() => {
    if (!groups) return [];
    if (isAdmin) return groups;
    if (isEducatore) {
      return groups.filter(g =>
        familyGroupIds.has(g.id) ||
        (g.name ?? '').toLowerCase().includes('edu')
      );
    }
    return groups.filter(g => familyGroupIds.has(g.id));
  }, [groups, isAdmin, isEducatore, familyGroupIds]);

  // Auto-select all visible groups the first time the user connects GCal
  // (i.e. when syncGroupIds is empty after loading completes)
  useEffect(() => {
    if (!googleCalendar.isConnected) return;
    if (googleCalendar.isLoadingSyncSettings) return;
    if (syncVisibleGroups.length === 0) return;
    if (googleCalendar.syncGroupIds.length === 0) {
      googleCalendar.updateSyncGroups(syncVisibleGroups.map(g => g.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleCalendar.isConnected, googleCalendar.isLoadingSyncSettings, googleCalendar.syncGroupIds.length, syncVisibleGroups]);


  // Filter events based on selection
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    // Se la modalità programmazione è attiva ed l'utente non è admin né educatore, nascondi tutti gli eventi
    const isEducatorOrAdmin = userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');
    if (isProgrammingMode && !isEducatorOrAdmin) {
      return [];
    }
    
    if (selectedGroup === 'tutti') return events;
    
    if (selectedGroup === 'personale') {
      if (!userData?.groupId) return [];
      return events.filter(e => e.groupIds?.includes(userData.groupId!));
    }

    if (selectedGroup === 'famiglia') {
      if (familyGroupIds.size === 0) return [];
      return events.filter(e => e.groupIds?.some(gId => familyGroupIds.has(gId)));
    }

    // Specific group ID
    return events.filter(e => e.groupIds?.includes(selectedGroup));
  }, [events, selectedGroup, userData, familyGroupIds, isProgrammingMode]);

  // Dropdown label
  const selectedGroupLabel = useMemo(() => {
    if (selectedGroup === 'tutti') return 'Tutti i gruppi';
    if (selectedGroup === 'personale') return 'I miei impegni';
    if (selectedGroup === 'famiglia') return 'Nucleo familiare';
    return groups?.find(g => g.id === selectedGroup)?.name ?? 'Gruppo';
  }, [selectedGroup, groups]);

  // Merge app events with Google Calendar events, deduplicating events
  // that were pushed to GCal from the app (same title + start time ±2 min).
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const appEvents: CalendarEvent[] = filteredEvents.map(e => ({ ...e, isGoogleCalendar: false as const }));
    if (!googleCalendar.isConnected) return appEvents;
    const gcalEvents = selectedGroup === 'tutti' ? googleCalendar.events : [];

    // Helper to build a unique key for matching app events and Google Calendar events.
    // For all-day events: compare by Rome calendar date (YYYY-MM-DD) instead of minutes,
    // avoiding timezone/midnight mismatch between Firestore Timestamps and GCal date strings.
    const toEventKey = (title: string, date: Date, allDay?: boolean) => {
      const normTitle = (title ?? '').trim().toLowerCase();
      if (allDay) {
        try {
          const dayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(date);
          return `${normTitle}|allday|${dayStr}`;
        } catch {
          return `${normTitle}|allday|${date.toISOString().slice(0, 10)}`;
        }
      }
      const bucket = Math.round(date.getTime() / (2 * 60 * 1000));
      return `${normTitle}|${bucket}`;
    };

    const appEventKeys = new Set<string>();
    appEvents.forEach(e => {
      const start = e.startDate instanceof Date ? e.startDate : (e.startDate as any)?.toDate ? (e.startDate as any).toDate() : new Date(e.startDate as any);
      appEventKeys.add(toEventKey(e.title ?? '', start, !!e.allDay));
    });

    const uniqueGcalEvents = gcalEvents.filter(ev => {
      const start = ev.startDate instanceof Date ? ev.startDate : new Date(ev.startDate as any);
      const key = toEventKey(ev.title ?? '', start, !!ev.allDay);
      return !appEventKeys.has(key);
    });

    return [...appEvents, ...uniqueGcalEvents];
  }, [filteredEvents, googleCalendar.isConnected, googleCalendar.events, selectedGroup]);

  const handleEditEvent = (event: CalendarEvent) => {
    if (event.isGoogleCalendar) {
      if ((event as any).htmlLink) {
        window.open((event as any).htmlLink, '_blank');
      }
      return;
    }
    if (!canAddEvents) {
      // Read-only users see the detail dialog
      setDetailEvent(event);
      setIsDetailOpen(true);
      return;
    }
    setEditingEvent(event as Evento);
    setInitialDate(null);
    setIsDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingEvent(null);
    setInitialDate(selectedDate);
    setIsDialogOpen(true);
  };

  const handleCellClick = useCallback((date: Date) => {
    setSelectedDate(date);
    // Clicking a day selects it and shows its events in the side panel (desktop)
    // or in the list below the calendar (mobile).
    // New events can be added via the "Aggiungi Impegno" button at the top.
  }, []);
  
  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
        setEditingEvent(null);
        setInitialDate(null);
    }
    setIsDialogOpen(isOpen);
  };

  // Events for selected day (mobile list)
  const selectedDayEvents = useMemo(() => {
    return allEvents.filter(event => {
      const startDate = event.startDate instanceof Date ? event.startDate : (event.startDate as any)?.toDate ? (event.startDate as any).toDate() : new Date(event.startDate as any);
      const endDate = event.endDate instanceof Date ? event.endDate : (event.endDate as any)?.toDate ? (event.endDate as any).toDate() : new Date(event.endDate as any);
      const dayInterval = { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      const eventInterval = { start: startDate, end: endDate };
      return areIntervalsOverlapping(dayInterval, eventInterval);
    }).sort((a, b) => {
      const startA = a.startDate instanceof Date ? a.startDate : (a.startDate as any)?.toDate ? (a.startDate as any).toDate() : new Date(a.startDate as any);
      const startB = b.startDate instanceof Date ? b.startDate : (b.startDate as any)?.toDate ? (b.startDate as any).toDate() : new Date(b.startDate as any);
      return startA.getTime() - startB.getTime();
    });
  }, [allEvents, selectedDate]);

  const getGroupName = useCallback((id: string) => groups?.find(g => g.id === id)?.name, [groups]);

  // Per-group colors from user preferences: groupId → colorId
  const groupColors = useMemo(() => userData?.groupColors ?? {}, [userData?.groupColors]);

  // Save a per-group color preference to Firestore immediately
  const handleGroupColorChange = useCallback(async (groupId: string, colorId: string) => {
    if (!firestore || !user) return;
    await updateDoc(doc(firestore, 'users', user.uid), {
      [`groupColors.${groupId}`]: colorId,
    });
  }, [firestore, user]);

  // Helper used in side panels: returns event hex color based on groupColors
  const getEventPanelColor = useCallback((event: CalendarEvent): string | undefined => {
    if (event.isGoogleCalendar) return undefined;
    for (const gId of (event.groupIds ?? [])) {
      const cId = groupColors[gId];
      if (cId && cId !== 'default') return getCalendarColorHex(cId);
      // Fall back to dashboard-matching auto color by group index
      const idx = (groups ?? []).findIndex(g => g.id === gId);
      if (idx >= 0) return getGroupIndexColor(idx);
    }
    return undefined;
  }, [groupColors, groups]);

  return (
    <TooltipProvider>
    {/* Mobile: page scrolls naturally. Desktop: fixed viewport height. */}
    <div className="flex flex-col pb-4 gap-4 lg:h-[calc(100vh-6rem)]">
      <AddEventDialog 
        isOpen={isDialogOpen}
        onOpenChange={handleDialogChange}
        eventToEdit={editingEvent}
        initialDate={initialDate}
      />
      <EventDetailDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        event={detailEvent as any}
        getGroupName={getGroupName}
      />

      {/* Group color picker — Dialog at page level to avoid Radix nesting issues */}
      <Dialog open={!!colorPickerGroup} onOpenChange={open => { if (!open) setColorPickerGroup(null); }}>
        <DialogContent className="sm:max-w-xs p-5">
          <DialogHeader>
            <DialogTitle className="text-base">
              Colore per &quot;{colorPickerGroup?.name}&quot;
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2.5 pt-2">
            {/* Default / primary */}
            <button
              type="button"
              className={cn(
                'h-9 w-9 rounded-full bg-primary border-2 flex items-center justify-center transition-all hover:scale-110',
                (groupColors[colorPickerGroup?.id ?? ''] ?? 'default') === 'default'
                  ? 'border-foreground shadow-md scale-110'
                  : 'border-transparent'
              )}
              onClick={() => {
                if (colorPickerGroup) handleGroupColorChange(colorPickerGroup.id, 'default');
                setColorPickerGroup(null);
              }}
              title="Predefinito"
            >
              {(groupColors[colorPickerGroup?.id ?? ''] ?? 'default') === 'default' && (
                <span className="h-2 w-2 rounded-full bg-white/80 block" />
              )}
            </button>
            {CALENDAR_COLORS.map(color => (
              <button
                key={color.id}
                type="button"
                className={cn(
                  'h-9 w-9 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110',
                  groupColors[colorPickerGroup?.id ?? ''] === color.id
                    ? 'border-foreground shadow-md scale-110'
                    : 'border-transparent'
                )}
                style={{ backgroundColor: color.hex }}
                onClick={() => {
                  if (colorPickerGroup) handleGroupColorChange(colorPickerGroup.id, color.id);
                  setColorPickerGroup(null);
                }}
                title={color.label}
              >
                {groupColors[colorPickerGroup?.id ?? ''] === color.id && (
                  <span className="h-2 w-2 rounded-full bg-white/80 block" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {isProgrammingMode && (
        canAddEvents ? (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div>
              <AlertTitle className="font-semibold text-xs sm:text-sm">Modalità Programmazione Attiva</AlertTitle>
              <AlertDescription className="text-xs">
                Gli utenti normali non vedono alcun impegno e non ricevono notifiche in questa modalità. Solo gli educatori e gli admin possono visualizzare e modificare gli eventi del calendario.
              </AlertDescription>
            </div>
          </Alert>
        ) : (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div>
              <AlertTitle className="font-semibold text-xs sm:text-sm">Calendario in Programmazione</AlertTitle>
              <AlertDescription className="text-xs">
                Il calendario è in modalità programmazione. Gli educatori stanno inserendo gli impegni per il nuovo anno. Gli eventi non saranno visibili fino al completamento della pianificazione.
              </AlertDescription>
            </div>
          </Alert>
        )
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <div className="flex flex-wrap items-center gap-2">
          {canAddEvents && (
            <Button onClick={handleAddNew} className="w-full sm:w-auto" data-assistant="add-event-btn">
              <PlusCircle className="mr-2 h-4 w-4" />
              Aggiungi Impegno
            </Button>
          )}

          {/* Google Calendar section */}
          {googleCalendar.isConnected === null ? (
            <Button variant="outline" disabled size="sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Caricamento...
            </Button>
          ) : googleCalendar.isConnected ? (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950 gap-1.5 py-1 px-2">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="text-xs">Google Calendar</span>
              </Badge>

              <Popover open={showSyncSettings} onOpenChange={setShowSyncSettings}>
                <Tooltip>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                  </PopoverTrigger>
                  <TooltipContent>Impostazioni sincronizzazione</TooltipContent>
                </Tooltip>

                <PopoverContent
                  align="end"
                  side="bottom"
                  sideOffset={6}
                  collisionPadding={12}
                  className="w-[calc(100vw-1.5rem)] max-w-sm sm:w-80 max-h-[80vh] overflow-y-auto p-4 text-sm z-[200] shadow-xl"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b">
                    <p className="font-semibold text-sm">Gruppi da sincronizzare</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Gli eventi di questi gruppi appariranno nel tuo Google Calendar.
                  </p>
                  {googleCalendar.isLoadingSyncSettings ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {syncVisibleGroups.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-1">
                          Nessun gruppo associato al tuo profilo o alla tua famiglia.
                        </p>
                      ) : (
                        syncVisibleGroups.map(group => (
                          <label
                            key={group.id}
                            htmlFor={`sync-${group.id}`}
                            className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/60 cursor-pointer select-none transition-colors"
                          >
                            <Checkbox
                              id={`sync-${group.id}`}
                              checked={googleCalendar.syncGroupIds.includes(group.id)}
                              onCheckedChange={(checked) => {
                                const next = checked
                                  ? [...googleCalendar.syncGroupIds, group.id]
                                  : googleCalendar.syncGroupIds.filter(id => id !== group.id);
                                googleCalendar.updateSyncGroups(next);
                              }}
                            />
                            <span className="text-sm font-medium">{group.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}

                  {/* Admin-only: migrate existing connected users */}
                  {canAddEvents && (
                    <div className="mt-4 pt-3 border-t flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground font-medium">Strumenti admin</p>

                      {/* ── Migrazione gruppi ────────────────────────────── */}
                      <p className="text-xs text-muted-foreground">
                        Imposta automaticamente i gruppi per tutti gli utenti già connessi che non hanno ancora configurato la sincronizzazione.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isMigrating}
                        onClick={async () => {
                          setIsMigrating(true);
                          setMigrateResult(null);
                          const result = await googleCalendar.migrateAllUsers();
                          setIsMigrating(false);
                          if (result?.summary) {
                            setMigrateResult(
                              `✅ Migrati: ${result.summary.migrated}, già configurati: ${result.summary.alreadyConfigured}, senza gruppo: ${result.summary.noGroup}${result.summary.errors > 0 ? `, errori: ${result.summary.errors}` : ''}`
                            );
                          }
                        }}
                      >
                        {isMigrating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Migra utenti connessi
                      </Button>

                      {/* ── Rimozione duplicati ──────────────────────────── */}
                      <p className="text-xs text-muted-foreground mt-1">
                        Rimuove gli eventi duplicati dal Google Calendar di tutti gli utenti connessi (stesso titolo + stessa data).
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isMigrating}
                        onClick={async () => {
                          setIsMigrating(true);
                          setMigrateResult(null);
                          const result = await googleCalendar.removeDuplicates();
                          setIsMigrating(false);
                          if (result && (result as Record<string, unknown>).summary) {
                            const s = (result as Record<string, unknown>).summary as Record<string, number>;
                            setMigrateResult(
                              `🗑️ Duplicati rimossi: ${s.totalRemoved} (su ${s.totalChecked} eventi, ${s.usersProcessed} utenti)${s.errors > 0 ? `, errori: ${s.errors}` : ''}`
                            );
                          } else if (result && (result as Record<string, unknown>).error) {
                            setMigrateResult(`❌ ${(result as Record<string, unknown>).error}`);
                          }
                        }}
                      >
                        {isMigrating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Rimuovi duplicati GCal
                      </Button>

                      {/* ── Test singolo utente (Damiano) ───────────────── */}
                      <p className="text-xs text-muted-foreground mt-1 border-t pt-2">⚠️ Temporaneo — test su damianopiantoni07@gmail.com</p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-dashed text-orange-600 hover:text-orange-700 flex-1"
                          disabled={isMigrating}
                          onClick={async () => {
                            setIsMigrating(true);
                            setMigrateResult(null);
                            const result = await googleCalendar.migrateUser('damianopiantoni07@gmail.com', true);
                            setIsMigrating(false);
                            if (result && (result as Record<string, unknown>).summary) {
                              const pushed = (result as Record<string, unknown>).pushed as number ?? 0;
                              const skipped = (result as Record<string, unknown>).skipped as number ?? 0;
                              const gcalErrs = (result as Record<string, unknown>).gcalErrors as string[] ?? [];
                              const syncGroupIds = ((result as Record<string, unknown>).migrated as Array<Record<string, unknown>>)?.[0]?.syncGroupIds as string[] ?? [];
                              let msg = `🧪 Migra Damiano: pushati=${pushed}, già in GCal=${skipped}`;
                              if (gcalErrs.length > 0) msg += `, errori=${gcalErrs.length}: ${gcalErrs[0]}`;
                              if (syncGroupIds.length > 0) msg += ` (gruppi: ${syncGroupIds.length})`;
                              setMigrateResult(msg);
                            } else if (result && (result as Record<string, unknown>).note) {
                              setMigrateResult(`ℹ️ ${(result as Record<string, unknown>).note}`);
                            } else if (result && (result as Record<string, unknown>).error) {
                              setMigrateResult(`❌ ${(result as Record<string, unknown>).error}`);
                            }
                          }}
                        >
                          {isMigrating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          🧪 Migra
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-dashed text-orange-600 hover:text-orange-700 flex-1"
                          disabled={isMigrating}
                          onClick={async () => {
                            setIsMigrating(true);
                            setMigrateResult(null);
                            const result = await googleCalendar.removeDuplicates('damianopiantoni07@gmail.com');
                            setIsMigrating(false);
                            if (result && (result as Record<string, unknown>).summary) {
                              const s = (result as Record<string, unknown>).summary as Record<string, number>;
                              setMigrateResult(`🧪 Dedup Damiano: rimossi=${s.totalRemoved} su ${s.totalChecked}${s.errors > 0 ? `, errori=${s.errors}` : ''}`);
                            } else if (result && (result as Record<string, unknown>).error) {
                              setMigrateResult(`❌ ${(result as Record<string, unknown>).error}`);
                            }
                          }}
                        >
                          {isMigrating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          🧪 Dedup
                        </Button>
                      </div>

                      {migrateResult && (
                        <p className="text-xs text-muted-foreground">{migrateResult}</p>
                      )}
                    </div>
                  )}

                </PopoverContent>
              </Popover>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => googleCalendar.loadEvents()}
                    disabled={googleCalendar.isLoadingEvents}>
                    <RefreshCw className={cn("h-3.5 w-3.5", googleCalendar.isLoadingEvents && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aggiorna eventi Google Calendar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => googleCalendar.disconnect()}>
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Disconnetti Google Calendar</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-assistant="connect-gcal-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => googleCalendar.connect()}
                  className="gap-2 border-dashed"
                >
                  <CalendarDays className="h-4 w-4" />
                  Connetti Google Calendar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sincronizza il tuo calendario Google personale. Gli eventi personali saranno visibili solo a te.</TooltipContent>
            </Tooltip>
          )}

          {googleCalendar.error && (
            <span className="text-xs text-destructive">{googleCalendar.error}</span>
          )}

          {/* Group/filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none justify-between">
                <span className="truncate">{selectedGroupLabel}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[calc(100vw-2rem)] sm:w-auto max-w-[300px]">
              {/* Personal view - always available */}
              <DropdownMenuItem onSelect={() => setSelectedGroup('personale')} className="flex items-center gap-2 cursor-pointer">
                <div className={cn(
                  "h-3.5 w-3.5 rounded-sm border-2 shrink-0 flex items-center justify-center transition-colors",
                  selectedGroup === 'personale' ? 'bg-slate-500 border-slate-500' : 'border-slate-300 dark:border-slate-600'
                )}>
                  {selectedGroup === 'personale' && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>
                I miei impegni
              </DropdownMenuItem>
              {/* Family view - only if user has family with other groups */}
              {hasFamilyGroups && (
                <DropdownMenuItem onSelect={() => setSelectedGroup('famiglia')} className="flex items-center gap-2 cursor-pointer">
                  <div className={cn(
                    "h-3.5 w-3.5 rounded-sm border-2 shrink-0 flex items-center justify-center transition-colors",
                    selectedGroup === 'famiglia' ? 'bg-slate-500 border-slate-500' : 'border-slate-300 dark:border-slate-600'
                  )}>
                    {selectedGroup === 'famiglia' && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                  Nucleo familiare
                </DropdownMenuItem>
              )}
              {/* Admin/educatore extras */}
              {canAddEvents && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedGroup('tutti')} className="flex items-center gap-2 cursor-pointer">
                    <div className={cn(
                      "h-3.5 w-3.5 rounded-sm border-2 shrink-0 flex items-center justify-center transition-colors",
                      selectedGroup === 'tutti' ? 'bg-slate-500 border-slate-500' : 'border-slate-300 dark:border-slate-600'
                    )}>
                      {selectedGroup === 'tutti' && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    Tutti i gruppi
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {groups?.map((group, groupIndex) => {
                    const colorId = groupColors[group.id] ?? 'default';
                    // Use the user's custom color if set, otherwise auto-index color (same as calendar events)
                    const colorHex = getCalendarColorHex(colorId) ?? getGroupIndexColor(groupIndex);
                    // Un gruppo appare "selezionato" se è esplicitamente selezionato OPPURE se si è in modalità "tutti"
                    const isGroupActive = selectedGroup === group.id || selectedGroup === 'tutti';
                    return (
                      <DropdownMenuItem
                        key={group.id}
                        onSelect={() => setSelectedGroup(group.id)}
                        className="flex items-center justify-between gap-2 pr-1.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Left: fixed checkbox-style indicator (neutral gray) */}
                          <div className={cn(
                            "h-3.5 w-3.5 rounded-sm border-2 shrink-0 flex items-center justify-center transition-colors",
                            isGroupActive ? 'bg-slate-500 border-slate-500' : 'border-slate-300 dark:border-slate-600'
                          )}>
                            {isGroupActive && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                          </div>
                          <span className="truncate">{group.name}</span>
                        </div>
                        {/* Right: color dot — shows group color, click opens color picker Dialog */}
                        <button
                          type="button"
                          onPointerDown={e => e.stopPropagation()}
                          onPointerUp={e => e.stopPropagation()}
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setColorPickerGroup({ id: group.id, name: group.name });
                          }}
                          className="h-5 w-5 rounded-full shrink-0 border-2 border-white/60 shadow-sm hover:scale-110 transition-transform"
                          style={{ backgroundColor: colorHex }}
                          title={`Cambia colore per ${group.name}`}
                        />
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={view} onValueChange={(value) => setView(value as CalendarView)}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-[180px]">
                  <SelectValue placeholder="Visualizzazione" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="month">Mese</SelectItem>
                  <SelectItem value="week">Settimana</SelectItem>
                  <SelectItem value="year">Anno</SelectItem>
                  <SelectItem value="timeline" disabled>Timeline Progetti (in arrivo)</SelectItem>
              </SelectContent>
          </Select>

        </div>
      </div>
      
      {view === 'month' && (
        <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-4">
        <Card className="lg:flex-1 lg:flex lg:flex-col lg:min-h-0 overflow-hidden">
            <CardContent className="p-0 lg:flex-1 lg:flex lg:flex-col lg:min-h-0">
            <Calendar
                mode="single"
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                locale={it}
                showOutsideDays={true}
                fixedWeeks={true}
                className="p-0 lg:flex-1 lg:flex lg:flex-col w-full lg:h-full"
                classNames={{
                    months: 'lg:flex-1 w-full lg:flex lg:flex-col',
                    month: 'w-full space-y-0 lg:flex-1 lg:flex lg:flex-col',
                    table: 'w-full border-collapse flex flex-col lg:flex-1 lg:h-full [&_tbody]:lg:flex-1 [&_tbody]:flex [&_tbody]:flex-col',
                    head_row: 'flex w-full border-b',
                    head_cell: 'flex-1 text-muted-foreground font-normal text-sm p-2 text-center',
                    row: 'flex w-full border-b lg:flex-1',
                    cell: 'flex-1 border-r last:border-r-0 relative p-0 min-h-[3.75rem] lg:min-h-0 lg:overflow-hidden',
                    day: 'w-full h-full p-0 flex flex-col lg:overflow-hidden lg:min-h-0',
                    day_selected: '',
                    day_today: '',
                    day_outside: '',
                    day_hidden: 'invisible',
                    caption_label: "text-lg font-medium",
                    caption: "p-4 flex justify-center relative items-center shrink-0",
                }}
                components={{
                    Day: (props) => (
                      <DayWithEvents
                        {...props}
                        events={allEvents}
                        onEventClick={handleEditEvent}
                        onEmptyClick={handleCellClick}
                        canAddEvents={canAddEvents}
                        isSelected={isSameDay(props.date, selectedDate)}
                        groupColors={groupColors}
                        groups={groups ?? []}
                      />
                    )
                }}
            />
            </CardContent>
        </Card>

        {/* Desktop Selected Day Panel */}
        <div className="hidden lg:flex flex-col w-72 shrink-0 gap-2 overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-base capitalize leading-tight">
              {selectedDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            {canAddEvents && (
              <Button size="icon" variant="ghost" onClick={handleAddNew} className="h-8 w-8 shrink-0">
                <PlusCircle className="h-5 w-5" />
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
            {selectedDayEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center border rounded-lg border-dashed">
                Nessun impegno
              </p>
            ) : (
              selectedDayEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => handleEditEvent(event)}
                  className={cn(
                    "flex flex-col p-3 rounded-xl border text-sm cursor-pointer shrink-0",
                    event.isGoogleCalendar
                      ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
                      : "bg-card shadow-sm hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", event.isGoogleCalendar ? 'bg-emerald-500' : (!getEventPanelColor(event) ? 'bg-primary' : ''))}
                      style={(!event.isGoogleCalendar && getEventPanelColor(event)) ? { backgroundColor: getEventPanelColor(event) } : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold leading-tight mb-1 truncate">{event.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {event.allDay
                          ? 'Tutto il giorno'
                          : `${(event.startDate instanceof Date ? event.startDate : (event.startDate as any)?.toDate ? (event.startDate as any).toDate() : new Date(event.startDate as any)).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} – ${(event.endDate instanceof Date ? event.endDate : (event.endDate as any)?.toDate ? (event.endDate as any).toDate() : new Date(event.endDate as any)).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </div>
      )}

      {/* Mobile Selected Day Events List */}
      {view === 'month' && (
        <div className="lg:hidden flex flex-col gap-3 shrink-0 px-1 py-2">
          <h3 className="font-semibold text-base flex items-center justify-between capitalize">
            {selectedDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            {canAddEvents && (
              <Button size="icon" variant="ghost" onClick={handleAddNew} className="h-8 w-8">
                <PlusCircle className="h-5 w-5" />
              </Button>
            )}
          </h3>
          <div className="flex flex-col gap-2">
            {selectedDayEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center border rounded-lg border-dashed">
                Nessun impegno in questa giornata
              </p>
            ) : (
              selectedDayEvents.map(event => (
                <div 
                  key={event.id}
                  onClick={() => handleEditEvent(event)}
                  className={cn(
                    "flex flex-col p-3 rounded-xl border text-sm cursor-pointer",
                    event.isGoogleCalendar 
                      ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" 
                      : "bg-card shadow-sm hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", event.isGoogleCalendar ? 'bg-emerald-500' : (!getEventPanelColor(event) ? 'bg-primary' : ''))}
                      style={(!event.isGoogleCalendar && getEventPanelColor(event)) ? { backgroundColor: getEventPanelColor(event) } : undefined}
                    />
                    <div className="flex-1">
                      <p className="font-semibold leading-tight mb-1">{event.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {event.allDay 
                          ? 'Tutto il giorno' 
                          : `${(event.startDate instanceof Date ? event.startDate : (event.startDate as any)?.toDate ? (event.startDate as any).toDate() : new Date(event.startDate as any)).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} – ${(event.endDate instanceof Date ? event.endDate : (event.endDate as any)?.toDate ? (event.endDate as any).toDate() : new Date(event.endDate as any)).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {view === 'year' && (
            <AnnualCalendarView events={filteredEvents || []} onEventClick={handleEditEvent} />
      )}

      {view === 'week' && (
        <WeeklyCalendarView events={filteredEvents || []} onEventClick={handleEditEvent} />
      )}

      {/* Legend - always visible */}
      <div className="flex items-center flex-wrap gap-4 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
          Impegni
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
          ⛺ Campi
        </div>
        {googleCalendar.isConnected && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            Il tuo Google Calendar (solo tu)
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
