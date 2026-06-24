'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCircle, FileSpreadsheet, Calculator, UserPlus, 
  Users, Calendar, Clock, ShieldCheck, TrendingUp,
  AlertTriangle, ArrowUpRight, Sparkles, ShieldAlert
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
import { addDays, isBefore, parseISO } from 'date-fns';

export default function HRDashboard() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const { check } = usePermissions();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState("overview");

  const companyId = globalUser?.companyId;

  const canHire = check('hr', 'create').can && check('hr', 'create').scope !== 'own';
  const canSeePayroll = check('hr', 'approve').can;
  const canSeeCompliance = check('hr', 'edit').can && check('hr', 'edit').scope !== 'own';

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId))) : null, 
  [db, companyId]);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const expiringDocs = useMemo(() => {
    if (!employees) return [];
    const next30Days = addDays(new Date(), 30);
    return employees.filter(emp => {
      if (!emp.residencyExpiry) return false;
      const expiry = parseISO(emp.residencyExpiry);
      return isBefore(expiry, next30Days);
    });
  }, [employees]);

  return (
    <div className="space-y-6" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserCircle className="h-8 w-8 text-[#FFA000]" />
            {t('hr')}
          </h1>
          <p className="text-slate-600 text-sm font-bold opacity-80">{isRtl ? 'إدارة القوى العاملة والامتثال' : 'Workforce & Compliance'}</p>
        </div>
        
        <div className="flex gap-3">
           {canSeePayroll && (
             <Button onClick={() => router.push('/dashboard/hr/payroll')} className="h-11 px-6 shadow-sm">
               <Calculator className="me-2 h-4 w-4" /> {isRtl ? 'الرواتب' : 'Payroll'}
             </Button>
           )}
           {canHire && (
             <Button onClick={() => router.push('/dashboard/hr/employees/new')} className="h-11 px-6 shadow-sm">
               <UserPlus className="me-2 h-4 w-4" /> {isRtl ? 'تعيين' : 'Hire'}
             </Button>
           )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white p-1 rounded-xl shadow-sm border mb-6 inline-flex">
          <TabsList className="bg-transparent h-10 gap-1 p-0">
            <TabsTrigger 
              value="overview" 
              className="rounded-lg font-black text-xs px-6 data-[state=active]:bg-[#F57C00] data-[state=active]:text-white transition-all gap-2"
            >
              {isRtl ? 'نظرة عامة' : 'Overview'}
            </TabsTrigger>
            <TabsTrigger 
              value="leaves" 
              className="rounded-lg font-black text-xs px-6 data-[state=active]:bg-[#F57C00] data-[state=active]:text-white transition-all gap-2"
            >
              {isRtl ? 'الإجازات' : 'Leaves'}
            </TabsTrigger>
            {canSeeCompliance && (
              <TabsTrigger 
                value="compliance" 
                className="rounded-lg font-black text-xs px-6 data-[state=active]:bg-[#F57C00] data-[state=active]:text-white transition-all gap-2"
              >
                {isRtl ? 'الامتثال' : 'Compliance'}
                {expiringDocs.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 ms-1" />}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-none shadow-sm card-shadow bg-white border-b-4 border-b-[#FFA000]">
                <CardHeader className="p-6 text-start">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي الموظفين' : 'Total Employees'}</p>
                  <h3 className="text-3xl font-black text-slate-900">{employees?.length || 0}</h3>
                </CardHeader>
              </Card>
              <Card className="border-none shadow-sm card-shadow bg-white border-b-4 border-b-emerald-500">
                <CardHeader className="p-6 text-start">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{isRtl ? 'نشط ميدانياً' : 'Active Field'}</p>
                  <h3 className="text-3xl font-black text-emerald-600">{employees?.filter(e => e.status === 'active').length || 0}</h3>
                </CardHeader>
              </Card>
              <Card className="border-none shadow-sm card-shadow bg-white border-b-4 border-b-blue-500">
                <CardHeader className="p-6 text-start">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{isRtl ? 'في إجازة' : 'On Leave'}</p>
                  <h3 className="text-3xl font-black text-blue-600">{employees?.filter(e => e.status === 'on-leave').length || 0}</h3>
                </CardHeader>
              </Card>
              <Card className="border-none shadow-sm card-shadow bg-white border-b-4 border-b-amber-500">
                <CardHeader className="p-6 text-start">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{isRtl ? 'معدل الانضباط' : 'Retention'}</p>
                  <h3 className="text-3xl font-black text-amber-600">92%</h3>
                </CardHeader>
              </Card>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm card-shadow bg-white">
                <CardHeader className="p-6 border-b border-slate-50 text-start flex flex-row items-center justify-between">
                   <CardTitle className="text-base font-bold">{isRtl ? 'روابط سريعة' : 'Management Links'}</CardTitle>
                   <Sparkles className="h-4 w-4 text-[#FFA000]" />
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-2 gap-3">
                   <Button variant="outline" onClick={() => router.push('/dashboard/hr/employees')} className="h-12 border-slate-200 font-bold text-slate-700 hover:bg-slate-50 justify-start px-4">
                      <Users className="me-2 h-4 w-4 text-blue-500" /> {isRtl ? 'سجل الموظفين' : 'Staff List'}
                   </Button>
                   <Button variant="outline" onClick={() => router.push('/dashboard/hr/attendance/import')} className="h-12 border-slate-200 font-bold text-slate-700 hover:bg-slate-50 justify-start px-4">
                      <Clock className="me-2 h-4 w-4 text-[#FFA000]" /> {isRtl ? 'استيراد البصمة' : 'Time Logs'}
                   </Button>
                </CardContent>
              </Card>

              {expiringDocs.length > 0 && (
                <Card className="border-none shadow-sm card-shadow bg-rose-50/30 ring-1 ring-rose-100">
                  <CardHeader className="p-6 border-b border-rose-100 text-start flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-bold text-rose-900">{isRtl ? 'تنبيهات الامتثال' : 'Compliance Radar'}</CardTitle>
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                     {expiringDocs.slice(0, 3).map(emp => (
                       <div key={emp.id} className="p-3 bg-white rounded-lg flex items-center justify-between shadow-sm">
                          <span className="text-xs font-bold text-slate-800">{emp.fullName}</span>
                          <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 text-[10px] font-bold">
                            {emp.residencyExpiry}
                          </Badge>
                       </div>
                     ))}
                  </CardContent>
                </Card>
              )}
           </div>
        </TabsContent>

        <TabsContent value="leaves" className="animate-in fade-in duration-300">
          <LeavesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
