'use client';

import * as React from 'react';
import { format, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { it } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';

interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  disabled?: any;
}

/**
 * DatePicker using shadcn Calendar rendered inline (no Popover/Portal).
 * Avoids all Dialog focus-trap conflicts on desktop and mobile.
 */
export function DatePicker({ date, setDate, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const displayLabel = date instanceof Date && isValid(date)
    ? format(date, 'PPP', { locale: it })
    : 'Scegli una data';

  // Close when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full justify-start text-left font-normal',
          !date && 'text-muted-foreground'
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {displayLabel}
      </Button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-[9999] bg-popover border rounded-md shadow-md">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => { setDate(d); setOpen(false); }}
            initialFocus
            locale={it}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
