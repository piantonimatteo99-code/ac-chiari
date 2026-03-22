'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from 'lucide-react';
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
    differenceInMinutes,
    startOfMonth,
    endOfMonth,
    addMonths,
    subMonths,
    isToday,
    isSameMonth
} from 'date-fns';
import { Evento } from '@/components/add-event-dialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const HOUR_HEIGHT = 50; 
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
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    // --- WEEK VIEW LOGIC ---
    const week = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1, locale: it });
        const end = endOfWeek(currentDate, { weekStartsOn: 1, locale: it });
        return { start, end, days: eachDayOfInterval({ start, end }) };
    }, [currentDate]);

    const { allDayEventsByDay, timedEventsByDay } = useMemo(() => {
        const allDayMap = new Map<string, Evento[]>();
        const timedMap = new Map<string, EventWithLayout[]>();

        if (viewMode !== 'week') return { allDayEventsByDay: allDayMap, timedEventsByDay: timedMap };

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

                    return { ...event, start, end, layout: { top, height, left: 0, width: 100, zIndex: startMinutes } };
                })
                .sort((a, b) => a.start.getTime() - b.start.getTime() || (b.end.getTime() - a.end.getTime()));

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
    }, [week.days, events, viewMode]);


    // --- MONTH VIEW LOGIC ---
    const month = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1, locale: it });
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1, locale: it });
        return { start, end, days: eachDayOfInterval({ start, end }) };
    }, [currentDate]);

    const monthEventsByDay = useMemo(() => {
        const map = new Map<string, Evento[]>();
        if (viewMode !== 'month') return map;

        month.days.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayEvents = events.filter(event => {
                const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
                return areIntervalsOverlapping({ start: startOfDay(day), end: endOfDay(day) }, { start: startDate, end: endDate });
            }).sort((a, b) => {
                if (a.allDay && !b.allDay) return -1;
                if (!a.allDay && b.allDay) return 1;
                const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
                const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
                return dateA.getTime() - dateB.getTime();
            });
            map.set(dayKey, dayEvents);
        });
        return map;
    }, [month.days, events, viewMode]);


    // --- NAV HANDLERS ---
    const handlePrev = () => {
        setCurrentDate(prev => viewMode === 'week' ? addDays(prev, -7) : subMonths(prev, 1));
    };

    const handleNext = () => {
        setCurrentDate(prev => viewMode === 'week' ? addDays(prev, 7) : addMonths(prev, 1));
    };
    const handleToday = () => {
        setCurrentDate(new Date());
    }

    const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    return (
        <Card className="flex flex-col h-full bg-background border-border">
            {/* Header Toolbar */}
            <CardHeader className="flex flex-col sm:flex-row items-center justify-between p-4 border-b shrink-0 gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleToday}>
                        Oggi
                    </Button>
                    <div className="flex items-center gap-1 border rounded-md">
                        <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 rounded-none rounded-l-md">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-semibold w-32 md:w-48 text-center truncate">
                            {viewMode === 'week' 
                                ? `${format(week.start, 'd MMM', { locale: it })} - ${format(week.end, 'd MMM yyyy', { locale: it })}`
                                : format(currentDate, 'MMMM yyyy', { locale: it }).replace(/^\w/, c => c.toUpperCase())}
                        </span>
                        <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 rounded-none rounded-r-md">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'month' | 'week')} className="w-full sm:w-auto">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="month" className="text-xs flex items-center gap-2">
                            <CalendarIcon className="h-3 w-3" /> Mese
                        </TabsTrigger>
                        <TabsTrigger value="week" className="text-xs flex items-center gap-2">
                            <List className="h-3 w-3" /> Settimana
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>

            {/* MONTH VIEW */}
            {viewMode === 'month' && (
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Month Header */}
                    <div className="grid grid-cols-7 border-b shrink-0">
                        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d, i) => (
                            <div key={i} className="text-center py-2 text-xs font-semibold text-muted-foreground border-r last:border-r-0">
                                {d}
                            </div>
                        ))}
                    </div>
                    {/* Month Grid */}
                    <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6">
                        {month.days.map((day, i) => {
                            const dayEvents = monthEventsByDay.get(format(day, 'yyyy-MM-dd')) || [];
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const t = isToday(day);
                            
                            return (
                                <div key={i} className={cn(
                                    "border-r border-b p-1 flex flex-col gap-1 overflow-hidden hover:bg-muted/10 transition-colors",
                                    !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                                    i % 7 === 6 && "border-r-0"
                                )}>
                                    <div className="flex justify-between items-center px-1">
                                        <span className={cn(
                                            "text-xs font-medium h-6 w-6 flex items-center justify-center rounded-full",
                                            t && "bg-primary text-primary-foreground"
                                        )}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                    <ScrollArea className="flex-1 px-1 custom-scrollbar">
                                        <div className="space-y-1">
                                            {dayEvents.map(event => (
                                                <button
                                                    key={event.id}
                                                    onClick={() => onEventClick(event)}
                                                    className={cn(
                                                        "w-full text-left px-1.5 py-1 text-[10px] leading-tight rounded-sm truncate transition-colors",
                                                        event.allDay 
                                                            ? "bg-primary text-primary-foreground hover:bg-primary/90 font-medium" 
                                                            : "bg-muted/60 text-foreground hover:bg-muted font-normal border border-border/50"
                                                    )}
                                                    title={event.title}
                                                >
                                                    {!event.allDay && (
                                                        <span className="opacity-60 mr-1">
                                                            {format(event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate), 'HH:mm')}
                                                        </span>
                                                    )}
                                                    {event.title}
                                                </button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* WEEK VIEW (Original structure) */}
            {viewMode === 'week' && (
                <>
                <div className="shrink-0 border-b divide-y">
                     <div className="grid grid-cols-[50px_repeat(7,1fr)]">
                        <div className="text-xs text-muted-foreground p-1 text-center flex items-center justify-center h-10"></div>
                        {week.days.map((day, index) => (
                            <div key={index} className={cn("text-center py-2 border-l", isSameDay(day, new Date()) && "bg-accent text-accent-foreground")}>
                                <p className="text-[10px] font-medium uppercase text-muted-foreground">{format(day, 'EEE', { locale: it })}</p>
                                <p className="text-xl font-bold leading-none mt-1">{format(day, 'd')}</p>
                            </div>
                        ))}
                    </div>
                     <div className="grid grid-cols-[50px_repeat(7,1fr)]">
                        <div className="text-[10px] text-muted-foreground p-1 text-center flex items-center justify-center">Tutto&nbsp;il&nbsp;giorno</div>
                        {week.days.map((day, index) => {
                             const dayKey = format(day, 'yyyy-MM-dd');
                             const dayEvents = allDayEventsByDay.get(dayKey) || [];
                             return (
                                <div key={index} className="p-1 border-l min-h-[34px] space-y-1">
                                    {dayEvents.map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => onEventClick(event)}
                                            className="w-full text-left p-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 truncate font-medium"
                                        >
                                           {event.title}
                                        </button>
                                    ))}
                                </div>
                             )
                        })}
                     </div>
                </div>
                <ScrollArea className="flex-1" style={{ height: '50vh' }}>
                     <div className="grid grid-cols-[50px_repeat(7,1fr)] relative z-0">
                        {/* Hours column */}
                        <div className="relative">
                            {hours.map((hour, index) => (
                                <div key={hour} className="relative text-right pr-2 border-r" style={{ height: `${HOUR_HEIGHT}px` }}>
                                    {index > 0 && <span className="text-[10px] text-muted-foreground relative -top-2">{hour}</span>}
                                </div>
                            ))}
                        </div>
    
                        {/* Day columns */}
                        {week.days.map((day) => {
                            const dayKey = format(day, 'yyyy-MM-dd');
                            const dayEvents = timedEventsByDay.get(dayKey) || [];
    
                            return (
                                <div key={dayKey} className="relative border-l">
                                    {hours.map((hour, index) => (
                                        <div key={hour} className="border-t border-border/50" style={{ height: `${HOUR_HEIGHT}px` }}></div>
                                    ))}
                                    {dayEvents.map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => onEventClick(event)}
                                            className="absolute p-1.5 text-left rounded-md bg-primary/95 text-primary-foreground hover:bg-primary overflow-hidden border border-primary-foreground/20 shadow-sm"
                                            style={{ 
                                                top: `${event.layout.top}px`, 
                                                height: `${event.layout.height}px`,
                                                left: `${event.layout.left}%`,
                                                width: `calc(${event.layout.width}% - 1px)`,
                                                zIndex: event.layout.zIndex,
                                             }}
                                        >
                                            <p className="text-[10px] font-bold leading-tight">{event.title}</p>
                                            <p className="text-[9px] opacity-90 mt-0.5">{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</p>
                                        </button>
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>
                </>
            )}
        </Card>
    );
}
