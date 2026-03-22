'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, PlusCircle, CalendarDays, Loader2, Unlink, RefreshCw, ExternalLink } from 'lucide-react';
import { it } from 'date-fns/locale';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
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
  onEventClick,
  onEmptyClick,
  canAddEvents,
  ...props
}: {
  date: Date;
  displayMonth: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEmptyClick: (date: Date) => void;
  canAddEvents: boolean;
}) {
    const isOutside = date.getMonth() !== displayMonth.getMonth();
    
    const dayEvents = useMemo(() => {
        if (isOutside) return [];
        return props.events
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
    }, [date, isOutside, props.events]);

    const handleCellClick = (e: React.MouseEvent) => {
        // Trigger on any click within the cell that isn't on an event button
        if (!isOutside && canAddEvents) {
            onEmptyClick(date);
        }
    };

    return (
        <div
          className={cn("w-full h-full flex flex-col relative p-0", isOutside && "opacity-30", canAddEvents && !isOutside && "group cursor-pointer")}
          onClick={handleCellClick}
        >
            <div className="self-end font-normal p-1 text-sm">
              {date.getDate()}
            </div>
            <div className="flex-1 flex flex-col overflow-hidden gap-1 pt-1">
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

                    return (
                        <button
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                            className={cn(
                                'text-xs font-normal block text-left px-2 py-0.5 w-full cursor-pointer',
                                'relative w-[calc(100%+1px)]',
                                isGcal
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-primary text-primary-foreground',
                                roundingClass
                            )}
                        >
                            {showTitle ? (
                                <span className="truncate block">{event.title}</span>
                             ) : (
                                <span>&nbsp;</span>
                             )}
                        </button>
                    );
                })}
            </div>
            {/* Plus hint on hover for empty cells */}
            {canAddEvents && !isOutside && dayEvents.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <PlusCircle className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
        </div>
    );
}

type CalendarView = 'month' | 'year' | 'week';

export default function CalendarioPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedGroup, setSelectedGroup] = useState<string>('tutti');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Evento | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);
  const [view, setView] = useState<CalendarView>('month');

  const firestore = useFirestore();
  const { userData } = useUserData();
  const googleCalendar = useGoogleCalendar();

  const canAddEvents = useMemo(() => {
    return userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');
  }, [userData]);

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

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (selectedGroup === 'tutti') return events;
    return events.filter(event => event.groupIds.includes(selectedGroup));
  }, [events, selectedGroup]);

  // Merge app events with personal Google Calendar events
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const appEvents: CalendarEvent[] = filteredEvents.map(e => ({ ...e, isGoogleCalendar: false as const }));
    if (!googleCalendar.isConnected) return appEvents;
    // Show Google Calendar events only when viewing "all groups" or no group filter
    const gcalEvents = selectedGroup === 'tutti' ? googleCalendar.events : [];
    return [...appEvents, ...gcalEvents];
  }, [filteredEvents, googleCalendar.isConnected, googleCalendar.events, selectedGroup]);

  const handleEditEvent = (event: CalendarEvent) => {
    if (event.isGoogleCalendar) {
      // For Google Calendar events, open a link to the event
      if ((event as any).htmlLink) {
        window.open((event as any).htmlLink, '_blank');
      }
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

  return (
    <TooltipProvider>
    <div className="flex flex-col pb-4 h-[calc(100vh-6rem)] gap-4">
      <AddEventDialog 
        isOpen={isDialogOpen}
        onOpenChange={handleDialogChange}
        eventToEdit={editingEvent}
        initialDate={initialDate}
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

          {/* Google Calendar Sync Button */}
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => googleCalendar.loadEvents()}
                    disabled={googleCalendar.isLoadingEvents}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", googleCalendar.isLoadingEvents && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aggiorna eventi Google Calendar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => googleCalendar.disconnect()}
                  >
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none justify-between">
                <span className="truncate">
                  {selectedGroup === 'tutti' ? 'Tutti i gruppi' : groups?.find(g => g.id === selectedGroup)?.name}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[calc(100vw-2rem)] sm:w-auto max-w-[300px]">
              <DropdownMenuRadioGroup value={selectedGroup} onValueChange={setSelectedGroup}>
                <DropdownMenuRadioItem value="tutti">Tutti i gruppi</DropdownMenuRadioItem>
                {groups?.map(group => (
                  <DropdownMenuRadioItem key={group.id} value={group.id}>
                    {group.name}
                  </DropdownMenuRadioItem>
                ))}
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
        <Card className="flex-1 flex flex-col min-h-0 overflow-auto lg:overflow-hidden">
            <CardContent className="p-0 flex-1 flex flex-col min-h-0">
            <Calendar
                mode="single"
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                locale={it}
                showOutsideDays={true}
                fixedWeeks={true}
                className="p-0 flex-1 flex flex-col w-full h-full"
                classNames={{
                    months: 'flex-1 w-full flex flex-col',
                    month: 'w-full space-y-0 flex-1 flex flex-col',
                    table: 'w-full h-full border-collapse flex flex-col flex-1 [&_tbody]:flex-1 [&_tbody]:flex [&_tbody]:flex-col',
                    head_row: 'flex w-full border-b',
                    head_cell: 'flex-1 text-muted-foreground font-normal text-sm p-2 text-center',
                    row: 'flex w-full border-b flex-1',
                    cell: 'flex-1 border-r last:border-r-0 relative p-0 min-h-[6rem] lg:min-h-0',
                    day: 'w-full h-full p-0 flex flex-col',
                    day_selected: 'bg-accent/50 text-foreground',
                    day_today: 'bg-accent text-accent-foreground',
                    day_outside: '', // Handled by custom Day component
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
                      />
                    )
                }}
            />
            </CardContent>
        </Card>
      )}

      {view === 'year' && (
            <AnnualCalendarView events={filteredEvents || []} onEventClick={handleEditEvent} />
      )}

      {view === 'week' && (
        <WeeklyCalendarView events={filteredEvents || []} onEventClick={handleEditEvent} />
      )}

      {/* Legend */}
      {googleCalendar.isConnected && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
            Impegni AC Chiari
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            Il tuo Google Calendar (solo tu)
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
