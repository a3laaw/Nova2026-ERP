'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, Filter, Loader2, ArrowRight } from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { AttendanceRecord } from '@/types/hr';
import { cn } from '@/lib/utils';
import { ReportFilters } from '@/components/hr/reports/report-filters';

export default function AttendanceReportPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [filters, setFilters] = useState<any>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const attendanceQuery = useMemo(() => 
    companyId && db ? query(
      collection(db, paths.attendance(companyId)),
      where('date', '>=', filters.start),
      where('date', '<=', filters.end),
      orderBy('date', 'desc')
    ) : null, 
  [db, companyId, filters]);

  const { data: records, loading } = useCollection<AttendanceRecord>(attendanceQuery);

  const stats = useMemo(() => {
    if (!records) return { total: 0, present: 0, late: 0, absent: 0, totalLateMins: 0 };
    return {
      total: records.length,
      present: records.filter(r => r.status === 'present').length,
      late: records.filter(r => r.status === 'late').length,
      absent: records.filter(r => r.status === 'absent').length,
      totalLateMins: records.reduce((sum, r) => sum + (r.minutesLate || 0), 0)
    };
  }, [records]);

  return (
    <div className="space-y-8" dir={dir}>
      <div className="text-start">
        <h1 className="text-3xl font-black font-headline flex items-center gap-3">
          <Clock className="h-8 w-8 text-emerald-600" />
          {isRtl ? 'تحليل حضور القوى العاملة' : 'Attendance Analysis Report'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
          {isRtl ? 'تتبع الانضباط، التأخير، والغياب لفريق العمل.' : 'Track discipline, late minutes, and workforce absences.'}
        </p>
      </div>

      <ReportFilters onFilter={setFilters} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'إجمالي السجلات' : 'Total Logs', val: stats.total, color: 'text-slate-900' },
           { label: isRtl ? 'حالات الحضور' : 'Present', val: stats.present, color: 'text-emerald-600' },
           { label: isRtl ? 'حالات التأخير' : 'Late', val: stats.late, color: 'text-amber-600' },
           { label: isRtl ? 'إجمالي التأخير (د)' : 'Total Late Mins', val: stats.totalLateMins, color: 'text-rose-600' },
         ].map((s, i) => (
           <Card key={i} className="border-0 shadow-lg rounded-2xl p-6 text-start bg-white">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{s.label}</p>
              <h3 className={cn("text-3xl font-black font-headline", s.color)}>{s.val}</h3>
           </Card>
         ))}
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'دخول / خروج' : 'In / Out'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'التأخير' : 'Late (m)'}</TableHead>
                <TableHead className="text-start pe-8">{isRtl ? 'الحالة' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : records?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد سجلات لهذه الفترة.' : 'No records for this period.'}</TableCell></TableRow>
              ) : (
                records?.map((rec) => (
                  <TableRow key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="py-4 ps-8 text-start">
                       <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-sm">{rec.employeeName}</span>
                          <span className="text-[10px] font-mono text-slate-400">#{rec.employeeNumber}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start font-mono text-xs font-bold text-slate-500">{rec.date}</TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-2 text-xs font-black text-slate-700">
                          <span className="bg-slate-100 px-2 py-1 rounded-md">{rec.checkIn || '--:--'}</span>
                          <ArrowRight className={cn("h-2 w-2 opacity-20", isRtl && "rotate-180")} />
                          <span className="bg-slate-100 px-2 py-1 rounded-md">{rec.checkOut || '--:--'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       {rec.minutesLate ? <Badge variant="destructive" className="bg-rose-50 text-rose-600 font-black border-0">{rec.minutesLate} min</Badge> : '-'}
                    </TableCell>
                    <TableCell className="pe-8">
                       <Badge className={cn(
                         "font-black px-3 py-1 border-0 shadow-sm uppercase text-[9px]",
                         rec.status === 'present' ? 'bg-emerald-500 text-white' :
                         rec.status === 'late' ? 'bg-amber-500 text-white' :
                         rec.status === 'holiday' || rec.status === 'weekend' ? 'bg-blue-100 text-blue-600' :
                         'bg-rose-500 text-white'
                       )}>
                          {rec.status}
                       </Badge>
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
