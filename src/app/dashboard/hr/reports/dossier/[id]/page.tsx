'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, ShieldCheck, Printer,
  User, Calendar, Clock, Calculator, History,
  HardHat, MapPin, CheckCircle2, Phone, Mail
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee, AttendanceRecord, LeaveRequest, PermissionRequest, EmployeeAuditLog } from '@/types/hr';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function EmployeeDossierPage() {
  const params = useParams();
  const empId = params.id as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // 1. جلب البيانات الأساسية للموظف
  const empRef = useMemo(() => companyId && db ? doc(db, paths.employees(companyId), empId) : null, [db, companyId, empId]);
  const { data: employee, loading: empLoading } = useDoc<Employee>(empRef);

  // 2. جلب البيانات التاريخية
  const attendanceQuery = useMemo(() => companyId && db ? query(collection(db, paths.attendance(companyId)), where('employeeId', '==', empId), orderBy('date', 'desc')) : null, [db, companyId, empId]);
  const leavesQuery = useMemo(() => companyId && db ? query(collection(db, paths.leaveRequests(companyId)), where('userId', '==', empId), orderBy('startDate', 'desc')) : null, [db, companyId, empId]);
  const auditQuery = useMemo(() => companyId && db ? query(collection(db, `${paths.employees(companyId)}/${empId}/auditLogs`), orderBy('createdAt', 'desc')) : null, [db, companyId, empId]);

  const { data: attendance } = useCollection<AttendanceRecord>(attendanceQuery);
  const { data: leaves } = useCollection<LeaveRequest>(leavesQuery);
  const { data: auditLogs } = useCollection<EmployeeAuditLog>(auditQuery);

  if (empLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!employee) return <div className="p-20 text-center font-bold">{isRtl ? 'الموظف غير موجود' : 'Employee not found'}</div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.push('/dashboard/hr/reports/dossier')} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline">{isRtl ? 'الملف الوظيفي الشامل' : 'Employee Dossier'}</h1>
             <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                <ShieldCheck className="h-3 w-3 text-primary" /> {isRtl ? 'الرقم المرجعي:' : 'System ID:'} <span className="font-mono">{empId}</span>
             </p>
           </div>
        </div>
        <Button onClick={() => window.print()} className="rounded-2xl h-14 px-8 font-black gap-2 bg-primary shadow-xl shadow-primary/20 hover:scale-105 transition-all">
           <Printer className="h-5 w-5" /> {isRtl ? 'طباعة الملف الكامل' : 'Print Full Dossier'}
        </Button>
      </div>

      <PrintWrapper title={isRtl ? "سجل تاريخي للموظف" : "Comprehensive Employee Record"}>
         <div className="space-y-12">
            
            {/* Header Profile */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="md:col-span-2 space-y-6">
                  <div className="flex items-start gap-6">
                     <div className="h-24 w-24 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-3xl shadow-inner border-2 border-primary/10">
                        {employee.employeeNumber}
                     </div>
                     <div className="text-start space-y-2">
                        <h2 className="text-4xl font-black text-slate-900">{employee.fullName}</h2>
                        <p className="text-xl font-bold text-primary flex items-center gap-2">
                           <HardHat className="h-5 w-5" /> {employee.jobTitle}
                        </p>
                        <div className="flex flex-wrap gap-4 pt-2">
                           <span className="flex items-center gap-2 text-xs font-bold text-slate-500"><Phone className="h-3 w-3" /> {employee.mobile}</span>
                           <span className="flex items-center gap-2 text-xs font-bold text-slate-500"><Mail className="h-3 w-3" /> {employee.email}</span>
                           <span className="flex items-center gap-2 text-xs font-bold text-slate-500"><MapPin className="h-3 w-3" /> {employee.departmentName}</span>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100 flex flex-col justify-center items-center text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'الراتب الأساسي' : 'Basic Salary'}</p>
                  <p className="text-3xl font-black text-emerald-600 font-mono">{employee.basicSalary?.toLocaleString()} <span className="text-xs">KWD</span></p>
                  <Badge className={cn("mt-4 font-black uppercase", employee.status === 'active' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                     {employee.status}
                  </Badge>
               </div>
            </div>

            {/* Attendance Analytics (Brief) */}
            <div className="space-y-6">
               <h3 className="text-lg font-black border-s-4 border-primary ps-3 flex items-center gap-2">
                  <Clock className="h-5 w-5" /> {isRtl ? 'ملخص الحضور والانصراف' : 'Attendance Summary'}
               </h3>
               <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-white border-2 rounded-2xl text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'أيام الحضور' : 'Present Days'}</p>
                     <p className="text-2xl font-black text-emerald-600">{attendance?.filter(a => a.status === 'present').length || 0}</p>
                  </div>
                  <div className="p-4 bg-white border-2 rounded-2xl text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'مرات التأخير' : 'Late Cases'}</p>
                     <p className="text-2xl font-black text-amber-600">{attendance?.filter(a => a.status === 'late').length || 0}</p>
                  </div>
                  <div className="p-4 bg-white border-2 rounded-2xl text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'أيام الغياب' : 'Absences'}</p>
                     <p className="text-2xl font-black text-rose-600">{attendance?.filter(a => a.status === 'absent').length || 0}</p>
                  </div>
                  <div className="p-4 bg-white border-2 rounded-2xl text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'إجمالي الدقائق' : 'Late Mins'}</p>
                     <p className="text-2xl font-black text-slate-900">{attendance?.reduce((acc, a) => acc + (a.minutesLate || 0), 0)}</p>
                  </div>
               </div>
            </div>

            {/* Leave History */}
            <div className="space-y-6">
               <h3 className="text-lg font-black border-s-4 border-blue-500 ps-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" /> {isRtl ? 'تاريخ الإجازات' : 'Leave History'}
               </h3>
               <div className="border-2 rounded-[2rem] overflow-hidden">
                  <table className="w-full text-sm text-start">
                     <thead className="bg-slate-50 border-b">
                        <tr className="font-black text-slate-500 uppercase text-[10px]">
                           <th className="p-4 text-start">{isRtl ? 'النوع' : 'Type'}</th>
                           <th className="p-4 text-start">{isRtl ? 'الفترة' : 'Period'}</th>
                           <th className="p-4 text-center">{isRtl ? 'الأيام' : 'Days'}</th>
                           <th className="p-4 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y">
                        {leaves?.map(l => (
                           <tr key={l.id} className="hover:bg-slate-50/50">
                              <td className="p-4 font-bold uppercase">{l.type}</td>
                              <td className="p-4 font-mono text-xs text-slate-500">{l.startDate} → {l.endDate}</td>
                              <td className="p-4 text-center font-black">{l.workingDays}</td>
                              <td className="p-4"><Badge variant="outline" className="text-[9px] font-black">{l.status}</Badge></td>
                           </tr>
                        ))}
                        {!leaves?.length && <tr><td colSpan={4} className="p-10 text-center italic text-slate-400">{isRtl ? 'لا يوجد إجازات مسجلة.' : 'No leaves recorded.'}</td></tr>}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Audit Logs (Changes) */}
            <div className="space-y-6">
               <h3 className="text-lg font-black border-s-4 border-indigo-500 ps-3 flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-500" /> {isRtl ? 'سجل التدقيق والتعديلات' : 'Audit Logs & Changes'}
               </h3>
               <div className="space-y-3">
                  {auditLogs?.map(log => (
                     <div key={log.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div className="text-start flex items-center gap-4">
                           <div className="h-8 w-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-indigo-500">
                              <CheckCircle2 className="h-4 w-4" />
                           </div>
                           <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-800">
                                 {isRtl ? 'تغيير في' : 'Changed'} <span className="font-black">{log.field}</span>
                              </p>
                              <p className="text-[10px] text-slate-500">
                                 {log.oldValue} <ArrowRight className={cn("inline h-2 w-2 mx-1", isRtl && "rotate-180")} /> <span className="text-emerald-600 font-black">{log.newValue}</span>
                              </p>
                           </div>
                        </div>
                        <div className="text-end space-y-0.5">
                           <p className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'بواسطة:' : 'By:'} {log.changedByName}</p>
                           <p className="text-[9px] font-mono text-slate-400">{log.createdAt?.toDate().toLocaleDateString()}</p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

         </div>
      </PrintWrapper>
    </div>
  );
}
