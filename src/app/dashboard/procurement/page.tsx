
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Truck, ShoppingCart, FileSearch, Package, 
  ArrowUpRight, Sparkles, TrendingUp, BarChart3,
  Users, Plus, Clock
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function ProcurementDashboard() {
  const { t, lang, dir } = useLanguage();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const stats = [
    { title: isRtl ? 'الموردين النشطين' : 'Active Suppliers', val: '24', icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: isRtl ? 'أوامر الشراء (الشهر)' : 'POs This Month', val: '18', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: isRtl ? 'إجمالي المشتريات' : 'Total Spend', val: '12,450', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: isRtl ? 'عروض قيد التحليل' : 'Pending Quotes', val: '5', icon: FileSearch, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const quickActions = [
    { title: isRtl ? 'تحليل عرض سعر ذكي' : 'AI Quote Analysis', desc: isRtl ? 'مقارنة عروض الموردين بالذكاء الاصطناعي' : 'Compare quotes using AI', icon: Sparkles, path: '/dashboard/procurement/quotes', primary: true },
    { title: isRtl ? 'إضافة مورد جديد' : 'New Supplier', desc: isRtl ? 'تسجيل مورد في سلسلة التوريد' : 'Register a new supplier', icon: Plus, path: '/dashboard/procurement/suppliers', primary: false },
    { title: isRtl ? 'أمر شراء ميداني' : 'New LPO', desc: isRtl ? 'إصدار أمر شراء لمواد الموقع' : 'Issue a Local Purchase Order', icon: Package, path: '/dashboard/procurement', primary: false },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700" dir={dir}>
      <div className="text-start space-y-2">
        <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-[#1e1b4b]">
          <ShoppingCart className="h-10 w-10 text-primary" />
          {t('procurement')}
        </h1>
        <p className="text-muted-foreground font-bold text-sm opacity-80 italic">
          {isRtl ? 'إدارة سلسلة التوريد الذكية والتحليلات المالية للمشتريات' : 'Smart supply chain management and procurement analytics'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-0 shadow-xl rounded-[2rem] p-6 text-start bg-white group hover:scale-105 transition-all">
             <div className={cn("p-4 rounded-2xl w-fit mb-4", stat.bg, stat.color)}>
                <stat.icon className="h-6 w-6" />
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.title}</p>
             <h3 className="text-3xl font-black font-headline text-[#1e1b4b]">{stat.val}</h3>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {quickActions.map((action, i) => (
          <Card 
            key={i} 
            onClick={() => router.push(action.path)}
            className={cn(
              "border-0 shadow-2xl rounded-[2.5rem] p-8 cursor-pointer group transition-all relative overflow-hidden",
              action.primary ? "bg-gradient-to-br from-[#e87c24] to-[#FFB000] text-white" : "bg-white hover:bg-slate-50"
            )}
          >
            {action.primary && <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><Sparkles className="h-24 w-24" /></div>}
            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg", action.primary ? "bg-white/20" : "bg-primary/10 text-primary")}>
               <action.icon className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black font-headline mb-2">{action.title}</h3>
            <p className={cn("text-sm font-bold opacity-70", action.primary ? "text-white" : "text-slate-500")}>{action.desc}</p>
            <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest">
               {isRtl ? 'ابدأ الآن' : 'Get Started'}
               <ArrowUpRight className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
               <CardTitle className="text-xl font-black flex items-center gap-3">
                  <Clock className="h-6 w-6 text-primary" />
                  {isRtl ? 'آخر أوامر الشراء' : 'Recent POs'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-20 text-center text-slate-300 italic font-bold">
                  {isRtl ? 'لا يوجد أوامر شراء نشطة حالياً.' : 'No active purchase orders found.'}
               </div>
            </CardContent>
         </Card>

         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
               <CardTitle className="text-xl font-black flex items-center gap-3">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  {isRtl ? 'تحليل الإنفاق حسب التصنيف' : 'Spending by Category'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-20 text-center text-slate-300 italic font-bold">
               {isRtl ? 'سيتم عرض المخططات البيانية عند توفر البيانات.' : 'Charts will appear when data is available.'}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
