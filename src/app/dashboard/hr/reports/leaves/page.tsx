'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Loader2, Plane, AlertTriangle } from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee } from '@/types/hr';
import { cn } from '@/lib/utils';
import { ReportFilters } from '@/components/hr/reports/report-filters';

export default function LeaveBalanceReportPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('employeeNumber')) : null, 
  [db, companyId]);

  const { data: employees, loading } = useCollection<Employee>(empsQuery);

  return (
    <div className="space-y-8" dir={dir}>
      <div className="text-start">
        <h1 className="text-3xl font-black font-headline flex items-center gap-3">
          <Plane className="h-8 w-8 text-blue-600" />
          {isRtl ? 'تقرير أرصدة الإجازات السنوية' : 'Leave Balance Audit Report'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {isRtl ? 'مراجعة الأرصدة المتبقية لكل موظف وتاريخ الاستحقاق.' : 'Audit remaining balances for each employee and entitlement dates.'}
        </p>
      </div>

      <ReportFilters onFilter={() => {}} showDateRange={false} />

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'القسم' : 'Department'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'الرصيد الكلي' : 'Total Entitled'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'الرصيد المتبقي' : 'Remaining'}</TableHead>
                <TableHead className="text-start pe-8">{isRtl ? 'الحالة' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : employees?.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-slate-50 transition-colors">
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
                       (emp.annualLeaveBalance || 24) < 5 ? "text-rose-600" : "text-emerald-600"
                     )}>
                        {emp.annualLeaveBalance || 24}
                     </span>
                  </TableCell>
                  <TableCell className="pe-8">
                     {(emp.annualLeaveBalance || 24) < 5 ? (
                       <Badge className="bg-amber-50 text-amber-600 border-amber-200 border font-black text-[9px] gap-1">
                         <AlertTriangle className="h-2 w-2" /> {isRtl ? 'رصيد منخفض' : 'Low Balance'}
                       </Badge>
                     ) : (
                       <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 border font-black text-[9px]">
                         {isRtl ? 'سليم' : 'Healthy'}
                       </Badge>
                     )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
