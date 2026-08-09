'use client';

import { useLanguage } from '@/context/language-context';
import { ConstructionBookingsView } from '@/components/construction/construction-bookings-view';
import { Hammer, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ConstructionBookingsPage() {
  const { lang, dir, t } = useLanguage();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:space-y-2 w-full" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:mb-0 text-start">
        <div className="text-start">
           <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3 text-slate-900">
             <Hammer className="h-6 w-6 text-primary" />
             {t('construction.radar')}
           </h1>
           <p className="text-muted-foreground text-xs font-medium opacity-80 italic print:hidden">
              {t('construction.radarDesc')}
           </p>
        </div>
        
        <Button 
          onClick={() => window.print()} 
          variant="outline" 
          size="sm"
          className="h-9 px-4 rounded-md font-bold gap-2 bg-white shadow-sm hover:bg-slate-50 print:hidden border-slate-200"
        >
          <Printer className="h-3.5 w-3.5 text-primary" />
          {t('construction.printRadar')}
        </Button>
      </div>

      <ConstructionBookingsView />
    </div>
  );
}
