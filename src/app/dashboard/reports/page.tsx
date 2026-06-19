'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, FileText, Printer, Download, 
  Share2, Calendar, Search, Filter, Loader2,
  HardHat, DollarSign, TrendingUp, CheckCircle2
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useCompanyContext } from '@/context/company-context';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ReportsPage() {
  const { t, lang, dir } = useLanguage();
  const { company } = useCompanyContext();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isRtl = lang === 'ar';

  const handlePrint = () => {
    window.print();
  };

  const sampleProjects = [
    { id: '1', name: 'مصفاة الزور - ميكانيكا', budget: 150000, status: 'active', progress: 65 },
    { id: '2', name: 'فيلا السالمية - تصميم', budget: 45000, status: 'completed', progress: 100 },
    { id: '3', name: 'مركز تجاري - العاصمة', budget: 850000, status: 'on-hold', progress: 12 },
  ];

  if (isPreviewOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 overflow-y-auto">
        <div className="bg-white w-full max-w-4xl min-h-screen shadow-2xl rounded-none p-12 md:p-20 relative animate-in zoom-in-95 duration-300">
          <div className="absolute top-8 start-8 flex gap-3 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(false)} className="rounded-xl border-2">
              إغلاق المعاينة
            </Button>
            <Button onClick={handlePrint} size="sm" className="bg-primary text-white rounded-xl shadow-lg">
              <Printer className="me-2 h-4 w-4" /> طباعة المستند
            </Button>
          </div>

          <PrintWrapper title={isRtl ? "تقرير حالة العمليات" : "Operational Status Report"}>
            <div className="space-y-10">
              <div className="grid grid-cols-3 gap-6">
                <div className="p-6 bg-slate-50 rounded-2xl border text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي الميزانية</p>
                  <p className="text-2xl font-black text-primary">1,045,000</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase">المشاريع النشطة</p>
                  <p className="text-2xl font-black text-slate-800">24</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase">معدل الإنجاز</p>
                  <p className="text-2xl font-black text-emerald-600">84%</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-black border-s-4 border-primary ps-3 uppercase tracking-tight">تفاصيل المشاريع التشغيلية</h3>
                <Table className="border">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-start font-black">اسم المشروع</TableHead>
                      <TableHead className="text-start font-black">الحالة</TableHead>
                      <TableHead className="text-end font-black">الميزانية</TableHead>
                      <TableHead className="text-center font-black">الإنجاز</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleProjects.map((proj) => (
                      <TableRow key={proj.id}>
                        <TableCell className="font-bold text-sm">{proj.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px] font-black uppercase">{proj.status}</Badge></TableCell>
                        <TableCell className="text-end font-mono font-bold">{proj.budget.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-black text-primary">{proj.progress}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-2 gap-12 mt-20">
                <div className="space-y-12">
                   <div className="h-20 w-48 border-b-2 border-slate-300 relative">
                     <span className="absolute -bottom-6 start-0 text-[10px] font-black text-slate-400 uppercase">توقيع المدير المسؤول</span>
                   </div>
                </div>
                <div className="space-y-12 flex flex-col items-end">
                   <div className="h-20 w-48 border-b-2 border-slate-300 relative">
                     <span className="absolute -bottom-6 end-0 text-[10px] font-black text-slate-400 uppercase">الختم الرسمي للمنشأة</span>
                   </div>
                </div>
              </div>
            </div>
          </PrintWrapper>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <BarChart3 className="h-10 w-10 text-primary" />
            {t('reports')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إصدار التقارير التنفيذية والوثائق الرسمية بهوية المنشأة' : 'Generating executive reports and official documents'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden group hover:shadow-2xl transition-all cursor-pointer" onClick={() => setIsPreviewOpen(true)}>
          <div className="h-3 bg-primary w-full" />
          <CardHeader className="p-8 pb-4">
             <FileText className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
             <CardTitle className="text-xl font-black font-headline">تقرير العمليات (Operational Report)</CardTitle>
             <CardDescription className="font-bold">نظرة شاملة على تقدم المشاريع والميزانيات المعتمدة.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 flex gap-3">
             <Button variant="outline" className="flex-1 rounded-xl font-bold"><Download className="h-4 w-4 me-2" /> PDF</Button>
             <Button className="flex-1 bg-primary text-white rounded-xl font-bold"><Printer className="h-4 w-4 me-2" /> طباعة</Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden opacity-50 grayscale hover:grayscale-0 transition-all">
          <div className="h-3 bg-emerald-500 w-full" />
          <CardHeader className="p-8 pb-4">
             <DollarSign className="h-10 w-10 text-emerald-500 mb-4" />
             <CardTitle className="text-xl font-black font-headline">الميزانية العمومية</CardTitle>
             <CardDescription className="font-bold">تحليل الأصول والالتزامات وحقوق الملكية للمنشأة.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0">
             <p className="text-xs font-bold text-muted-foreground italic">قريباً في التحديث القادم...</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden opacity-50 grayscale hover:grayscale-0 transition-all">
          <div className="h-3 bg-blue-500 w-full" />
          <CardHeader className="p-8 pb-4">
             <HardHat className="h-10 w-10 text-blue-500 mb-4" />
             <CardTitle className="text-xl font-black font-headline">سجل القوى العاملة</CardTitle>
             <CardDescription className="font-bold">توزيع المهندسين والعمالة في المواقع الإنشائية.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0">
             <p className="text-xs font-bold text-muted-foreground italic">قريباً في التحديث القادم...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
