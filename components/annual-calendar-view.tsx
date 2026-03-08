'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { it } from 'date-fns/locale';
import { format } from 'date-fns';
import { Evento } from '@/components/add-event-dialog';
import { areIntervalsOverlapping, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from './ui/scroll-area';

function AnnualDay({ date, displayMonth, events, onEventClick }: { date: Date, displayMonth: Date, events: Evento[], onEventClick: (event: Evento) => void }) {
    const dayEvents = useMemo(() => {
        return events.filter(event => {
            const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
            const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
            const dayInterval = { start: startOfDay(date), end: endOfDay(date) };
            const eventInterval = { start: startDate, end: endDate };
            return areIntervalsOverlapping(dayInterval, eventInterval);
        });
    }, [date, events]);
    
    const hasEvents = dayEvents.length > 0;
    const isOutside = date.getMonth() !== displayMonth.getMonth();

    if (!hasEvents) {
        return <div className={cn("w-full h-full flex items-center justify-center p-0 font-normal", isOutside && 'opacity-30')}>{date.getDate()}</div>
    }
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <div className={cn("relative w-full h-full flex items-center justify-center p-0 font-normal rounded-md hover:bg-accent cursor-pointer", isOutside && 'opacity-30')}>
                    {date.getDate()}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-0">
                <div className='p-2 text-center text-sm font-semibold border-b'>
                    {format(date, 'PPP', { locale: it })}
                </div>
                <ScrollArea className="max-h-48">
                    <div className='p-2 space-y-1'>
                    {dayEvents.map(event => (
                        <button key={event.id} onClick={() => onEventClick(event)} className="w-full text-left p-1.5 rounded-md hover:bg-accent">
                            <p className="text-xs font-semibold">{event.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                        </button>
                    ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

export function AnnualCalendarView({ events, onEventClick }: { events: Evento[], onEventClick: (event: Evento) => void }) {
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const yearDate = useMemo(() => new Date(currentYear, 0, 1), [currentYear]);

    return (
        <Card>
            <div className="flex items-center justify-center p-4 gap-4 relative">
                 <Button variant="outline" size="icon" onClick={() => setCurrentYear(y => y - 1)} className='absolute left-4'>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-bold">{currentYear}</h2>
                 <Button variant="outline" size="icon" onClick={() => setCurrentYear(y => y + 1)} className='absolute right-4'>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <CardContent className="p-0">
                <Calendar
                    month={yearDate}
                    numberOfMonths={12}
                    locale={it}
                    className="p-0"
                    classNames={{
                        months: "flex flex-wrap justify-center",
                        month: "w-full md:w-1/2 lg:w-1/3 p-2",
                        table: "w-full border-collapse",
                        head_row: "flex w-full",
                        head_cell: "flex-1 text-muted-foreground font-normal text-xs p-1 text-center",
                        row: "flex w-full mt-1",
                        cell: "flex-1 h-8 w-8 text-center text-sm p-0 relative",
                        day: "w-full h-full",
                        day_today: "bg-accent text-accent-foreground rounded-md",
                        day_outside: 'text-muted-foreground opacity-30',
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-base font-medium",
                        nav: "hidden",
                    }}
                    components={{
                        Day: (props) => <AnnualDay {...props} events={events} onEventClick={onEventClick} />
                    }}
                />
            </CardContent>
        </Card>
    );
}
