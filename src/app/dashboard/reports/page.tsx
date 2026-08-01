'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, FileText, Printer, Download, 
  MapPinned, Calculator, TrendingUp, CheckCircle2,
  FolderSearch, ArrowUpRight, Sparkles, LayoutGrid,
  PieChart, Activity, Landmark
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function ReportsHubPage() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const reportCards = [
    {
      id: 'executive',
      title: isRtl ? 'التقرير التنفيذي الشامل' : 'Global Executive Report',
      desc: isRtl ? 'ملخص ذكاء أعمال موحد يشمل CRM والمشاريع والمالية والـ HR في شاشة واحدة.' : 'Unified business intelligence summary covering CRM, Projects, Finance and HR.',
      icon: Landmark,
      color: 'text-primary',
      bg: 'bg-primary/5',
      path: '/dashboard/reports/executive',
      primary: true
    },
    {
      id: 'analytics',
      title: isRtl ? 'رادار الأداء المالي والإنتاجي' : 'Financial Performance Radar',
      desc: isRtl ? 'تحليل ذكي لربط ميزانيات المقايسات بالمصروفات الفعلية ونسب الإنجاز.' : 'Smart analysis linking BOQ budgets to actual spending and progress.',
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/dashboard/reports/analytics'
    },
    {
      id: 'visits',
      title: isRtl ? 'سجل تفاعل العملاء والزيارات' : 'Client Visit Dossier',
      desc: isRtl ? 'تحليل تاريخي لكل زيارة: الإنجاز الفني الموثق والملاحظات الميدانية.' : 'Visit-by-visit audit of technical progress and site notes.',
      icon: MapPinned,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/dashboard/projects/reports/client-visits'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="text-start space-y-1">
        <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
          <BarChart3 className="h-10 w-10 text-primary" />
          {isRtl ? 'مركز التقارير والرقابة الهندسية' : 'Engineering Reports Hub'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {isRtl ? 'أدوات تحليلية متقدمة لربط الميدان بالمركز المالي والإداري.' : 'Advanced analytics linking field logs to financial center.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {reportCards.map((card) => (
          <Card 
            key={card.id} 
            className={cn(
              "border-0 shadow-xl rounded-[3rem] bg-white hover:shadow-2xl transition-all cursor-pointer group overflow-hidden border-b-8",
              card.primary ? "border-b-primary shadow-primary/5" : "border-b-slate-100"
            )}
            onClick={() => router.push(card.path)}
          >
            <CardHeader className="p-10 pb-6 text-start">
               <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-lg", card.bg, card.color)}>
                  <card.icon className="h-8 w-8" />
               </div>
               <CardTitle className="text-2xl font-black font-headline text-slate-900">{card.title}</CardTitle>
               <CardDescription className="text-base font-bold leading-relaxed mt-4">
                  {card.desc}
               </CardDescription>
            </CardHeader>
            <CardContent className="p-10 pt-0 text-start">
               <div className={cn("flex items-center gap-2 font-black text-xs transition-all mt-8", card.color)}>
                  {isRtl ? 'عرض التقرير المفصل' : 'View Detailed Report'}
                  <ArrowUpRight className="h-4 w-4" />
               </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="p-12 rounded-[3rem] border-4 border-dashed border-primary/10 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-6">
         <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center text-primary shadow-xl"><Sparkles className="h-10 w-10" /></div>
         <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-800">{isRtl ? 'ذكاء Nova للتقارير المخصصة' : 'Nova AI Custom Reporting'}</h3>
            <p className="text-slate-500 font-bold max-w-lg">قريباً: اطلب من Nova توليد أي تقرير تريده بلغة طبيعية وسيقوم المحرك ببنائه لك فوراً.</p>
         </div>
      </div>
    </div>
  );
}
