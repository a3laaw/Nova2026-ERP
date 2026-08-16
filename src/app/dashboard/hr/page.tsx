'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCircle, Calculator, UserPlus, 
  Users, Clock, ShieldCheck, TrendingUp,
  ShieldAlert, Loader2, Plane, LayoutGrid,
  FileSpreadsheet, ArrowRight
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

/**
 * @fileOverview لوحة تحكم الموارد البشرية السيادية (Unified HR Dashboard).
 */
export default function HRDashboard() {
  const { t, lang, dir, isRtl } = useLanguage();
  const router = useRouter();
  const { check, isAdmin } = usePermissions();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState("overview");

  const companyId = globalUser?.companyId;
  const hrView = check('hr', 'view');
  const canHire = check('hr', 'create').can && check('hr', 'create').scope !== 'own';
  const canSeePayroll = check('hr', 'approve').can;

  // توجيه الموظف العادي لملفه الشخصي فقط
  useEffect(() => {
    if (hrView.can && hrView.scope === 'own' && globalUser?.employeeId) {
       router.replace(`/dashboard/hr/reports/dossier/${globalUser.employeeId}`);
    }
  }, [hrView, globalUser, router]);

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId))) : null, [db, companyId]);
  const { data: employees, loading: empsLoading } = useCollection<Employee>(empsQuery);

  if (hrView.scope === 'own' || empsLoading) return <div className="h-[60vh] flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 w-full animate-in fade-in" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <UserCircle className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('hr')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">{t('hr.description')}</p>
          </div>
        </div>
        <div className="flex gap-2">
           {canSeePayroll && (
              <Button onClick={() => router.push('/dashboard/hr/payroll/new')} size="sm" className="h-11 font-black px-6 rounded-xl shadow-lg shadow-primary/20 bg-emerald-600 text-white hover:bg-emerald-700 border-b-4 border-emerald-800">
                <Calculator className="me-2 h-4 w-4" /> {isRtl ? 'توليد الرواتب' : 'Generate Payroll'}
              </Button>
           )}
           {canHire && (
              <Button onClick={() => router.push('/dashboard/hr/employees/new')} size="sm" className="h-11 font-black px-6 rounded-xl shadow-lg shadow-primary/20 border-b-4 border-orange-700">
                <UserPlus className="me-2 h-4 w-4" /> {t('hr.hire')}
              </Button>
           )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white p-1.5 rounded-2xl border shadow-sm mb-6 inline-flex overflow-x-auto scrollbar-hide max-w-full">
          <TabsList className="bg-transparent h-12 gap-1 p-0">
            <TabsTrigger value="overview" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full gap-2">
              <LayoutGrid className="h-4 w-4" /> {t('common.overview')}
            </TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full gap-2">
              <Plane className="h-4 w-4" /> {t('leaverequests')}
            </TabsTrigger>
            {canSeePayroll && (
              <TabsTrigger value="payroll_list" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full gap-2">
                <Calculator className="h-4 w-4" /> {t('payroll')}
              </TabsTrigger>
            )}
            <TabsTrigger value="staff" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-full gap-2">
              <Users className="h-4 w-4" /> {t('staffRecords')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="rounded-[2.5rem] shadow-sm border bg-white p-6 text-start flex items-center justify-between group hover:shadow-lg transition-all">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.staffCount')}</p>
                    <h3 className="text-3xl font-black text-slate-900">{employees?.length || 0}</h3>
                 </div>
                 <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="h-6 w-6" />
                 </div>
              </Card>
              
              <Card className="rounded-[2.5rem] shadow-sm border bg-white p-6 text-start flex items-center justify-between group hover:shadow-lg transition-all" onClick={() => router.push('/dashboard/hr/attendance/import')}>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'سجل البصمة (XLSX)' : 'Attendance Sync'}</p>
                    <h3 className="text-sm font-black text-primary uppercase">{isRtl ? 'مزامنة الآن' : 'Sync Now'}</h3>
                 </div>
                 <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform cursor-pointer">
                    <FileSpreadsheet className="h-6 w-6" />
                 </div>
              </Card>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-50/50 p-6 border-b">
                    <CardTitle className="text-lg font-black">{isRtl ? 'إجراءات سريعة' : 'Quick Actions'}</CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-20 rounded-2xl border-2 flex flex-col gap-2 font-black text-xs" onClick={() => router.push('/dashboard/hr/permissions/new')}>
                       <Clock className="h-5 w-5 text-primary" /> {isRtl ? 'طلب استئذان' : 'Request Permission'}
                    </Button>
                    <Button variant="outline" className="h-20 rounded-2xl border-2 flex flex-col gap-2 font-black text-xs" onClick={() => router.push('/dashboard/hr/gratuity-calculator')}>
                       <ShieldCheck className="h-5 w-5 text-emerald-600" /> {isRtl ? 'حاسبة المستحقات' : 'Gratuity Calc'}
                    </Button>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="leaves" className="animate-in fade-in duration-300">
          <LeavesManager />
        </TabsContent>

        <TabsContent value="payroll_list" className="animate-in fade-in duration-300">
           <div className="py-20 text-center flex flex-col items-center gap-6 opacity-40">
              <Calculator className="h-20 w-20 text-slate-200" />
              <div className="space-y-2">
                 <h3 className="text-xl font-black text-slate-400">{isRtl ? 'مركز إدارة الرواتب' : 'Payroll Center'}</h3>
                 <Button onClick={() => router.push('/dashboard/hr/payroll')} className="rounded-xl h-10 px-8 font-black gap-2">
                    {isRtl ? 'فتح سجل الرواتب الكامل' : 'Open Payroll Registry'} <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                 </Button>
              </div>
           </div>
        </TabsContent>

        <TabsContent value="staff" className="animate-in fade-in duration-300">
           <div className="py-20 text-center flex flex-col items-center gap-6 opacity-40">
              <Users className="h-20 w-20 text-slate-200" />
              <div className="space-y-2">
                 <h3 className="text-xl font-black text-slate-400">{isRtl ? 'سجل الموظفين والمهن' : 'Staff Master Registry'}</h3>
                 <Button onClick={() => router.push('/dashboard/hr/employees')} className="rounded-xl h-10 px-8 font-black gap-2">
                    {isRtl ? 'فتح قاعدة بيانات الموظفين' : 'Open Employee Database'} <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                 </Button>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
