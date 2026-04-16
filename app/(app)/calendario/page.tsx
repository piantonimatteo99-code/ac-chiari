'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, PlusCircle, CalendarDays, Loader2, Unlink, RefreshCw, Settings2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { it } from 'date-fns/locale';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/src/firebase';
import { collection } from 'firebase/firestore';
import type { Group } from '../admin/gestione-gruppi/tutti-i-gruppi/page';
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
import { EventDetailDialog } from '@/components/event-detail-dialog';
import type { Membro } from '../nucleo-familiare/page';

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
  ...props
}: {
  date: Date;
  displayMonth: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEmptyClick: (date: Date) => void;
  canAddEvents: boolean;
  isSelected?: boolean;
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
            "w-full h-full flex flex-col relative p-0 transition-colors", 
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
                                  : 'bg-primary/90 hover:bg-primary text-primary-foreground',
                                roundingClass
                            )}
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
                {dayEvents.slice(0, 4).map(event => (
                    <div 
                      key={event.id}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        event.isGoogleCalendar ? 'bg-emerald-500'
                          : (event as any).isCampo ? 'bg-amber-500'
                          : 'bg-primary'
                      )} 
                    />
                ))}
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
  const googleCalendar = useGoogleCalendar();

  const canAddEvents = useMemo(() => {
    return userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');
  }, [userData]);

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
    return collection(firestore, 'eventi');
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

  // Filter events based on selection
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
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
  }, [events, selectedGroup, userData, familyGroupIds]);

  // Dropdown label
  const selectedGroupLabel = useMemo(() => {
    if (selectedGroup === 'tutti') return 'Tutti i gruppi';
    if (selectedGroup === 'personale') return 'I miei impegni';
    if (selectedGroup === 'famiglia') return 'Nucleo familiare';
    return groups?.find(g => g.id === selectedGroup)?.name ?? 'Gruppo';
  }, [selectedGroup, groups]);

  // Merge app events with Google Calendar events
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const appEvents: CalendarEvent[] = filteredEvents.map(e => ({ ...e, isGoogleCalendar: false as const }));
    if (!googleCalendar.isConnected) return appEvents;
    const gcalEvents = selectedGroup === 'tutti' ? googleCalendar.events : [];
    return [...appEvents, ...gcalEvents];
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
    setInitialDate(null);
    setIsDialogOpen(true);
  };

  const handleCellClick = useCallback((date: Date) => {
    setSelectedDate(date);
    // On mobile: just select the date, don't open dialog
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;
    if (!canAddEvents) return;
    setEditingEvent(null);
    setInitialDate(date);
    setIsDialogOpen(true);
  }, [canAddEvents]);
  
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <div className="flex flex-wrap items-center gap-2">
          {canAddEvents && (
            <Button onClick={handleAddNew} className="w-full sm:w-auto">
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
            <div className="relative">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950 gap-1.5 py-1 px-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="text-xs">Google Calendar</span>
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setShowSyncSettings(v => !v)}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Impostazioni sincronizzazione</TooltipContent>
                </Tooltip>
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

              {/* Sync settings — floating dropdown, does not affect layout flow */}
              {showSyncSettings && (
                <div className="absolute right-0 top-full mt-1 z-[200] border rounded-lg p-3 bg-popover shadow-md w-64 text-sm">
                  <p className="font-medium mb-2">Gruppi da sincronizzare</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Gli eventi di questi gruppi appariranno nel tuo Google Calendar.
                  </p>
                  {googleCalendar.isLoadingSyncSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {groups?.map(group => (
                        <div key={group.id} className="flex items-center gap-2">
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
                          <label htmlFor={`sync-${group.id}`} className="cursor-pointer">{group.name}</label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
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
              <DropdownMenuRadioGroup value={selectedGroup} onValueChange={setSelectedGroup}>
                {/* Personal view - always available */}
                <DropdownMenuRadioItem value="personale">I miei impegni</DropdownMenuRadioItem>
                {/* Family view - only if user has family with other groups */}
                {hasFamilyGroups && (
                  <DropdownMenuRadioItem value="famiglia">Nucleo familiare</DropdownMenuRadioItem>
                )}
                {/* Admin/educatore extras */}
                {canAddEvents && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioItem value="tutti">Tutti i gruppi</DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    {groups?.map(group => (
                      <DropdownMenuRadioItem key={group.id} value={group.id}>
                        {group.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </>
                )}
              </DropdownMenuRadioGroup>
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
                    cell: 'flex-1 border-r last:border-r-0 relative p-0 min-h-[3.75rem] lg:min-h-0',
                    day: 'w-full h-full p-0 flex flex-col',
                    day_selected: 'bg-accent/50 text-foreground',
                    day_today: 'bg-accent text-accent-foreground',
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
                      />
                    )
                }}
            />
            </CardContent>
        </Card>
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
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", event.isGoogleCalendar ? 'bg-emerald-500' : 'bg-primary')} />
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
