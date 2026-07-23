'use client';

import { useLanguage } from '@/context/language-context';
import { ArchitecturalAppointmentsView } from '@/components/appointments/architectural-appointments-view';
import { CalendarDays } from 'lucide-react';

export default function AppointmentsListPage() {
  const { lang, dir } = useLanguage();
  const isRtl = lang === 'ar';

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="text-start">
         <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
           <CalendarDays className="h-8 w-8 text-primary" />
           {isRtl ? 'رادار المواعيد المعماري' : 'Architectural Radar'}
         </h1>
         <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'جدولة اللقاءات مع العملاء والزيارات الميدانية لقطاع التصميم.' : 'Schedule client meetings and consulting site visits for Design.'}
         </p>
      </div>

      <ArchitecturalAppointmentsView />
    </div>
  );
}
