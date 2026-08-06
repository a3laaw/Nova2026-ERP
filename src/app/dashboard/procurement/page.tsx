'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, ShoppingCart, FileSearch, Package, 
  ArrowUpRight, Sparkles, TrendingUp, BarChart3,
  Users, Plus, Clock, FileText, ShoppingBag
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { PurchaseOrder } from '@/types/procurement';
import { cn } from '@/lib/utils';

export default function ProcurementDashboard() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const ordersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.purchaseOrders(companyId)), orderBy('createdAt', 'desc'), limit(5)) : null, 
  [db, companyId]);

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId))) : null, 
  [db, companyId]);

  const { data: orders } = useCollection<PurchaseOrder>(ordersQuery);
  const { data: suppliers } = useCollection<any>(suppliersQuery);

  const stats = [
    { title: isRtl ? 'الموردين النشطين' : 'Active Suppliers', val: suppliers?.length || 0, icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: isRtl ? 'أوامر الشراء (POs)' : 'Purchase Orders', val: orders?.length || 0, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: isRtl ? 'إجمالي المشتريات' : 'Total Spend', val: orders?.reduce((acc, o) => acc + (o.totalAmount || 0), 0).toLocaleString(), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: isRtl ? 'عروض قيد التحليل' : 'Pending Quotes', val: '5', icon: FileSearch, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const quickActions = [
    { title: isRtl ? 'تحليل عرض سعر ذكي' : 'AI Quote Analysis', desc: isRtl ? 'مقارنة العروض بالذكاء الاصطناعي' : 'AI Price comparison', icon: Sparkles, path: '/dashboard/ai', primary: true },
    { title: isRtl ? 'إصدار أمر شراء' : 'New Purchase Order', desc: isRtl ? 'إنشاء أمر توريد رسمي لمورد' : 'Issue official PO', icon: ShoppingBag, path: '/dashboard/procurement/orders/new', primary: false },
    { title: isRtl ? 'سجل الأوامر' : 'Orders History', desc: isRtl ? 'عرض ومتابعة كافة الطلبات' : 'View all purchase history', icon: FileText, path: '/dashboard/procurement/orders', primary: false },
  ];

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-700" dir={dir}>
      <div className="text-start">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
          <ShoppingCart className="h-6 w-6 text-primary" />
          {t('procurement')}
        </h1>
        <p className="text-muted-foreground text-xs font-medium italic">
          {isRtl ? 'إدارة سلسلة التوريد الذكية والتحليلات المالية للمشتريات' : 'Smart supply chain management and procurement analytics'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border shadow-sm rounded-lg p-4 text-start bg-white group hover:shadow-md transition-all">
             <div className={cn("p-2.5 rounded-lg w-fit mb-3", stat.bg, stat.color)}>
                <stat.icon className="h-4 w-4" />
             </div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.title}</p>
             <h3 className="text-xl font-bold text-slate-900">{stat.val}</h3>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {quickActions.map((action, i) => (
          <Card 
            key={i} 
            onClick={() => router.push(action.path)}
            className={cn(
              "border shadow-sm rounded-lg p-6 cursor-pointer group transition-all relative overflow-hidden",
              action.primary ? "bg-orange-50 border-orange-200" : "bg-white hover:bg-slate-50"
            )}
          >
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-4 shadow-sm", action.primary ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
               <action.icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold mb-1">{action.title}</h3>
            <p className={cn("text-[10px] font-medium opacity-70", action.primary ? "text-orange-900" : "text-slate-500")}>{action.desc}</p>
            <div className={cn("mt-4 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider", action.primary ? "text-primary" : "text-slate-400")}>
               {isRtl ? 'ابدأ الآن' : 'Get Started'}
               <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card className="rounded-lg border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 text-start">
               <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {isRtl ? 'آخر أوامر الشراء' : 'Recent POs'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               {orders && orders.length > 0 ? (
                 <div className="divide-y divide-slate-100">
                   {orders.map(o => (
                     <div key={o.id} onClick={() => router.push(`/dashboard/procurement/orders/${o.id}`)} className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className="text-start">
                           <p className="font-bold text-slate-800 text-xs">{o.poNumber}</p>
                           <p className="text-[10px] font-medium text-slate-400">{o.supplierName}</p>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-bold uppercase h-5">{o.status}</Badge>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="p-16 text-center text-slate-300 italic font-medium text-xs">
                    {isRtl ? 'لا يوجد أوامر شراء نشطة حالياً.' : 'No active purchase orders found.'}
                 </div>
               )}
            </CardContent>
         </Card>

         <Card className="rounded-lg border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 text-start">
               <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  {isRtl ? 'تحليل الإنفاق حسب التصنيف' : 'Spending by Category'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-16 text-center text-slate-200 italic font-medium text-xs">
               {isRtl ? 'سيتم عرض المخططات البيانية قريباً.' : 'Analytics charts coming soon.'}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
