
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  UserCircle, Calculator, UserPlus, 
  Users, Clock, ShieldCheck, TrendingUp,
  Loader2, Plane, LayoutGrid,
  FileSpreadsheet, ArrowRight, Scale, BarChart3,
  History, Wallet, Landmark, Sparkles, Upload
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthContext } from '@/context/auth-context';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { LeavesManager } from './leaves-manager';
import { Employee } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HRDashboard() {
  const { t, lang, dir, isRtl, tSafe } = useLanguage();
  const router = useRouter();
  const { check, isAdmin } = usePermissions();
  const { globalUser } = useAuthContext();
  const db = useFirestore();

  const companyId = globalUser?.companyId;
  const canHire = check('hr', 'create').can && check('hr', 'create').scope !== 'own';
  const canSeePayroll = check('hr', 'approve').can;

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId))) : null, [db, companyId]);
  const { data: employees, loading: empsLoading } = useCollection<Employee>(empsQuery);

  const ModuleCard = ({ title, desc, icon: Icon, path, color, badge, primary = false }: any) => (
    <Card 
      onClick={() => router.push(path)}
      className={cn(
        "border-0 shadow-xl rounded-[2.5rem] bg-white group hover:shadow-2xl transition-all cursor-pointer overflow-hidden border-b-8",
        primary ? "border-b-primary" : "border-b-slate-100"
      )}
    >
      <CardHeader className="p-8 pb-4 text-start">
         <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-lg bg-slate-50", color)}>
            <Icon className="h-7 w-7" />
         </div>
         <div className="flex justify-between items-start">
            <CardTitle className="text-xl font-black font-headline text-slate-900 leading-tight">{title}</CardTitle>
            {badge && <Badge className="bg-primary/10 text-primary border-0 font-black text-[8px] h-5 px-2">{badge}</Badge>}
         </div>
         <CardDescription className="text-xs font-bold leading-relaxed mt-3 h-10 overflow-hidden">
            {desc}
         </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-0 text-start">
         <div className={cn("flex items-center gap-2 font-black text-[10px] uppercase transition-all mt-4", color)}>
            {tSafe('common.viewall', 'إدارة القسم', 'Manage Module')}
            <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
         </div>
      </CardContent>
    </Card>
  );

  if (empsLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 w-full animate-in fade-in" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-8 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-16 w-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/5">
            <UserCircle className="h-10 w-10" />
          </div>
          <div className="text-start">
            <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight">{t('hr')}</h1>
            <p className="text-sm font-bold text-muted-foreground italic mt-0.5 text-start">{t('hr.description')}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <Button onClick={() => router.push('/dashboard/hr/attendance/import')} variant="outline" className="h-14 font-black px-6 rounded-2xl border-2 gap-2 bg-white hover:bg-slate-50 transition-all">
              <Upload className="h-5 w-5 text-primary" /> {isRtl ? 'مزامنة البصمة' : 'Sync Attendance'}
           </Button>
           {canHire && (
              <Button onClick={() => router.push('/dashboard/hr/employees/new')} className="h-14 font-black px-8 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-white border-b-8 border-orange-700 hover:scale-[1.02] transition-all gap-3">
                <UserPlus className="h-6 w-6" /> {tSafe('hr.hire', 'تعيين كفاءة جديدة', 'Hire Talent')}
              </Button>
           )}
        </div>
      </header>

      <Tabs defaultValue="overview" className="w-full">
         <TabsList className="bg-white border-2 border-slate-100 p-1 rounded-2xl h-14 mb-8 gap-1">
            <TabsTrigger value="overview" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white">{isRtl ? 'نظرة عامة' : 'Overview'}</TabsTrigger>
            <TabsTrigger value="ops" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white">{isRtl ? 'العمليات الميدانية' : 'Field Operations'}</TabsTrigger>
            {canSeePayroll && <TabsTrigger value="payroll" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white">{t('payroll')}</TabsTrigger>}
         </TabsList>

         <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               <ModuleCard 
                  title={tSafe('staffRecords', 'سجلات الموظفين', 'Staff Master')}
                  desc={isRtl ? "إدارة ملفات الموظفين، الوظائف، والبيانات القانونية والبنكية." : "Manage employee profiles, jobs, legal and bank data."}
                  icon={Users}
                  color="text-blue-600"
                  path="/dashboard/hr/employees"
                  badge={employees?.length}
               />
               <ModuleCard 
                  title={tSafe('leaverequests', 'رادار الإجازات', 'Leave Radar')}
                  desc={isRtl ? "تتبع الإجازات، تسجيل المغادرة والعودة، ومطابقة الأرصدة." : "Track leaves, record departure/return, and balance matching."}
                  icon={Plane}
                  color="text-orange-600"
                  path="/dashboard/hr/leaves"
                  primary={true}
               />
               <ModuleCard 
                  title={tSafe('hr.reports', 'تقارير الموارد البشرية', 'HR Analytics')}
                  desc={isRtl ? "تحليل الانضباط، سجلات التدقيق، والدوسيه الشامل للموظف." : "Discipline analysis, audit trails, and employee dossier."}
                  icon={BarChart3}
                  color="text-indigo-600"
                  path="/dashboard/hr/reports"
               />
               <ModuleCard 
                  title={tSafe('hr.gratuity.calculatorTitle', 'مستحقات نهاية الخدمة', 'End of Service')}
                  desc={isRtl ? "حاسبة التسوية النهائية والامتثال لقانون العمل الكويتي." : "Final settlement calculator and Kuwait Labor Law compliance."}
                  icon={Scale}
                  color="text-rose-600"
                  path="/dashboard/hr/gratuity"
               />
               <ModuleCard 
                  title={tSafe('hr.legal.guide', 'الدليل القانوني', 'Legal Guide')}
                  desc={isRtl ? "مرجع مواد قانون العمل الكويتي المنظمة للرواتب والإجازات." : "Reference for Kuwait Labor Law articles on payroll and leaves."}
                  icon={Landmark}
                  color="text-slate-500"
                  path="/dashboard/hr/legal-guide"
               />
            </div>
         </TabsContent>

         <TabsContent value="ops">
            <div className="space-y-6 text-start">
               <div className="flex items-center gap-4 mb-4">
                  <History className="h-6 w-6 text-primary" />
                  <h3 className="text-2xl font-black font-headline">{tSafe('inline.active.operations', 'العمليات الميدانية الجارية', 'Active Operations')}</h3>
               </div>
               <LeavesManager />
            </div>
         </TabsContent>

         <TabsContent value="payroll">
            <Card className="border-4 border-dashed border-emerald-100 rounded-[2.5rem] bg-white p-12 text-center space-y-6">
               <div className="h-20 w-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><Calculator className="h-10 w-10" /></div>
               <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-400">{isRtl ? 'مركز إدارة الرواتب' : 'Payroll Center'}</h3>
                  <Button onClick={() => router.push('/dashboard/hr/payroll')} className="rounded-xl h-10 px-8 font-black gap-2">
                     {isRtl ? 'فتح سجل الرواتب الكامل' : 'Open Payroll Registry'} <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                  </Button>
               </div>
            </Card>
         </TabsContent>
      </Tabs>
    </div>
  );
}
