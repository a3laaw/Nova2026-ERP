'use client';

import { useLanguage } from '@/context/language-context';
import { ConstructionBookingsView } from '@/components/construction/construction-bookings-view';
import { Hammer, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ConstructionBookingsPage() {
  const { lang, dir, t } = useLanguage();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:space-y-2 w-full" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4 text-start">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <Hammer className="h-7 w-7" />
          </div>
          <div className="text-start">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{t('construction.radar')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5">{t('construction.radarDesc')}</p>
          </div>
        </div>
        
        <Button 
          onClick={() => window.print()} 
          variant="outline" 
          size="sm"
          className="h-9 px-4 rounded-md border-slate-200 font-bold gap-2 bg-white shadow-sm hover:bg-slate-50 print:hidden"
        >
          <Printer className="h-3.5 w-3.5 text-primary" />
          {t('construction.printRadar')}
        </Button>
      </header>

      <ConstructionBookingsView />
    </div>
  );
}
