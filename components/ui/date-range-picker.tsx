"use client"

import * as React from "react"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { DateRange, DayPickerBase, DayPickerRangeProps, DayPickerSingleProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
    date: DateRange | undefined;
    onDateChange: (date: DateRange | undefined) => void;
    disabled?: DayPickerBase['disabled'];
}

export function DateRangePicker({
  className,
  date,
  onDateChange,
  disabled
}: DateRangePickerProps) {

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal relative",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y", { locale: it })} -{" "}
                  {format(date.to, "LLL dd, y", { locale: it })}
                </>
              ) : (
                format(date.from, "LLL dd, y", { locale: it })
              )
            ) : (
              <span>Scegli un periodo</span>
            )}
             {date && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDateChange(undefined);
                    }}
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            locale={it}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
