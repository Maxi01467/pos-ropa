"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRangePickerProps {
    className?: string;
    from: string; // Format YYYY-MM-DD
    to: string;   // Format YYYY-MM-DD
    onChange: (range: { from: string; to: string }) => void;
}

export function DateRangePicker({
    className,
    from,
    to,
    onChange,
}: DateRangePickerProps) {
    const dateRange = React.useMemo<DateRange>(() => {
        return {
            from: from ? new Date(from + "T00:00:00") : undefined,
            to: to ? new Date(to + "T00:00:00") : undefined,
        };
    }, [from, to]);

    const [month, setMonth] = React.useState<Date | undefined>(
        from ? new Date(from + "T00:00:00") : new Date()
    );

    React.useEffect(() => {
        if (from) {
            setMonth(new Date(from + "T00:00:00"));
        }
    }, [from]);

    const handleSelect = (range: DateRange | undefined) => {
        if (!range) return;
        
        const formatKey = (d: Date | undefined) => {
            if (!d) return "";
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        const nextFrom = formatKey(range.from);
        const nextTo = formatKey(range.to || range.from); // If end date is not selected, default to start date
        
        onChange({ from: nextFrom, to: nextTo });
    };

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[260px] justify-start text-left font-normal rounded-xl border border-input/60 bg-background shadow-sm h-9 px-3 text-xs focus:ring-2 focus:ring-ring/20 transition-all hover:bg-stone-50 dark:hover:bg-neutral-900",
                            !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                    {format(dateRange.from, "dd MMM yyyy", { locale: es })} -{" "}
                                    {format(dateRange.to, "dd MMM yyyy", { locale: es })}
                                </>
                            ) : (
                                format(dateRange.from, "dd MMM yyyy", { locale: es })
                            )
                        ) : (
                            <span>Seleccionar fechas</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border border-border bg-popover" align="start">
                    <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={handleSelect as any}
                        numberOfMonths={1}
                        {...({
                            month: month,
                            onMonthChange: setMonth,
                        } as any)}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
