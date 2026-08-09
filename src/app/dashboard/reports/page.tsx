'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, FileText, Printer, Download, 
  MapPinned, Calculator, TrendingUp, CheckCircle2,
  ArrowUpRight, Sparkles, LayoutGrid, Landmark
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function ReportsHubPage() {
  const { t, lang, dir, isRtl } = useLanguage();
  const router = useRouter();

  const reportCards = [
    {
      id: 'executive',
      title: t('reports.executive.title'),
      desc: isRtl ? 'ملخص الأداء العام للمنظمة والنتائج المالية والتشغيلية.' : 'Summary of overall organization performance.',
      icon: Landmark,
      color: 'text-primary',
      bg: 'bg-primary/5',
      path: '/dashboard/reports/executive',
      primary: true
    },
    {
      id: 'analytics',
      title: t('reports.analytics.title'),
      desc: isRtl ? 'تحليلات ذكية لربط المقايسات الميدانية بالمصروفات المالية.' : 'Smart analytics linking field BOQs with finance.',
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/dashboard/reports/analytics'
    },
    {
      id: 'visits',
      title: t('visitsdossier'),
      desc: isRtl ? 'تتبع تاريخي لكل الزيارات والتقارير الميدانية والمكتبية.' : 'Historical tracking of all visits.',
      icon: MapPinned,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/dashboard/projects/reports/client-visits'
    }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700" dir={dir}>
      {/* Unified Header Design */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <BarChart3 className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('reports.hub.title')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">
               {t('reports.hub.description')}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {reportCards.map((card) => (
          <Card 
            key={card.id} 
            className={cn(
              "border-0 shadow-2xl rounded-[3rem] bg-white hover:shadow-primary/5 transition-all cursor-pointer group overflow-hidden border-b-8",
              card.primary ? "border-b-primary" : "border-b-slate-100"
            )}
            onClick={() => router.push(card.path)}
          >
            <CardHeader className="p-10 pb-6 text-start">
               <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-lg", card.bg, card.color)}>
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
    </div>
  );
}
