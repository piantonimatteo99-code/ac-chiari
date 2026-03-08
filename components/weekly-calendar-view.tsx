'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { it } from 'date-fns/locale';
import { 
    format, 
    startOfWeek, 
    endOfWeek, 
    addDays, 
    eachDayOfInterval, 
    isSameDay, 
    startOfDay, 
    endOfDay, 
    areIntervalsOverlapping,
    getHours,
    getMinutes,
    differenceInMinutes
} from 'date-fns';
import { Evento } from '@/components/add-event-dialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

const HOUR_HEIGHT = 50; // Height for one hour
const TOTAL_HOURS = 24;

interface EventWithLayout extends Evento {
    layout: {
        top: number;
        height: number;
        left: number;
        width: number;
        zIndex: number;
        col?: number;
        numCols?: number;
    };
    start: Date;
    end: Date;
}

export function WeeklyCalendarView({ events, onEventClick }: { events: Evento[], onEventClick: (event: Evento) => void }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const week = useMemo(() => {
        const start = startOfWeek(currentDate, { locale: it });
        const end = endOfWeek(currentDate, { locale: it });
        return { start, end, days: eachDayOfInterval({ start, end }) };
    }, [currentDate]);

    const handlePrevWeek = () => {
        setCurrentDate(prev => addDays(prev, -7));
    };

    const handleNextWeek = () => {
        setCurrentDate(prev => addDays(prev, 7));
    };
    
    const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    const { allDayEventsByDay, timedEventsByDay } = useMemo(() => {
        const allDayMap = new Map<string, Evento[]>();
        const timedMap = new Map<string, EventWithLayout[]>();

        week.days.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            
            const dayEvents = events.filter(event => {
                const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
                return areIntervalsOverlapping({ start: startOfDay(day), end: endOfDay(day) }, { start: startDate, end: endDate });
            });

            allDayMap.set(dayKey, dayEvents.filter(e => e.allDay).sort((a,b) => a.title.localeCompare(b.title)));
            
            const timedEvents: EventWithLayout[] = dayEvents
                .filter(e => !e.allDay)
                .map(event => {
                    const start = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                    const end = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
                    
                    const eventStartOnDay = isSameDay(start, day) ? start : startOfDay(day);
                    const eventEndOnDay = isSameDay(end, day) ? end : endOfDay(day);

                    const startMinutes = getHours(eventStartOnDay) * 60 + getMinutes(eventStartOnDay);
                    const endMinutes = Math.max(startMinutes + 15, getHours(eventEndOnDay) * 60 + getMinutes(eventEndOnDay));
                    
                    const top = (startMinutes / 60) * HOUR_HEIGHT;
                    const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

                    return {
                        ...event,
                        start,
                        end,
                        layout: { top, height, left: 0, width: 100, zIndex: startMinutes }
                    };
                })
                .sort((a, b) => a.start.getTime() - b.start.getTime() || (b.end.getTime() - a.end.getTime()));

            // Find collision groups
            const collisionGroups: EventWithLayout[][] = [];
            
            const eventsCopy = [...timedEvents];
            while (eventsCopy.length > 0) {
                const currentEvent = eventsCopy.shift()!;
                const group = [currentEvent];
                
                const remainingEvents = [];
                for (const otherEvent of eventsCopy) {
                    if (currentEvent.end > otherEvent.start && currentEvent.start < otherEvent.end) {
                        group.push(otherEvent);
                    } else {
                        remainingEvents.push(otherEvent);
                    }
                }
                collisionGroups.push(group);
                // This is not efficient for multiple overlapping groups, but it's a simple approach for now.
                // A better approach would iterate and assign to groups without modifying the loop array.
            }
            
            const processedEvents = new Set<string>();
            const finalGroups: EventWithLayout[][] = [];

            timedEvents.forEach(event => {
                if (processedEvents.has(event.id)) return;

                const group: EventWithLayout[] = [event];
                processedEvents.add(event.id);

                const queue = [event];
                while(queue.length > 0) {
                    const current = queue.shift()!;
                    timedEvents.forEach(other => {
                        if (processedEvents.has(other.id)) return;
                        if (current.end > other.start && current.start < other.end) {
                            group.push(other);
                            processedEvents.add(other.id);
                            queue.push(other);
                        }
                    });
                }
                finalGroups.push(group);
            });


            finalGroups.forEach(group => {
                group.sort((a, b) => a.start.getTime() - b.start.getTime());
                
                const columns: EventWithLayout[][] = [];
                group.forEach(event => {
                    let placed = false;
                    for (let i = 0; i < columns.length; i++) {
                        const col = columns[i];
                        if (!col.some(e => e.end > event.start && e.start < event.end)) {
                            col.push(event);
                            event.layout.col = i;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        event.layout.col = columns.length;
                        columns.push([event]);
                    }
                });
                
                const numColumns = columns.length;
                group.forEach(event => {
                    event.layout.numCols = numColumns;
                    event.layout.width = 100 / numColumns;
                    event.layout.left = (event.layout.col ?? 0) * event.layout.width;
                    event.layout.zIndex += (event.layout.col ?? 0);
                });
            });


            timedMap.set(dayKey, timedEvents);
        });

        return { allDayEventsByDay: allDayMap, timedEventsByDay: timedMap };
    }, [week.days, events]);


    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-center p-4 gap-4 relative border-b shrink-0">
                 <Button variant="outline" size="icon" onClick={handlePrevWeek} className='absolute left-4'>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-bold">
                    {format(week.start, 'd MMM', { locale: it })} - {format(week.end, 'd MMM yyyy', { locale: it })}
                </h2>
                 <Button variant="outline" size="icon" onClick={handleNextWeek} className='absolute right-4'>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </CardHeader>
            <div className="shrink-0 border-b divide-y">
                 <div className="grid grid-cols-[50px_repeat(7,1fr)]">
                    <div className="text-xs text-muted-foreground p-1 text-center flex items-center justify-center h-10"></div>
                    {week.days.map((day, index) => (
                        <div key={index} className={cn("text-center py-2 border-l", isSameDay(day, new Date()) && "bg-accent text-accent-foreground")}>
                            <p className="text-sm font-medium uppercase text-muted-foreground">{format(day, 'EEE', { locale: it })}</p>
                            <p className="text-2xl font-bold">{format(day, 'd')}</p>
                        </div>
                    ))}
                </div>
                 <div className="grid grid-cols-[50px_repeat(7,1fr)]">
                    <div className="text-xs text-muted-foreground p-1 text-center flex items-center justify-center">Tutto il giorno</div>
                    {week.days.map((day, index) => {
                         const dayKey = format(day, 'yyyy-MM-dd');
                         const dayEvents = allDayEventsByDay.get(dayKey) || [];
                         return (
                            <div key={index} className="p-1 border-l min-h-[34px] space-y-1">
                                {dayEvents.map(event => (
                                    <button
                                        key={event.id}
                                        onClick={() => onEventClick(event)}
                                        className="w-full text-left p-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 truncate"
                                    >
                                       {event.title}
                                    </button>
                                ))}
                            </div>
                         )
                    })}
                 </div>
            </div>
            <ScrollArea className="flex-1" style={{ height: '60vh' }}>
                 <div className="grid grid-cols-[50px_repeat(7,1fr)] relative z-0">
                    {/* Hours column */}
                    <div className="relative">
                        {hours.map((hour, index) => (
                            <div key={hour} className="relative text-right pr-2 border-r" style={{ height: `${HOUR_HEIGHT}px` }}>
                                {index > 0 && <span className="text-xs text-muted-foreground relative -top-2">{hour}</span>}
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {week.days.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const dayEvents = timedEventsByDay.get(dayKey) || [];

                        return (
                            <div key={dayKey} className="relative border-l">
                                {/* Hour lines */}
                                {hours.map((hour, index) => (
                                    <div key={hour} className="border-t" style={{ height: `${HOUR_HEIGHT}px` }}></div>
                                ))}

                                {/* Events */}
                                {dayEvents.map(event => (
                                    <button
                                        key={event.id}
                                        onClick={() => onEventClick(event)}
                                        className="absolute p-1 text-left rounded-md bg-primary/90 text-primary-foreground hover:bg-primary overflow-hidden border border-primary-foreground/20"
                                        style={{ 
                                            top: `${event.layout.top}px`, 
                                            height: `${event.layout.height}px`,
                                            left: `${event.layout.left}%`,
                                            width: `calc(${event.layout.width}% - 2px)`,
                                            zIndex: event.layout.zIndex,
                                         }}
                                    >
                                        <p className="text-xs font-bold leading-tight">{event.title}</p>
                                        <p className="text-xs opacity-80">{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</p>
                                    </button>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </Card>
    );
}
