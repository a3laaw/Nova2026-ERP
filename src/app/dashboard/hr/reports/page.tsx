'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, FileText, Users, CalendarDays, 
  Calculator, Scale, ArrowUpRight, TrendingUp,
  Clock, ShieldCheck
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';

export default function HRReportsHub() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId))) : null, [db, companyId]);
  const { data: employees } = useCollection(empsQuery);

  const reportCards = [
    {
      id: 'dossier',
      title: isRtl ? 'ملف الموظف الشامل' : 'Employee Dossier',
      desc: isRtl ? 'سجل تاريخي كامل: حضور، إجازات، ورواتب.' : 'Complete historical record: attendance, leaves, and payroll.',
      icon: ShieldCheck,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      path: '/dashboard/hr/reports/dossier'
    },
    {
      id: 'attendance',
      title: isRtl ? 'تحليل الحضور والغياب' : 'Attendance Analysis',
      desc: isRtl ? 'تقرير إجمالي التأخير والغياب لفترة محددة.' : 'Total late minutes and absence summary report.',
      icon: Clock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/dashboard/hr/reports/attendance'
    },
    {
      id: 'payroll',
      title: isRtl ? 'كشوف الرواتب الموحدة' : 'Payroll Summary',
      desc: isRtl ? 'ملخص مالي للمدفوعات والخصومات الشهرية.' : 'Financial summary of monthly payments and deductions.',
      icon: Calculator,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      path: '/dashboard/hr/reports/payroll'
    },
    {
      id: 'leaves',
      title: isRtl ? 'سجل أرصدة الإجازات' : 'Leave Balance Report',
      desc: isRtl ? 'متابعة الأرصدة المتبقية والمستهلكة للموظفين.' : 'Track remaining and consumed leave balances.',
      icon: CalendarDays,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/dashboard/hr/reports/leaves'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="text-start">
        <h1 className="text-4xl font-black font-headline flex items-center gap-3">
          <BarChart3 className="h-10 w-10 text-primary" />
          {isRtl ? 'مركز تقارير HR' : 'HR Analytics Hub'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {isRtl ? 'تحليل القوى العاملة والامتثال التشغيلي' : 'Workforce analysis and operational compliance'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-6 text-start flex items-center justify-between group hover:shadow-xl transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي الموظفين' : 'Total Employees'}</p>
            <h3 className="text-4xl font-black font-headline text-slate-900">{employees?.length || 0}</h3>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="h-6 w-6" />
          </div>
        </Card>
        
        <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-6 text-start flex items-center justify-between group hover:shadow-xl transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'نشط ميدانياً' : 'Active Now'}</p>
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
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'في إجازة' : 'On Leave'}</p>
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
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'معدل التواجد' : 'Retention Rate'}</p>
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
               <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform", card.bg, card.color)}>
                  <card.icon className="h-8 w-8" />
               </div>
               <CardTitle className="text-2xl font-black font-headline">{card.title}</CardTitle>
               <CardDescription className="text-base font-bold leading-relaxed">{card.desc}</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 text-start">
               <div className={cn("flex items-center gap-2 font-black text-xs group-hover:gap-4 transition-all", card.color)}>
                  {isRtl ? 'عرض التقرير المفصل' : 'View Detailed Report'}
                  <ArrowUpRight className="h-4 w-4" />
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
