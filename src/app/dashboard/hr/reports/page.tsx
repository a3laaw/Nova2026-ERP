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
  const { t, dir } = useLanguage();
  const router = useRouter();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId))) : null, [db, companyId]);
  const { data: employees } = useCollection(empsQuery);

  const reportCards = [
    {
      id: 'dossier',
      title: t('hr.reports.dossier.title'),
      desc: t('hr.reports.dossier.desc'),
      icon: ShieldCheck,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      path: '/dashboard/hr/reports/dossier'
    },
    {
      id: 'attendance',
      title: t('hr.reports.attendance.title'),
      desc: t('hr.reports.attendance.desc'),
      icon: Clock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/dashboard/hr/reports/attendance'
    },
    {
      id: 'payroll',
      title: t('hr.reports.payroll.title'),
      desc: t('hr.reports.payroll.desc'),
      icon: Calculator,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      path: '/dashboard/hr/reports/payroll'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="text-start">
        <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
          <BarChart3 className="h-10 w-10 text-primary" />
          {t('hr.reports.title')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {t('hr.reports.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-6 text-start flex items-center justify-between group hover:shadow-xl transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.stats.totalEmployees')}</p>
            <h3 className="text-4xl font-black font-headline text-slate-900">{employees?.length || 0}</h3>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="h-6 w-6" />
          </div>
        </Card>
        
        <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-6 text-start flex items-center justify-between group hover:shadow-xl transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.stats.activeNow')}</p>
            <h3 className="text-4xl font-black font-headline text-emerald-600">
               {employees?.filter((e: any) => e.status === 'active').length || 0}
            </h3>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <TrendingUp className="h-6 w-6" />
          </div>
        </Card>

        <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-6 text-start flex items-center justify-between group hover:shadow-xl transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.stats.onLeave')}</p>
            <h3 className="text-4xl font-black font-headline text-blue-600">
               {employees?.filter((e: any) => e.status === 'on-leave').length || 0}
            </h3>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarDays className="h-6 w-6" />
          </div>
        </Card>

        <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-6 text-start flex items-center justify-between group hover:shadow-xl transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.stats.retentionRate')}</p>
            <h3 className="text-4xl font-black font-headline text-amber-600">92%</h3>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        {reportCards.map((card) => (
          <Card 
            key={card.id} 
            className="border-0 shadow-xl rounded-[2.5rem] bg-white hover:shadow-2xl transition-all cursor-pointer group overflow-hidden"
            onClick={() => router.push(card.path)}
          >
            <CardHeader className="p-8 pb-4 text-start">
               <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-lg", card.bg, card.color)}>
                  <card.icon className="h-8 w-8" />
               </div>
               <CardTitle className="text-2xl font-black font-headline text-slate-900">{card.title}</CardTitle>
               <CardDescription className="text-base font-bold leading-relaxed mt-4">
                  {card.desc}
               </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 text-start">
               <div className={cn("flex items-center gap-2 font-black text-xs group-hover:gap-4 transition-all", card.color)}>
                  {t('hr.reports.viewDetailed')}
                  <ArrowUpRight className="h-4 w-4" />
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
