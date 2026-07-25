'use client';

import { useLanguage } from '@/context/language-context';
import { ConstructionBookingsView } from '@/components/construction/construction-bookings-view';
import { Hammer, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * @fileOverview صفحة رادار العمليات الميدانية (Construction Operations Radar).
 * مخصصة لإدارة أطقم الميدان ومهندسي الموقع بناءً على توقيتات "ساعات العمل الميدانية".
 */
export default function ConstructionBookingsPage() {
  const { lang, dir, t } = useLanguage();
  const isRtl = lang === 'ar';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <Hammer className="h-8 w-8 text-primary" />
             {isRtl ? 'رادار العمليات الميدانية' : 'Field Operations Radar'}
           </h1>
           <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic print:hidden">
              {isRtl ? 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية.' : 'Coordinate site engineers and work crews in construction project sites.'}
           </p>
        </div>
        
        <Button 
          onClick={handlePrint} 
          variant="outline" 
          className="h-12 px-6 rounded-xl border-2 font-black gap-2 bg-white shadow-sm hover:bg-slate-50 print:hidden"
        >
          <Printer className="h-5 w-5 text-primary" />
          {isRtl ? 'طباعة الرادار الميداني' : 'Print Field Radar'}
        </Button>
      </div>

      <ConstructionBookingsView />
    </div>
  );
}
