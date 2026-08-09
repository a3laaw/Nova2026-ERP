'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Calculator, Plus, Loader2, Search, 
  CalendarDays, FileText, ArrowRight,
  TrendingDown, TrendingUp, Filter, Lock
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { PayrollBatch } from '@/types/payroll';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function PayrollBatchesPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // القفل السيادي: فحص صلاحية الاعتماد (Approve) قبل العرض
  const payrollAccess = check('hr', 'approve');

  useEffect(() => {
    if (!isAdmin && !payrollAccess.can) {
       router.replace('/dashboard/hr');
    }
  }, [isAdmin, payrollAccess, router]);

  const batchesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.payroll(companyId)), orderBy('year', 'desc')) : null, 
  [db, companyId]);

  const { data: batches, loading } = useCollection<PayrollBatch>(batchesQuery);

  const filtered = batches.filter(b => 
    `${b.month}/${b.year}`.includes(searchTerm) || 
    b.status.includes(searchTerm.toLowerCase())
  );

  if (!isAdmin && !payrollAccess.can) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
         <div className="h-20 w-20 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shadow-inner">
            <Lock className="h-10 w-10" />
         </div>
         <h2 className="text-xl font-black text-slate-800">{t('hr.accessRestricted')}</h2>
         <p className="text-xs font-bold text-slate-400">{t('hr.noPayrollAccess')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Calculator className="h-10 w-10 text-primary" />
            {t('hr.payrollTitle')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {t('hr.manageFinancials')}
          </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/hr/payroll/new')}
          variant="default"
          className="h-12 px-8 shadow-xl shadow-primary/20"
        >
          <Plus className="me-2 h-6 w-6" />
          {t('hr.newPayrollBatch')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-xl p-6 text-start bg-white group hover:scale-[1.02] transition-all">
            <TrendingUp className="h-8 w-8 text-emerald-500 mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('hr.totalNetPaid')}</p>
            <h3 className="text-3xl font-black font-headline text-slate-900">
              {batches?.reduce((acc, b) => acc + (b.totalNetSalary || 0), 0).toLocaleString()} <span className="text-xs">KWD</span>
            </h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-xl p-6 text-start bg-white group hover:scale-[1.02] transition-all">
            <TrendingDown className="h-8 w-8 text-rose-500 mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('hr.totalDeductions')}</p>
            <h3 className="text-3xl font-black font-headline text-slate-900">
              {batches?.reduce((acc, b) => acc + (b.totalDeductions || 0), 0).toLocaleString()} <span className="text-xs">KWD</span>
            </h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-xl p-6 text-start bg-white group hover:scale-[1.02] transition-all">
            <FileText className="h-8 w-8 text-blue-500 mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('hr.batchCount')}</p>
            <h3 className="text-3xl font-black font-headline text-slate-900">{batches?.length || 0}</h3>
         </Card>
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between gap-4">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#FFA000]" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-12 h-11 bg-white border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary transition-all" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <Button variant="outline" className="rounded-xl font-bold h-11 px-4 flex items-center gap-2 border-slate-200">
              <Filter className="h-4 w-4 text-[#FFA000]" /> {t('common.filter')}
           </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
           <Table>
              <TableHeader className="bg-muted/10 border-b">
                 <TableRow>
                    <TableHead className="py-5 ps-8 text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{t('hr.period') || 'Period'}</TableHead>
                    <TableHead className="text-center font-black text-slate-500 uppercase text-[10px] tracking-widest">{t('hr.employees') || 'Employees'}</TableHead>
                    <TableHead className="text-end font-black text-slate-500 uppercase text-[10px] tracking-widest">{t('hr.netAmount') || 'Net Amount'}</TableHead>
                    <TableHead className="text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{t('common.status')}</TableHead>
                    <TableHead className="pe-8"></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {loading ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                 ) : filtered.length === 0 ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-slate-400 font-bold">{t('hr.noPayrollFound') || 'No payroll batches found.'}</TableCell></TableRow>
                 ) : (
                   filtered.map((batch) => (
                     <TableRow key={batch.id} className="hover:bg-primary/[0.02] transition-colors group cursor-pointer border-b-slate-100" onClick={() => router.push(`/dashboard/hr/payroll/${batch.id}`)}>
                        <TableCell className="py-5 ps-8 text-start">
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
                           <Badge variant="outline" className={cn(
                             "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px] gap-1",
                             batch.status === 'paid' ? 'bg-[#039BE5]/10 text-[#039BE5]' :
                             batch.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                             'bg-[#FFCA28]/10 text-[#FFCA28]'
                           )}>
                              {t('status.' + batch.status)}
                           </Badge>
                        </TableCell>
                        <TableCell className="pe-8 text-center">
                           <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-9 w-9">
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
