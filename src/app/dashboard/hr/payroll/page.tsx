
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Calculator, Plus, Loader2, Search, 
  CalendarDays, FileText, ArrowRight,
  TrendingDown, TrendingUp, DollarSign
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { PayrollBatch } from '@/types/payroll';
import { cn } from '@/lib/utils';

export default function PayrollBatchesPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // استخدام استعلام مبسط أولاً لتجنب الحاجة لفهرس مركب فوراً
  // Firestore يحتاج لفهرس عند الجمع بين orderBy لعدة حقول.
  const batchesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.payroll(companyId)), orderBy('year', 'desc')) : null, 
  [db, companyId]);

  const { data: batches, loading, error } = useCollection<PayrollBatch>(batchesQuery);

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Calculator className="h-10 w-10 text-primary" />
            {t('payroll')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة المستحقات المالية والخصومات التشغيلية' : 'Manage financial entitlements and operational deductions'}
          </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/hr/payroll/new')}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          <Plus className="me-2 h-6 w-6" />
          {isRtl ? 'توليد كشف جديد' : 'New Payroll Batch'}
        </Button>
      </div>

      {error && (
        <Card className="border-2 border-rose-100 bg-rose-50 p-6 rounded-2xl text-start">
           <p className="text-rose-700 font-black text-sm">خطأ في جلب البيانات: {error.message}</p>
           <p className="text-rose-600 text-xs mt-1 font-bold">إذا كان الخطأ يتعلق بـ "Index"، يرجى مراجعة كونسول المتصفح للضغط على رابط إنشاء الفهرس المفقود.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <TrendingUp className="h-8 w-8 text-emerald-500 mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'إجمالي الرواتب الصافية' : 'Total Net Paid'}</p>
            <h3 className="text-3xl font-black font-headline text-slate-900">
              {batches?.reduce((acc, b) => acc + (b.totalNetSalary || 0), 0).toLocaleString()} <span className="text-xs">KWD</span>
            </h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <TrendingDown className="h-8 w-8 text-rose-500 mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'إجمالي الخصومات' : 'Total Deductions'}</p>
            <h3 className="text-3xl font-black font-headline text-slate-900">
              {batches?.reduce((acc, b) => acc + (b.totalDeductions || 0), 0).toLocaleString()} <span className="text-xs">KWD</span>
            </h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white">
            <FileText className="h-8 w-8 text-blue-500 mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'عدد الدفعات' : 'Batch Count'}</p>
            <h3 className="text-3xl font-black font-headline text-slate-900">{batches?.length || 0}</h3>
         </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8">
           <CardTitle className="text-xl font-black">{isRtl ? 'سجل دفعات الرواتب' : 'Payroll History'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
           <Table>
              <TableHeader className="bg-muted/30">
                 <TableRow>
                    <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الفترة' : 'Period'}</TableHead>
                    <TableHead className="text-center">{isRtl ? 'الموظفين' : 'Employees'}</TableHead>
                    <TableHead className="text-end">{isRtl ? 'الصافي' : 'Net Amount'}</TableHead>
                    <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="pe-8"></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {loading ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                 ) : batches?.length === 0 ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-muted-foreground font-bold">{isRtl ? 'لا توجد كشوف رواتب مسجلة.' : 'No payroll batches found.'}</TableCell></TableRow>
                 ) : (
                   batches?.map((batch) => (
                     <TableRow key={batch.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => router.push(`/dashboard/hr/payroll/${batch.id}`)}>
                        <TableCell className="py-6 ps-8 text-start">
                           <div className="flex items-center gap-3">
                              <CalendarDays className="h-5 w-5 text-primary" />
                              <span className="font-black text-slate-800">{batch.month} / {batch.year}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-600">{batch.totalEmployees}</TableCell>
                        <TableCell className="text-end font-mono font-black text-emerald-600">
                           {batch.totalNetSalary?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-start">
                           <Badge className={cn(
                             "font-black px-3 py-1 border-0 shadow-sm uppercase text-[9px]",
                             batch.status === 'paid' ? 'bg-emerald-500 text-white' :
                             batch.status === 'approved' ? 'bg-blue-500 text-white' :
                             'bg-amber-50 text-amber-600'
                           )}>
                              {batch.status}
                           </Badge>
                        </TableCell>
                        <TableCell className="pe-8 text-center">
                           <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white">
                              <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-0", isRtl && "rotate-180")} />
                           </Button>
                        </TableCell>
                     </TableRow>
                   ))
                 )}
              </TableBody>
           </Table>
        </CardContent>
      </Card>
    </div>
  );
}
