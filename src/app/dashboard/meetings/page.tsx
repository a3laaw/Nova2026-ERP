'use client';

import { useLanguage } from '@/context/language-context';
import { MeetingRoomsView } from '@/components/meetings/meeting-rooms-view';
import { Landmark, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MeetingHallsPage() {
  const { lang, dir, t } = useLanguage();
  const isRtl = lang === 'ar';

  return (
    <div className="space-y-4 animate-in fade-in duration-500 print:space-y-1 w-full" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:mb-0 text-start">
        <div className="text-start">
           <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3 text-slate-900">
             <Landmark className="h-6 w-6 text-primary" />
             {isRtl ? 'رادار حجز القاعات' : 'Meeting Halls Radar'}
           </h1>
           <p className="text-muted-foreground text-xs font-medium opacity-80 print:hidden">
              {isRtl ? 'تنظيم إشغال قاعات الاجتماعات والورش الفنية.' : 'Organize meeting rooms and workshops.'}
           </p>
        </div>
        
        <Button 
          onClick={() => window.print()} 
          variant="outline" 
          size="sm"
          className="h-9 px-4 rounded-md border-slate-200 font-bold gap-2 bg-white shadow-sm hover:bg-slate-50 print:hidden"
        >
          <Printer className="h-3.5 w-3.5 text-primary" />
          {isRtl ? 'طباعة تقرير الإشغال' : 'Print Occupancy'}
        </Button>
      </div>

      <MeetingRoomsView />
    </div>
  );
}
