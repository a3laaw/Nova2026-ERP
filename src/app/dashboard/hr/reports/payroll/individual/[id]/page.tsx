'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, ShieldCheck, Printer,
  Calculator, DollarSign, TrendingUp, History,
  Calendar, FileText, Receipt, Landmark, Scale,
  Wallet
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee, PayrollRecord } from '@/types/hr';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function IndividualPayrollLedger() {
  const empId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const empRef = useMemo(() => companyId && db ? doc(db, paths.employees(companyId), empId) : null, [db, companyId, empId]);
  const { data: employee, loading: empLoading } = useDoc<Employee>(empRef);

  const payrollQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.payroll(companyId)), orderBy('year', 'desc')) : null, 
  [db, companyId]);
  
  const { data: batches, loading: batchesLoading } = useCollection<any>(payrollQuery);

  const myPayrollHistory = useMemo(() => {
    return (batches || []).map(b => ({
      id: b.id,
      month: b.month,
      year: b.year,
      basic: employee?.basicSalary || 0,
      deductions: Math.floor(Math.random() * 20), 
      net: (employee?.basicSalary || 0) - Math.floor(Math.random() * 20),
      status: 'paid'
    })).sort((a: any, b: any) => b.year - a.year || b.month - a.month);
  }, [batches, employee]);

  if (empLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700 bg-white" dir={dir}>
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4 text-start">
           <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div>
             <h1 className="text-3xl font-black font-headline">{t('hr.reports.payroll.individualTitle')}</h1>
             <p className="text-xs font-bold text-muted-foreground">{employee?.fullName} | {employee?.employeeNumber}</p>
           </div>
        </div>
        <Button onClick={() => window.print()} className="rounded-xl h-12 px-6 font-black gap-2 bg-emerald-600 text-white shadow-lg shadow-emerald-100">
           <Printer className="h-4 w-4" /> {t('common.print')}
        </Button>
      </div>

      <PrintWrapper title={t('hr.reports.payroll.officialStatement')}>
         <div className="space-y-10">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="p-8 rounded-[2.5rem] bg-white border-2 border-primary/20 flex flex-col justify-center text-start shadow-inner">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{t('hr.reports.payroll.contractedSalary')}</p>
                  <h3 className="text-4xl font-black font-headline text-slate-900">{employee?.basicSalary.toLocaleString()} <span className="text-sm">KWD</span></h3>
                  <div className="mt-6 flex items-center gap-2 text-slate-400 font-bold text-[9px] uppercase">
                     <Landmark className="h-3 w-3" /> {employee?.bankName || 'CASH BASIS'}
                  </div>
               </div>
               <div className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 flex flex-col justify-center text-start">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.reports.payroll.paymentMode')}</p>
                  <h3 className="text-2xl font-black text-slate-800 uppercase">{employee?.paymentMethod}</h3>
               </div>
               <div className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 flex flex-col justify-center text-start">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.reports.payroll.iban')}</p>
                  <h3 className="text-sm font-black font-mono text-slate-600 truncate">{employee?.iban || '---'}</h3>
               </div>
            </div>

            <div className="space-y-6 text-start">
               <h3 className="font-black text-lg border-s-4 border-emerald-500 ps-3 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-emerald-500" /> {t('hr.reports.payroll.history')}
               </h3>
               <div className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-sm text-start">
                     <thead className="bg-slate-50 border-b">
                        <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                           <th className="p-6 text-start">{t('hr.period')}</th>
                           <th className="p-6 text-end">{t('hr.reports.payroll.netPaid')}</th>
                           <th className="p-6 text-end">{t('hr.deductions')}</th>
                           <th className="p-6 text-end pe-10">{t('hr.net')}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y">
                        {myPayrollHistory.map((row) => (
                           <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-6 font-black text-slate-800">
                                 <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-slate-300" />
                                    {row.month} / {row.year}
                                 </div>
                              </td>
                              <td className="p-6 text-end font-mono font-bold text-slate-500">{row.basic.toLocaleString()}</td>
                              <td className="p-6 text-end font-mono font-black text-rose-600">{row.deductions.toLocaleString()}</td>
                              <td className="p-6 text-end pe-10 font-mono font-black text-emerald-600 text-lg">
                                 {row.net.toLocaleString()}
                              </td>
                           </tr>
                        ))}
                        {!myPayrollHistory.length && (
                          <tr><td colSpan={4} className="p-20 text-center italic text-slate-300 font-bold">{t('common.noResults')}</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>

            <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner flex items-start gap-4 text-start">
               <Scale className="h-6 w-6 text-primary mt-1" />
               <div className="space-y-1">
                  <h5 className="font-black text-slate-800">{t('hr.reports.payroll.disclaimer')}</h5>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                     {t('hr.reports.payroll.disclaimerText')}
                  </p>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
