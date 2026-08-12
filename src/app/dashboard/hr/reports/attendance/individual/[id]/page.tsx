'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ShieldCheck, Printer,
  History, Info, Landmark, Calculator
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
  const { lang, dir, t, tSafe } = useLanguage();
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
    <div className="space-y-8 pb-20 animate-in fade-in duration-700 bg-white" dir={dir}>
      <div className="flex items-center justify-between print:hidden">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline">{t('hr.reports.attendance.individualTitle')}</h1>
          <p className="text-xs font-bold text-muted-foreground">{employee?.fullName} | {employee?.employeeNumber}</p>
        </div>
        <Button onClick={() => window.print()} className="rounded-xl h-12 px-6 font-black gap-2 bg-primary text-white shadow-lg">
           <Printer className="h-4 w-4" /> {t('common.print')}
        </Button>
      </div>

      <PrintWrapper title={t('hr.reports.attendance.disciplineReport')}>
         <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <Card className="border-0 shadow-xl rounded-[2rem] bg-white border-2 border-primary/20 p-8 shadow-inner flex flex-col justify-center">
                  <div className="flex items-center gap-3 text-primary mb-2">
                     <Landmark className="h-5 w-5" />
                     <p className="text-[10px] font-black uppercase tracking-widest">{t('hr.reports.attendance.punctualityRate')}</p>
                  </div>
                  <h3 className="text-5xl font-black font-headline text-slate-900">{stats.punctualityRate}%</h3>
               </Card>
               <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-8 border-b-4 border-rose-500">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{t('hr.reports.totalLateMins')}</p>
                  <h3 className="text-4xl font-black text-rose-600">{stats.totalLateMins} <span className="text-xs">{tSafe('inline.min', 'دقيقة', 'min')}</span></h3>
               </Card>
               <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-8 border-b-4 border-emerald-500">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{t('hr.reports.attendance.totalPresence')}</p>
                  <h3 className="text-4xl font-black text-emerald-600">{stats.presentCount}</h3>
               </Card>
               <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-8 border-b-4 border-amber-500">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{t('hr.reports.attendance.absences')}</p>
                  <h3 className="text-4xl font-black text-amber-600">{stats.absentCount}</h3>
               </Card>
            </div>

            <div className="space-y-6 text-start">
               <h3 className="font-black text-lg border-s-4 border-primary ps-3 flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> {t('hr.reports.attendance.detailedLogs')}
               </h3>
               <div className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-sm text-start">
                     <thead className="bg-slate-50 border-b">
                        <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                           <th className="p-6 text-start">{t('common.date')}</th>
                           <th className="p-6 text-center">{tSafe('inline.in', 'دخول', 'In')}</th>
                           <th className="p-6 text-center">{tSafe('inline.out', 'خروج', 'Out')}</th>
                           <th className="p-6 text-end pe-10">{t('common.status')}</th>
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
