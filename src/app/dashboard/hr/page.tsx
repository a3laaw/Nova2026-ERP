'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCircle, FileText, ShieldAlert, Sparkles, 
  UploadCloud, Loader2, Users, Search, 
  Calendar, UserPlus, ArrowUpRight
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import { LeavesManager } from './leaves-manager';

export default function HRDashboard() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <UserCircle className="h-10 w-10 text-primary" />
            {t('hr')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'مركز إدارة القوى العاملة والامتثال التشغيلي' : 'Workforce and compliance management hub'}
          </p>
        </div>
        
        <Button 
          onClick={() => router.push('/dashboard/hr/employees/new')}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
        >
          <UserPlus className="me-2 h-6 w-6" />
          {isRtl ? 'توظيف جديد' : 'New Hire'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="flex w-fit md:grid md:w-[600px] grid-cols-3 h-14 bg-muted/30 rounded-2xl p-1 mb-8 shadow-inner gap-1">
            <TabsTrigger value="overview" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <Sparkles className="h-4 w-4" /> {isRtl ? 'نظرة عامة' : 'Overview'}
            </TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <Calendar className="h-4 w-4" /> {isRtl ? 'الإجازات' : 'Leaves'}
            </TabsTrigger>
            <TabsTrigger value="compliance" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all px-6">
              <ShieldAlert className="h-4 w-4" /> {isRtl ? 'الامتثال' : 'Compliance'}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
           </div>
        </TabsContent>

        <TabsContent value="leaves" className="animate-in fade-in duration-500">
          <LeavesManager />
        </TabsContent>

        <TabsContent value="compliance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white lg:col-span-1 overflow-hidden ring-1 ring-black/5">
              <CardHeader className="text-start bg-slate-50 border-b p-8">
                <CardTitle className="text-lg font-black">{t('docAnalysis')}</CardTitle>
                <CardDescription className="font-bold">{isRtl ? 'تحليل عقود العمل والهويات آلياً' : 'Automated analysis for contracts and IDs'}</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start">
                <div className="border-4 border-dashed border-muted rounded-[2rem] p-12 text-center bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer group">
                  <UploadCloud className="h-16 w-16 text-muted-foreground mx-auto group-hover:scale-110 transition-transform mb-4" />
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
      </Tabs>
    </div>
  );
}
