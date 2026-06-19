'use client';

import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Filter, RefreshCw, Printer } from "lucide-react";
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { useLanguage } from '@/context/language-context';

interface Props {
  onFilter: (filters: any) => void;
  showDateRange?: boolean;
}

export function ReportFilters({ onFilter, showDateRange = true }: Props) {
  const { t, lang, dir } = useLanguage();
  const [dates, setDates] = useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const handleApply = () => {
    onFilter(dates);
  };

  return (
    <Card className="border-0 shadow-md rounded-2xl bg-white p-6 overflow-visible ring-1 ring-black/5">
      <div className="flex flex-col md:flex-row items-end gap-6">
        {showDateRange && (
          <>
            <div className="space-y-2 flex-1 text-start">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('periodStart')}</Label>
              <SmartDateInput value={dates.start} onChange={v => setDates({...dates, start: v})} />
            </div>
            <div className="space-y-2 flex-1 text-start">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('periodEnd')}</Label>
              <SmartDateInput value={dates.end} onChange={v => setDates({...dates, end: v})} />
            </div>
          </>
        )}
        
        <div className="flex gap-3">
           <Button 
             onClick={handleApply}
             className="h-12 rounded-xl bg-primary text-white font-bold px-6 shadow-lg shadow-primary/20"
           >
              <Filter className="me-2 h-4 w-4" /> {lang === 'ar' ? 'تحديث التقرير' : 'Apply Filters'}
           </Button>
           <Button 
             variant="outline"
             onClick={() => window.print()}
             className="h-12 rounded-xl border-2 font-bold px-4"
           >
              <Printer className="h-4 w-4" />
           </Button>
        </div>
      </div>
    </Card>
  );
}
