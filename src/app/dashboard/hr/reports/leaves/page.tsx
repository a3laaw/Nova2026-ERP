'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plane, Loader2, AlertTriangle, RefreshCw, FileText, ArrowRight } from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee } from '@/types/hr';
import { cn } from '@/lib/utils';
import { ReportFilters } from '@/components/hr/reports/report-filters';
import { Button } from '@/components/ui/button';

export default function LeaveBalanceReportPage() {
  const { globalUser } = useAuthContext();
  const { t, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const empsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(collection(db, paths.employees(companyId)));
  }, [db, companyId]);

  const { data: rawEmployees, loading, error } = useCollection<Employee>(empsQuery);

  const employees = useMemo(() => {
    return [...rawEmployees].sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));
  }, [rawEmployees]);

  return (
    <div className="space-y-8" dir={dir}>
      <div className="text-start">
        <h1 className="text-3xl font-black font-headline flex items-center gap-3">
          <Plane className="h-8 w-8 text-blue-600" />
          {t('hr.reports.leaveBalanceAudit')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {t('hr.reports.leaveBalanceAuditDesc')}
        </p>
      </div>

      <ReportFilters onFilter={() => {}} showDateRange={false} />

      {error ? (
        <Card className="border-2 border-rose-100 bg-rose-50 p-10 text-center rounded-[2rem] space-y-4">
           <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><AlertTriangle className="h-8 w-8" /></div>
           <div className="space-y-1">
              <h3 className="text-xl font-black text-rose-900">{t('common.error')}</h3>
              <p className="text-sm text-rose-600 font-bold">{(error as any).message}</p>
           </div>
           <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl gap-2"><RefreshCw className="h-4 w-4" /> {t('common.retry')}</Button>
        </Card>
      ) : (
        <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b">
                <TableRow>
                  <TableHead className="py-6 ps-8 text-start">{t('common.name')}</TableHead>
                  <TableHead className="text-start">{t('orgRef')}</TableHead>
                  <TableHead className="text-center">{t('hr.reports.totalEntitled')}</TableHead>
                  <TableHead className="text-center">{t('hr.reports.remaining')}</TableHead>
                  <TableHead className="text-start">{t('common.status')}</TableHead>
                  <TableHead className="pe-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/30" /></TableCell></TableRow>
                ) : employees?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24 italic text-slate-400 font-bold">{t('common.noResults')}</TableCell></TableRow>
                ) : (
                  employees?.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-slate-50 transition-colors group">
                      <TableCell className="py-4 ps-8 text-start">
                         <div className="flex flex-col">
                            <span className="font-black text-slate-800 text-sm">{emp.fullName}</span>
                            <span className="text-[10px] font-mono text-slate-400">#{emp.employeeNumber}</span>
                         </div>
                      </TableCell>
                      <TableCell className="text-start font-black text-[10px] uppercase text-slate-500">
                        {emp.departmentName}
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-400">30</TableCell>
                      <TableCell className="text-center">
                         <span className={cn(
                           "font-black text-lg",
                           (emp.annualLeaveBalance || 0) < 5 ? "text-rose-600" : "text-emerald-600"
                         )}>
                            {emp.annualLeaveBalance || 0}
                         </span>
                      </TableCell>
                      <TableCell className="text-start">
                         {(emp.annualLeaveBalance || 0) < 5 ? (
                           <Badge className="bg-amber-50 text-amber-600 border-amber-200 border font-black text-[9px] gap-1">
                             <AlertTriangle className="h-2 w-2" /> {t('hr.reports.lowBalance')}
                           </Badge>
                         ) : (
                           <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 border font-black text-[9px]">
                             {t('hr.reports.healthy')}
                           </Badge>
                         )}
                      </TableCell>
                      <TableCell className="pe-8 text-end">
                         <Button 
                           variant="ghost" 
                           onClick={() => router.push(`/dashboard/hr/reports/leaves/statement/${emp.id}`)}
                           className="h-10 px-4 rounded-xl font-black text-xs gap-2 hover:bg-primary hover:text-white"
                         >
                            <FileText className="h-4 w-4" />
                            {t('hr.reports.statement')}
                            <ArrowRight className={cn("h-3 w-3", !isRtl && "rotate-0", isRtl && "rotate-180")} />
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
