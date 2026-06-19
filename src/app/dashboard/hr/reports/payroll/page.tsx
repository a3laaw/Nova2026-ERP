'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, Loader2, DollarSign, FileText } from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { PayrollBatch } from '@/types/payroll';
import { cn } from '@/lib/utils';
import { ReportFilters } from '@/components/hr/reports/report-filters';

export default function PayrollSummaryReportPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const payrollQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.payroll(companyId)), orderBy('year', 'desc'), orderBy('month', 'desc')) : null, 
  [db, companyId]);

  const { data: batches, loading } = useCollection<PayrollBatch>(payrollQuery);

  const totals = useMemo(() => {
    if (!batches) return { net: 0, deductions: 0, count: 0 };
    return {
      net: batches.reduce((sum, b) => sum + (b.totalNetSalary || 0), 0),
      deductions: batches.reduce((sum, b) => sum + (b.totalDeductions || 0), 0),
      count: batches.length
    };
  }, [batches]);

  return (
    <div className="space-y-8" dir={dir}>
      <div className="text-start">
        <h1 className="text-3xl font-black font-headline flex items-center gap-3">
          <Calculator className="h-8 w-8 text-amber-600" />
          {isRtl ? 'ملخص مصروفات الرواتب' : 'Payroll Expenditure Summary'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {isRtl ? 'عرض إجمالي المدفوعات والخصومات على مستوى المنشأة.' : 'Overview of institution-wide payments and deductions.'}
        </p>
      </div>

      <ReportFilters onFilter={() => {}} showDateRange={false} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-2xl p-6 text-start bg-white border-b-4 border-emerald-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي الصافي المصروف' : 'Total Net Paid'}</p>
            <h3 className="text-3xl font-black text-emerald-600 font-mono">{totals.net.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-2xl p-6 text-start bg-white border-b-4 border-rose-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي الاستقطاعات' : 'Total Deductions'}</p>
            <h3 className="text-3xl font-black text-rose-600 font-mono">{totals.deductions.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-2xl p-6 text-start bg-white border-b-4 border-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'عدد الدورات' : 'Cycles'}</p>
            <h3 className="text-3xl font-black text-blue-600">{totals.count}</h3>
         </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الدورة المالية' : 'Payroll Cycle'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'الموظفين' : 'Employees'}</TableHead>
                <TableHead className="text-end">{isRtl ? 'إجمالي الرواتب' : 'Gross'}</TableHead>
                <TableHead className="text-end">{isRtl ? 'الخصومات' : 'Deductions'}</TableHead>
                <TableHead className="text-end pe-8">{isRtl ? 'الصافي' : 'Net Amount'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : batches?.map((batch) => (
                <TableRow key={batch.id} className="hover:bg-slate-50 transition-colors font-bold">
                  <TableCell className="py-6 ps-8 text-start">
                     <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-800">{batch.month} / {batch.year}</span>
                        <Badge variant="outline" className="text-[9px] font-black uppercase">{batch.status}</Badge>
                     </div>
                  </TableCell>
                  <TableCell className="text-center">{batch.totalEmployees}</TableCell>
                  <TableCell className="text-end font-mono text-slate-500">{(batch.totalBasicSalary + batch.totalAllowances).toLocaleString()}</TableCell>
                  <TableCell className="text-end font-mono text-rose-600">{batch.totalDeductions.toLocaleString()}</TableCell>
                  <TableCell className="text-end pe-8 font-mono text-emerald-600 text-lg">{batch.totalNetSalary.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
