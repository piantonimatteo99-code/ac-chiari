'use client';

import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { it } from 'date-fns/locale';

import { cn } from '@/lib/utils';

interface DatePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    disabled?: any; // kept for API compatibility, not used with native input
}

/**
 * DatePicker using native <input type="date">.
 * Works perfectly on mobile (opens OS date picker) and desktop.
 * Avoids the Popover-inside-Dialog focus-trap issue on iOS/Android.
 */
export function DatePicker({ date, setDate, disabled }: DatePickerProps) {
  // Convert Date → "yyyy-MM-dd" string for the input value
  const inputValue = date instanceof Date && isValid(date)
    ? format(date, 'yyyy-MM-dd')
    : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setDate(undefined);
      return;
    }
    // parse "yyyy-MM-dd" → Date (local midnight)
    const parsed = parse(val, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) {
      setDate(parsed);
    }
  };

  // Display label in Italian format
  const displayLabel = date instanceof Date && isValid(date)
    ? format(date, 'PPP', { locale: it })
    : 'Scegli una data';

  return (
    <div className="relative w-full">
      {/* Visible styled button */}
      <div
        className={cn(
          'flex items-center gap-2 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
          'text-foreground cursor-pointer hover:border-ring focus-within:ring-1 focus-within:ring-ring',
          !date && 'text-muted-foreground'
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{displayLabel}</span>
      </div>

      {/* Native date input overlaid, invisible but fully interactive */}
      <input
        type="date"
        value={inputValue}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ colorScheme: 'normal' }}
      />
    </div>
  );
}
