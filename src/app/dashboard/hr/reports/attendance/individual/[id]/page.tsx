
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ShieldCheck, Printer,
  History, Info
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee, AttendanceRecord } from '@/types/hr';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function IndividualAttendanceReport() {
  const empId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const empRef = useMemo(() => companyId && db ? doc(db, paths.employees(companyId), empId) : null, [db, companyId, empId]);
  const { data: employee, loading: empLoading } = useDoc<Employee>(empRef);

  const attendanceQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.attendance(companyId)), where('employeeId', '==', empId), orderBy('date', 'desc')) : null, 
  [db, companyId, empId]);
  
  const { data: records, loading: logsLoading } = useCollection<AttendanceRecord>(attendanceQuery);

  const stats = useMemo(() => {
    if (!records.length) return { punctualityRate: 0, totalLateMins: 0, presentCount: 0, absentCount: 0 };
    const workDays = records.filter(r => !['weekend', 'holiday'].includes(r.status));
    const onTime = workDays.filter(r => r.status === 'present').length;
    
    return {
      punctualityRate: workDays.length > 0 ? Math.round((onTime / workDays.length) * 100) : 0,
      totalLateMins: records.reduce((sum, r) => sum + (r.minutesLate || 0), 0),
      presentCount: workDays.filter(r => ['present', 'late'].includes(r.status)).length,
      absentCount: workDays.filter(r => r.status === 'absent').length
    };
  }, [records]);

  if (empLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex items-center justify-between print:hidden">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline">{isRtl ? 'تحليل انضباط الموظف' : 'Punctuality Analysis'}</h1>
          <p className="text-xs font-bold text-muted-foreground">{employee?.fullName} | {employee?.employeeNumber}</p>
        </div>
        <Button onClick={() => window.print()} className="rounded-xl h-12 px-6 font-black gap-2 bg-primary text-white">
           <Printer className="h-4 w-4" /> {isRtl ? 'طباعة التحليل' : 'Print Analysis'}
        </Button>
      </div>

      <PrintWrapper title={isRtl ? "تقرير الانضباط السلوكي والحضور" : "Attendance Discipline Report"}>
         <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <Card className="border-0 shadow-lg rounded-[2rem] bg-slate-900 text-white p-8">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">{isRtl ? 'معدل الانضباط' : 'Punctuality Rate'}</p>
                  <h3 className="text-5xl font-black font-headline text-emerald-400">{stats.punctualityRate}%</h3>
               </Card>
               <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-8 border-b-4 border-rose-500">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{isRtl ? 'إجمالي دقائق التأخير' : 'Total Late Mins'}</p>
                  <h3 className="text-4xl font-black text-rose-600">{stats.totalLateMins} <span className="text-xs">min</span></h3>
               </Card>
               <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-8 border-b-4 border-emerald-500">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{isRtl ? 'أيام الحضور' : 'Total Presence'}</p>
                  <h3 className="text-4xl font-black text-emerald-600">{stats.presentCount}</h3>
               </Card>
               <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-8 border-b-4 border-amber-500">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{isRtl ? 'حالات الغياب' : 'Absences'}</p>
                  <h3 className="text-4xl font-black text-amber-600">{stats.absentCount}</h3>
               </Card>
            </div>

            <div className="space-y-6 text-start">
               <h3 className="font-black text-lg border-s-4 border-primary ps-3 flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> {isRtl ? 'سجل الحركات التفصيلي' : 'Detailed Attendance Logs'}
               </h3>
               <div className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-sm text-start">
                     <thead className="bg-slate-50 border-b">
                        <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                           <th className="p-6 text-start">{isRtl ? 'التاريخ' : 'Date'}</th>
                           <th className="p-6 text-center">{isRtl ? 'الدخول' : 'In'}</th>
                           <th className="p-6 text-center">{isRtl ? 'الخروج' : 'Out'}</th>
                           <th className="p-6 text-end pe-10">{isRtl ? 'الحالة' : 'Status'}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y">
                        {records.map((rec) => (
                           <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-6 font-bold text-slate-700">{rec.date}</td>
                              <td className="p-6 text-center font-mono font-black">{rec.checkIn || '--:--'}</td>
                              <td className="p-6 text-center font-mono font-black">{rec.checkOut || '--:--'}</td>
                              <td className="p-6 text-end pe-10">
                                 <Badge className={cn(
                                   "font-black text-[9px] uppercase px-3",
                                   rec.status === 'present' ? "bg-emerald-500 text-white" : 
                                   rec.status === 'late' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                                 )}>{rec.status}</Badge>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
