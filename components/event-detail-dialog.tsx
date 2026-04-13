'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarDays, Clock, Users, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface EventDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    id: string;
    title: string;
    description?: string;
    startDate: any;
    endDate: any;
    allDay: boolean;
    groupIds?: string[];
    isGoogleCalendar?: boolean;
  } | null;
  /** Optional: function to resolve groupId -> group name */
  getGroupName?: (id: string) => string | undefined;
}

function toDate(v: any): Date {
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  return new Date(v);
}

export function EventDetailDialog({ isOpen, onOpenChange, event, getGroupName }: EventDetailDialogProps) {
  if (!event) return null;

  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  const isGcal = event.isGoogleCalendar;

  const dateStr = event.allDay
    ? format(start, 'EEEE d MMMM yyyy', { locale: it })
    : `${format(start, 'EEEE d MMMM yyyy', { locale: it })}`;

  const timeStr = event.allDay
    ? 'Tutto il giorno'
    : `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
        {/* Colored top bar */}
        <div className={cn('h-1.5 w-full', isGcal ? 'bg-emerald-500' : 'bg-primary')} />

        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-lg leading-snug">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-3">
          {/* Date */}
          <div className="flex items-start gap-3 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <span className="capitalize">{dateStr}</span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-3 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{timeStr}</span>
          </div>

          {/* Groups (if available) */}
          {event.groupIds && event.groupIds.length > 0 && getGroupName && (
            <div className="flex items-start gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground">
                {event.groupIds.map(id => getGroupName(id) ?? id).join(', ')}
              </span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3 text-sm">
              <AlignLeft className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
