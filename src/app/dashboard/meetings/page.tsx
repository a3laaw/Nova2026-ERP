'use client';

import { useLanguage } from '@/context/language-context';
import { MeetingRoomsView } from '@/components/meetings/meeting-rooms-view';
import { Landmark, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * @fileOverview صفحة رادار حجز القاعات والاجتماعات (Halls & Meeting Control Radar).
 * مصممة لتنظيم إشغال الموارد اللوجستية وتجنب تداخل المواعيد.
 */
export default function MeetingHallsPage() {
  const { lang, dir } = useLanguage();
  const isRtl = lang === 'ar';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:space-y-2" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:mb-0 text-start">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900 print:text-xl">
             <Landmark className="h-8 w-8 text-primary print:h-5 print:w-5" />
             {isRtl ? 'رادار حجز القاعات' : 'Meeting Halls Radar'}
           </h1>
           <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic print:hidden">
              {isRtl ? 'تنظيم إشغال قاعات الاجتماعات وورش العمل المشتركة.' : 'Organize meeting rooms and shared professional workshops.'}
           </p>
        </div>
        
        <Button 
          onClick={() => window.print()} 
          variant="outline" 
          className="h-12 px-6 rounded-xl border-2 font-black gap-2 bg-white shadow-sm hover:bg-slate-50 print:hidden"
        >
          <Printer className="h-5 w-5 text-primary" />
          {isRtl ? 'طباعة تقرير الإشغال' : 'Print Occupancy'}
        </Button>
      </div>

      <MeetingRoomsView />
    </div>
  );
}
