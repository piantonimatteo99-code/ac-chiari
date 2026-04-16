'use client';

import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { it } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DatePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    disabled?: any; // kept for API compatibility
}

/**
 * DatePicker using the native browser date picker via showPicker() API.
 * - Shows a styled button with the Italian-formatted date.
 * - On click: calls input.showPicker() which opens the native date picker
 *   on ALL devices (desktop Chrome/Firefox/Safari + iOS/Android).
 * - No Popover = no Dialog focus-trap conflicts.
 */
export function DatePicker({ date, setDate, disabled }: DatePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Convert Date → "yyyy-MM-dd" string for the hidden input value
  const inputValue = date instanceof Date && isValid(date)
    ? format(date, 'yyyy-MM-dd')
    : '';

  // Display label in Italian long format
  const displayLabel = date instanceof Date && isValid(date)
    ? format(date, 'PPP', { locale: it })
    : 'Scegli una data';

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    try {
      // showPicker() is the programmatic API to open the native date picker.
      // Supported: Chrome 99+, Firefox 101+, Safari 16+
      (input as any).showPicker?.();
    } catch {
      // Fallback: direct click (works on most browsers)
      input.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setDate(undefined);
      return;
    }
    // parse "yyyy-MM-dd" → local midnight Date
    const parsed = parse(val, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) {
      setDate(parsed);
    }
  };

  return (
    <div className="relative w-full">
      {/* Styled button — shows Italian formatted date */}
      <Button
        type="button"
        variant="outline"
        onClick={handleButtonClick}
        className={cn(
          'w-full justify-start text-left font-normal',
          !date && 'text-muted-foreground'
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {displayLabel}
      </Button>

      {/* Hidden native date input — receives value and change events */}
      <input
        ref={inputRef}
        type="date"
        value={inputValue}
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </div>
  );
}
