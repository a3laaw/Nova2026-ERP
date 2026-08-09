'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BarChart3, Users, CalendarDays, 
  Calculator, ShieldCheck, TrendingUp,
  Clock, ArrowUpRight
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';

export default function HRReportsHub() {
  const { t, dir, isRtl } = useLanguage();
  const router = useRouter();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId))) : null, [db, companyId]);
  const { data: employees } = useCollection(empsQuery);

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <BarChart3 className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('reports.hub.title')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5">{t('reports.hub.description')}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-6 text-start flex items-center justify-between group hover:shadow-xl transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.stats.workforce')}</p>
            <h3 className="text-4xl font-black font-headline text-slate-900">{employees?.length || 0}</h3>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="h-6 w-6" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 text-start">
        {[
          { id: 'dossier', title: 'سجل الموظف الشامل', desc: 'تتبع تاريخي كامل: حضور، إجازات، ورواتب.', icon: ShieldCheck, path: '/dashboard/hr/reports/dossier', color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { id: 'attendance', title: 'تحليل الحضور والغياب', desc: 'تقرير إجمالي التأخير والغياب لفترة محددة.', icon: Clock, path: '/dashboard/hr/reports/attendance', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { id: 'payroll', title: 'كشوف الرواتب الموحدة', desc: 'ملخص مالي للمدفوعات والخصومات الشهرية.', icon: Calculator, path: '/dashboard/hr/reports/payroll', color: 'text-amber-600', bg: 'bg-amber-50' }
        ].map((card) => (
          <Card 
            key={card.id} 
            className="border-0 shadow-xl rounded-[2.5rem] bg-white hover:shadow-2xl transition-all cursor-pointer group overflow-hidden"
            onClick={() => router.push(card.path)}
          >
            <CardHeader className="p-8 pb-4 text-start">
               <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg", card.bg, card.color)}>
                  <card.icon className="h-8 w-8" />
               </div>
               <CardTitle className="text-2xl font-black font-headline text-slate-900">{card.title}</CardTitle>
               <CardDescription className="text-base font-bold leading-relaxed mt-4">{card.desc}</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 text-start">
               <div className={cn("flex items-center gap-2 font-black text-xs transition-all", card.color)}>
                  {t('common.viewall')}
                  <ArrowUpRight className="h-4 w-4" />
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
