'use client';

import * as React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage } from '@/context/language-context';

interface SmartDateInputProps {
  value: string; // Expected format: YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
}

export function SmartDateInput({ value, onChange, className }: SmartDateInputProps) {
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';
  
  const [day, setDay] = React.useState('');
  const [month, setMonth] = React.useState('');
  const [year, setYear] = React.useState('');

  const dayRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const yearRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value && value.length === 10) {
      const [vYear, vMonth, vDay] = value.split('-');
      setDay(vDay || '');
      setMonth(vMonth || '');
      setYear(vYear || '');
    } else if (!value) {
      setDay('');
      setMonth('');
      setYear('');
    }
  }, [value]);

  const updateValue = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const dateStr = `${y}-${m}-${d}`;
      const parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (isValid(parsedDate)) {
        onChange(dateStr);
      }
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDay(val);
    if (val.length === 2) monthRef.current?.focus();
    updateValue(val, month, year);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMonth(val);
    if (val.length === 2) yearRef.current?.focus();
    updateValue(day, val, year);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYear(val);
    updateValue(day, month, val);
  };

  const onCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, 'yyyy-MM-dd');
      onChange(formatted);
    }
  };

  return (
    <div className={cn("relative", className)} dir="ltr">
      <div className="flex items-center h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-1 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/5 transition-all shadow-sm">
        
        <div className="flex items-center gap-1 flex-1">
          <input
            ref={dayRef}
            type="text"
            placeholder="dd"
            value={day}
            onChange={handleDayChange}
            className="w-6 bg-transparent text-center font-mono font-bold text-slate-700 placeholder:text-slate-300 outline-none"
          />
          <span className="text-slate-300">--</span>
          <input
            ref={monthRef}
            type="text"
            placeholder="mm"
            value={month}
            onChange={handleMonthChange}
            className="w-6 bg-transparent text-center font-mono font-bold text-slate-700 placeholder:text-slate-300 outline-none"
          />
          <span className="text-slate-300">--</span>
          <input
            ref={yearRef}
            type="text"
            placeholder="yyyy"
            value={year}
            onChange={handleYearChange}
            className="w-10 bg-transparent text-center font-mono font-bold text-slate-700 placeholder:text-slate-300 outline-none"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-primary shrink-0"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-3xl border-0 shadow-2xl" align="end">
            <Calendar
              mode="single"
              selected={value ? new Date(value) : undefined}
              onSelect={onCalendarSelect}
              initialFocus
              locale={isRtl ? ar : enUS}
              className="p-4"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
