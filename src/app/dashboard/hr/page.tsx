
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCircle, FileText, ShieldAlert, Sparkles, 
  Users, Calendar, UserPlus, ArrowUpRight, Clock,
  FileSpreadsheet, Calculator, ShieldCheck, BarChart3
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthContext } from '@/context/auth-context';
import { LeavesManager } from './leaves-manager';

export default function HRDashboard() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const { check } = usePermissions();
  const { globalUser } = useAuthContext();
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState("overview");

  // فحص الصلاحيات للتحكم في عناصر الواجهة
  // تعديل: التوظيف يتطلب صلاحية Create بنطاق أعلى من 'own'
  const canHire = check('hr', 'create').can && check('hr', 'create').scope !== 'own';
  const canSeePayroll = check('hr', 'approve').can;
  const canImportAttendance = check('hr', 'create').can && check('hr', 'create').scope === 'all';
  const canSeeCompliance = check('hr', 'edit').can && check('hr', 'edit').scope !== 'own';
  const hrView = check('hr', 'view');

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
          <TabsList className="flex w-fit md:grid md:w-[800px] grid-cols-4 h-14 bg-muted/30 rounded-2xl p-1 mb-8 shadow-inner gap-1">
            <TabsTrigger value="overview" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <Sparkles className="h-4 w-4" /> {isRtl ? 'نظرة عامة' : 'Overview'}
            </TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <Calendar className="h-4 w-4" /> {isRtl ? 'الإجازات' : 'Leaves'}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <Clock className="h-4 w-4" /> {isRtl ? 'الاستئذانات' : 'Permissions'}
            </TabsTrigger>
            {canSeeCompliance && (
              <TabsTrigger value="compliance" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
                <ShieldAlert className="h-4 w-4" /> {isRtl ? 'الامتثال' : 'Compliance'}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* الموظف يرى ملفه الشامل فوراً كبطاقة رئيسية فخمة */}
              {globalUser?.employeeId && (
                <Card 
                  onClick={() => router.push(`/dashboard/hr/reports/dossier/${globalUser.employeeId}`)}
                  className="border-0 shadow-lg hover:shadow-2xl transition-all cursor-pointer rounded-[2.5rem] bg-slate-900 text-white group overflow-hidden border-b-8 border-primary"
                >
                   <CardHeader className="p-8 pb-4 text-start">
                      <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                         <ShieldCheck className="h-7 w-7" />
                      </div>
                      <CardTitle className="text-xl font-black">{isRtl ? 'ملفي الوظيفي الشامل' : 'My Full Dossier'}</CardTitle>
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
              )}
           </div>

           {/* روابط سريعة للتقارير العالمية (فقط للموظف) */}
           {hrView.scope === 'own' && globalUser?.employeeId && (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                <Card onClick={() => router.push(`/dashboard/hr/reports/attendance/individual/${globalUser.employeeId}`)} className="p-6 cursor-pointer hover:bg-slate-50 transition-all rounded-3xl border-2 border-dashed flex items-center gap-4">
                   <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><BarChart3 className="h-5 w-5" /></div>
                   <div className="text-start"><p className="font-black text-sm">{isRtl ? 'تحليل الانضباط' : 'Discipline Analysis'}</p></div>
                </Card>
                <Card onClick={() => router.push(`/dashboard/hr/reports/leaves/statement/${globalUser.employeeId}`)} className="p-6 cursor-pointer hover:bg-slate-50 transition-all rounded-3xl border-2 border-dashed flex items-center gap-4">
                   <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Calculator className="h-5 w-5" /></div>
                   <div className="text-start"><p className="font-black text-sm">{isRtl ? 'كشف حركة الرصيد' : 'Leave Statement'}</p></div>
                </Card>
                <Card onClick={() => router.push(`/dashboard/hr/reports/payroll/individual/${globalUser.employeeId}`)} className="p-6 cursor-pointer hover:bg-slate-50 transition-all rounded-3xl border-2 border-dashed flex items-center gap-4">
                   <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><FileText className="h-5 w-5" /></div>
                   <div className="text-start"><p className="font-black text-sm">{isRtl ? 'سجل الرواتب' : 'Payroll Ledger'}</p></div>
                </Card>
             </div>
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
                 <CardContent className="py-32 text-center text-muted-foreground italic font-bold">
                    <FileText className="h-20 w-20 mx-auto opacity-10 mb-4" />
                    {isRtl ? 'بانتظار تحليل مستندات الامتثال...' : 'Waiting for compliance document analysis...'}
                 </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
