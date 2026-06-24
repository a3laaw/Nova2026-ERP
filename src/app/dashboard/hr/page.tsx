'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCircle, FileText, ShieldAlert, Sparkles, 
  Users, Calendar, UserPlus, ArrowUpRight, Clock,
  FileSpreadsheet, Calculator, ShieldCheck, BarChart3,
  AlertTriangle, History, ExternalLink
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthContext } from '@/context/auth-context';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { LeavesManager } from './leaves-manager';
import { Employee } from '@/types/hr';
import { cn } from '@/lib/utils';
import { format, addDays, isBefore, parseISO } from 'date-fns';

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
  const canImportAttendance = check('hr', 'create').can && check('hr', 'create').scope === 'all';
  const canSeeCompliance = check('hr', 'edit').can && check('hr', 'edit').scope !== 'own';
  const hrView = check('hr', 'view');

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
    }).sort((a, b) => (a.residencyExpiry || '').localeCompare(b.residencyExpiry || ''));
  }, [employees]);

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <UserCircle className="h-10 w-10 text-primary" />
            {t('hr')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'مركز إدارة القوى العاملة والامتثال التشغيلي' : 'Workforce and compliance management hub'}
          </p>
        </div>
        
        <div className="flex gap-4">
           {canImportAttendance && (
             <Button 
               variant="outline"
               onClick={() => router.push('/dashboard/hr/attendance/import')}
               className="border-2 rounded-2xl px-6 py-7 text-lg font-bold gap-2 hover:bg-slate-50 transition-all"
             >
               <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
               {isRtl ? 'استيراد البصمة' : 'Import Attendance'}
             </Button>
           )}

           {canSeePayroll && (
             <Button 
               onClick={() => router.push('/dashboard/hr/payroll')}
               className="bg-emerald-600 text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-emerald-100 hover:scale-[1.02] transition-transform"
             >
               <Calculator className="me-2 h-6 w-6" />
               {isRtl ? 'الرواتب' : 'Payroll'}
             </Button>
           )}

           {canHire && (
             <Button 
               onClick={() => router.push('/dashboard/hr/employees/new')}
               className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
             >
               <UserPlus className="me-2 h-6 w-6" />
               {isRtl ? 'توظيف جديد' : 'New Hire'}
             </Button>
           )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="flex w-fit md:grid md:w-[800px] grid-cols-4 h-14 bg-white border-2 border-slate-100 rounded-2xl p-1 mb-8 shadow-sm gap-1">
            <TabsTrigger value="overview" className="rounded-xl font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-6">
              <Sparkles className="h-4 w-4" /> {isRtl ? 'نظرة عامة' : 'Overview'}
            </TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-xl font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-6">
              <Calendar className="h-4 w-4" /> {isRtl ? 'الإجازات' : 'Leaves'}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="rounded-xl font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-6">
              <Clock className="h-4 w-4" /> {isRtl ? 'الاستئذانات' : 'Permissions'}
            </TabsTrigger>
            {canSeeCompliance && (
              <TabsTrigger value="compliance" className="rounded-xl font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all px-6">
                <ShieldAlert className="h-4 w-4" /> {isRtl ? 'الامتثال' : 'Compliance'}
                {expiringDocs.length > 0 && <span className="h-2 w-2 rounded-full bg-rose-500 ml-1 animate-pulse" />}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {globalUser?.employeeId && (
                <Card 
                  onClick={() => router.push(`/dashboard/hr/reports/dossier/${globalUser.employeeId}`)}
                  className="border-0 shadow-lg hover:shadow-2xl transition-all cursor-pointer rounded-[2.5rem] bg-white group overflow-hidden border-b-8 border-primary"
                >
                   <CardHeader className="p-8 pb-4 text-start">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                         <ShieldCheck className="h-7 w-7" />
                      </div>
                      <CardTitle className="text-xl font-black text-slate-900">{isRtl ? 'ملفي الوظيفي الشامل' : 'My Full Dossier'}</CardTitle>
                      <CardDescription className="font-bold text-slate-400">
                         {isRtl ? 'عرض رصيد الإجازات، الرواتب، والعهد.' : 'View leave balance, payroll, and assets.'}
                      </CardDescription>
                   </CardHeader>
                   <CardContent className="p-8 pt-0 text-start">
                      <div className="flex items-center gap-2 text-primary font-black text-xs">
                         {isRtl ? 'فتح مركز التقارير الشخصي' : 'Open My Reports'}
                         <ArrowUpRight className="h-4 w-4" />
                      </div>
                   </CardContent>
                </Card>
              )}

              {hrView.scope !== 'own' && (
                <Card 
                  onClick={() => router.push('/dashboard/hr/employees')}
                  className="border-0 shadow-lg hover:shadow-2xl transition-all cursor-pointer rounded-[2.5rem] bg-white group overflow-hidden"
                >
                   <CardHeader className="p-8 pb-4 text-start">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                         <Users className="h-7 w-7" />
                      </div>
                      <CardTitle className="text-xl font-black">{isRtl ? 'سجل الموظفين' : 'Employees List'}</CardTitle>
                      <CardDescription className="font-bold">إدارة الملفات، الرواتب، وسجل التدقيق.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-8 pt-0 text-start">
                      <div className="flex items-center gap-2 text-primary font-black text-xs">
                         {isRtl ? 'عرض كافة الموظفين' : 'View All Employees'}
                         <ArrowUpRight className="h-4 w-4" />
                      </div>
                   </CardContent>
                </Card>
              )}

              <Card 
                onClick={() => setActiveTab('leaves')}
                className="border-0 shadow-lg hover:shadow-2xl transition-all cursor-pointer rounded-[2.5rem] bg-white group overflow-hidden"
              >
                 <CardHeader className="p-8 pb-4 text-start">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                       <Calendar className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-xl font-black">{isRtl ? 'طلبات الإجازات' : 'Leave Tracking'}</CardTitle>
                    <CardDescription className="font-bold">متابعة الغيابات وأرصدة الإجازات السنوية.</CardDescription>
                 </CardHeader>
                 <CardContent className="p-8 pt-0 text-start">
                    <div className="flex items-center gap-2 text-blue-600 font-black text-xs">
                       {isRtl ? 'إدارة الإجازات' : 'Manage Leaves'}
                       <ArrowUpRight className="h-4 w-4" />
                    </div>
                 </CardContent>
              </Card>

              {canSeePayroll && (
                <Card 
                  onClick={() => router.push('/dashboard/hr/payroll')}
                  className="border-0 shadow-lg hover:shadow-2xl transition-all cursor-pointer rounded-[2.5rem] bg-white group overflow-hidden"
                >
                   <CardHeader className="p-8 pb-4 text-start">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                         <Calculator className="h-7 w-7" />
                      </div>
                      <CardTitle className="text-xl font-black">{isRtl ? 'كشوف الرواتب' : 'Payroll Center'}</CardTitle>
                      <CardDescription className="font-bold">حساب الرواتب والخصومات الميدانية.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-8 pt-0 text-start">
                    <div className="flex items-center gap-2 text-amber-600 font-black text-xs">
                       {isRtl ? 'إدارة الرواتب' : 'Manage Payroll'}
                       <ArrowUpRight className="h-4 w-4" />
                    </div>
                 </CardContent>
              </Card>
           </div>

           {canSeeCompliance && expiringDocs.length > 0 && (
             <Card className="border-2 border-rose-100 bg-rose-50/30 rounded-[2.5rem] overflow-hidden animate-in slide-in-from-bottom-4">
                <CardHeader className="p-8 border-b border-rose-100 text-start flex flex-row items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><AlertTriangle className="h-6 w-6" /></div>
                      <div>
                         <CardTitle className="text-lg font-black text-rose-900">{isRtl ? 'تنبيهات انتهاء الوثائق (30 يوم)' : 'Document Expiry Radar'}</CardTitle>
                         <CardDescription className="font-bold text-rose-600/70">{isRtl ? 'يوجد موظفين شارفت وثائقهم القانونية على الانتهاء.' : 'Employees with upcoming residency/ID expiries.'}</CardDescription>
                      </div>
                   </div>
                   <Badge className="bg-rose-500 text-white font-black">{expiringDocs.length}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="divide-y divide-rose-100">
                      {expiringDocs.map(emp => (
                        <div key={emp.id} className="p-6 flex items-center justify-between hover:bg-rose-100/30 transition-colors">
                           <div className="flex items-center gap-4 text-start">
                              <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center font-black text-rose-400 text-xs shadow-sm">
                                 {emp.employeeNumber}
                              </div>
                              <div>
                                 <p className="font-black text-slate-800 text-sm">{emp.fullName}</p>
                                 <p className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1">
                                    <ShieldAlert className="h-3 w-3" /> {isRtl ? 'انتهاء الإقامة:' : 'Residency Expiry:'} {emp.residencyExpiry}
                                 </p>
                              </div>
                           </div>
                           <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}
                            className="rounded-xl hover:bg-rose-100 text-rose-600 font-bold text-xs"
                           >
                              {isRtl ? 'تحديث الملف' : 'Update'} <ExternalLink className="ms-2 h-3 w-3" />
                           </Button>
                        </div>
                      ))}
                   </div>
                </CardContent>
             </Card>
           )}
        </TabsContent>

        <TabsContent value="leaves" className="animate-in fade-in duration-500">
          <LeavesManager />
        </TabsContent>

        <TabsContent value="permissions" className="animate-in fade-in duration-500">
          <div className="py-10 text-center">
             <Button onClick={() => router.push('/dashboard/hr/permissions')} variant="outline" className="rounded-xl font-bold">
                انتقل لسجل الاستئذانات الكامل <ArrowUpRight className="ms-2 h-4 w-4" />
             </Button>
          </div>
        </TabsContent>

        {canSeeCompliance && (
          <TabsContent value="compliance">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white lg:col-span-1 overflow-hidden ring-1 ring-black/5">
                <CardHeader className="text-start bg-slate-50 border-b p-8">
                  <CardTitle className="text-lg font-black">{t('docAnalysis')}</CardTitle>
                  <CardDescription className="font-bold">{isRtl ? 'تحليل عقود العمل والهويات آلياً' : 'Automated analysis for contracts and IDs'}</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6 text-start">
                  <div className="border-4 border-dashed border-muted rounded-[2rem] p-12 text-center bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer group">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto group-hover:scale-110 transition-transform mb-4" />
                    <p className="text-base font-black text-slate-700">{t('uploadDoc')}</p>
                  </div>
                  <Button className="w-full bg-primary text-white font-black py-8 rounded-2xl shadow-xl shadow-primary/20 text-lg hover:scale-[1.02] transition-transform">
                    <Sparkles className="me-3 h-6 w-6" /> {t('analyzeNow')}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white lg:col-span-2 overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="p-8 border-b bg-slate-50/50">
                    <CardTitle className="text-lg font-black flex items-center gap-3">
                       <ShieldCheck className="h-6 w-6 text-emerald-600" />
                       {isRtl ? 'تقرير الامتثال والوثائق' : 'Compliance & Docs Audit'}
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    {expiringDocs.length === 0 ? (
                      <div className="py-32 text-center text-muted-foreground italic font-bold">
                        <CheckCircle2 className="h-20 w-20 mx-auto text-emerald-100 mb-4" />
                        {isRtl ? 'كافة وثائق الموظفين سليمة ومحدثة.' : 'All employee documents are valid and up to date.'}
                      </div>
                    ) : (
                       <div className="divide-y">
                          {expiringDocs.map(emp => (
                             <div key={emp.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-all">
                                <div className="text-start">
                                   <p className="font-black text-slate-800">{emp.fullName}</p>
                                   <div className="flex gap-4 mt-1">
                                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                                         {isRtl ? 'انتهاء إقامة:' : 'Residency:'} {emp.residencyExpiry}
                                      </span>
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{emp.jobTitle}</span>
                                   </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)} className="rounded-xl">
                                   {isRtl ? 'تجديد' : 'Renew'}
                                </Button>
                             </div>
                          ))}
                       </div>
                    )}
                 </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
