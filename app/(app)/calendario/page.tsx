'use client';

import { useState, useMemo } from 'react';
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
import { ChevronDown, PlusCircle } from 'lucide-react';
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

// This is a custom Day component that will render events inside the calendar cell
function DayWithEvents({ date, displayMonth, onEventClick, ...props }: { date: Date, displayMonth: Date, events: Evento[], onEventClick: (event: Evento) => void }) {
    const isOutside = date.getMonth() !== displayMonth.getMonth();
    
    // Sort events to have a consistent order and filter for the current day
    const dayEvents = useMemo(() => {
        if (isOutside) return [];
        return props.events
            .filter(event => {
                const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
                
                const dayInterval = { start: startOfDay(date), end: endOfDay(date) };
                const eventInterval = { start: startDate, end: endDate };
                
                return areIntervalsOverlapping(dayInterval, eventInterval);
            })
            .sort((a, b) => {
                const startA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
                const startB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
                if (startA.getTime() !== startB.getTime()) {
                    return startA.getTime() - startB.getTime();
                }
                const endA = a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate);
                const endB = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate);
                return endB.getTime() - endA.getTime(); // Longer events first
            });
    }, [date, isOutside, props.events]);

    return (
        <div className={cn("w-full h-full flex flex-col relative p-0", isOutside && "opacity-30")}>
            <div className="self-end font-normal p-1">{date.getDate()}</div>
            <div className="flex-1 flex flex-col overflow-hidden gap-1 pt-1">
                {dayEvents.map((event) => {
                    const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                    const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);

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

                    return (
                        <button
                            key={event.id}
                            onClick={() => onEventClick(event)}
                            className={cn(
                                'bg-primary text-primary-foreground text-xs font-normal block text-left px-2 py-0.5 w-full cursor-pointer',
                                'relative w-[calc(100%+1px)]', // Overlap the right border of the cell
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
        </div>
    );
}

type CalendarView = 'month' | 'year' | 'week';

export default function CalendarioPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedGroup, setSelectedGroup] = useState<string>('tutti');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Evento | null>(null);
  const [view, setView] = useState<CalendarView>('month');

  const firestore = useFirestore();
  const { userData } = useUserData();

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

  const handleEditEvent = (event: Evento) => {
    setEditingEvent(event);
    setIsDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingEvent(null);
    setIsDialogOpen(true);
  }
  
  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
        setEditingEvent(null);
    }
    setIsDialogOpen(isOpen);
  }
  
  return (
    <div className="flex flex-col gap-8">
      <AddEventDialog 
        isOpen={isDialogOpen}
        onOpenChange={handleDialogChange}
        eventToEdit={editingEvent}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <div className="flex items-center gap-2">
          {canAddEvents && (
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Aggiungi Impegno
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {selectedGroup === 'tutti' ? 'Tutti i gruppi' : groups?.find(g => g.id === selectedGroup)?.name}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
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
                <SelectTrigger className="w-[180px]">
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
        <Card>
            <CardContent className="p-0">
            <Calendar
                mode="single"
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                locale={it}
                className="p-0"
                classNames={{
                    month: 'w-full space-y-0',
                    table: 'w-full border-collapse',
                    head_row: 'flex w-full border-b',
                    head_cell: 'flex-1 text-muted-foreground font-normal text-sm p-2 text-center',
                    row: 'flex w-full border-b',
                    cell: 'flex-1 h-32 border-r last:border-r-0 relative p-0',
                    day: 'w-full h-full p-0',
                    day_selected: 'bg-accent/50 text-foreground',
                    day_today: 'bg-accent text-accent-foreground',
                    day_outside: '', // Handled by custom Day component
                    day_hidden: 'invisible',
                    caption_label: "text-lg font-medium",
                    caption: "p-4 flex justify-center relative items-center",
                }}
                components={{
                    Day: (props) => <DayWithEvents {...props} events={filteredEvents || []} onEventClick={handleEditEvent} />
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
    </div>
  );
}
