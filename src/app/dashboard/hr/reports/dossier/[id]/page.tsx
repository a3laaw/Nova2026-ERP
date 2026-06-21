'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, ShieldCheck, Printer,
  User, Calendar, Clock, Calculator, History,
  HardHat, MapPin, CheckCircle2, Phone, Mail,
  Package, Boxes, Truck, RotateCcw, PackageCheck
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee, AttendanceRecord, LeaveRequest, EmployeeAuditLog } from '@/types/hr';
import { WorkHoursSettings } from '@/types/work-hours';
import { WorkHoursService } from '@/services/work-hours-service';
import { WorkingDaysService } from '@/services/working-days-service';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export default function EmployeeDossierPage() {
  const empId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);

  // جلب إعدادات العمل للحسابات القانونية
  useEffect(() => {
    if (db && companyId) {
      const whService = new WorkHoursService(db, companyId);
      whService.getSettings().then(setSettings);
    }
  }, [db, companyId]);

  const empRef = useMemo(() => 
    companyId && db ? doc(db, paths.employees(companyId), empId) : null, 
  [db, companyId, empId]);
  const { data: employee, loading: empLoading } = useDoc<Employee>(empRef);

  const attendanceQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.attendance(companyId)), where('employeeId', '==', empId)) : null, 
  [db, companyId, empId]);
  
  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), where('userId', '==', empId)) : null, 
  [db, companyId, empId]);
  
  const assetsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.assetAssignments(companyId)), where('employeeId', '==', empId), where('status', '==', 'in-use')) : null, 
  [db, companyId, empId]);

  const { data: rawAttendance } = useCollection<AttendanceRecord>(attendanceQuery);
  const { data: rawLeaves } = useCollection<LeaveRequest>(leavesQuery);
  const { data: assets } = useCollection<any>(assetsQuery);

  const attendance = useMemo(() => [...rawAttendance].sort((a, b) => b.date.localeCompare(a.date)), [rawAttendance]);

  // تجميع إحصائيات الحضور شهرياً
  const monthlyAttendanceStats = useMemo(() => {
    const groups: Record<string, any> = {};
    attendance.forEach(rec => {
      try {
        const date = parseISO(rec.date);
        const key = format(date, 'yyyy-MM');
        if (!groups[key]) {
          groups[key] = {
            monthKey: key,
            label: format(date, 'MMMM yyyy', { locale: isRtl ? ar : enUS }),
            present: 0,
            late: 0,
            absent: 0,
            lateMins: 0
          };
        }
        if (rec.status === 'present') groups[key].present++;
        if (rec.status === 'late') {
          groups[key].late++;
          groups[key].lateMins += (rec.minutesLate || 0);
        }
        if (rec.status === 'absent') groups[key].absent++;
      } catch (e) {
        console.error("Date parsing error in dossier", e);
      }
    });
    return Object.values(groups).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [attendance, isRtl]);

  // حساب رصيد الإجازات السنوية التراكمي (Running Balance)
  const leavesWithBalance = useMemo(() => {
    if (!employee?.hireDate || !settings || !rawLeaves.length) {
      return [...rawLeaves].sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
    
    const wdService = new WorkingDaysService(settings);
    const approvedSorted = [...rawLeaves]
      .filter(l => l.status === 'approved')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
      
    let cumulativeTaken = 0;
    const balancedMap = new Map();

    approvedSorted.forEach(l => {
      cumulativeTaken += (l.workingDays || 0);
      const accruedAtThatPoint = wdService.calculateAccruedLeave(employee.hireDate, l.endDate);
      const balanceAfter = Math.round((accruedAtThatPoint - cumulativeTaken) * 100) / 100;
      balancedMap.set(l.id, balanceAfter);
    });

    return [...rawLeaves].map(l => ({
      ...l,
      runningBalance: balancedMap.get(l.id) || null
    })).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [rawLeaves, employee, settings]);

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
                <ShieldCheck className="h-3 w-3 text-emerald-500" /> {isRtl ? 'بيانات معتمدة وموثقة' : 'Verified Personnel Data'}
             </p>
           </div>
        </div>
        <Button onClick={() => window.print()} className="rounded-2xl h-14 px-8 font-black gap-2 bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 transition-all">
           <Printer className="h-5 w-5" /> {isRtl ? 'طباعة الملف الكامل' : 'Print Full Dossier'}
        </Button>
      </div>

      <PrintWrapper title={isRtl ? "سجل تاريخي للموظف" : "Comprehensive Employee Record"}>
         <div className="space-y-12">
            
            {/* Header / ID Section */}
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
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'الرصيد الحالي المستحق' : 'Current Accrued Balance'}</p>
                  <p className="text-4xl font-black text-emerald-600 font-mono">{employee.annualLeaveBalance || 0} <span className="text-xs">{isRtl ? 'يوم' : 'Days'}</span></p>
                  <Badge className={cn("mt-4 font-black uppercase", employee.status === 'active' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                     {employee.status}
                  </Badge>
               </div>
            </div>

            {/* Assets Section */}
            <div className="space-y-6 text-start">
               <h3 className="text-lg font-black border-s-4 border-amber-500 ps-3 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-amber-500" /> {isRtl ? 'العهد والمعدات الحالية (في عهدته)' : 'Current Assigned Assets'}
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets && assets.length > 0 ? (
                    assets.map((asset: any) => (
                      <div key={asset.id} className="p-5 rounded-2xl bg-white border-2 border-slate-50 shadow-sm flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
                              <Package className="h-5 w-5" />
                           </div>
                           <div className="text-start">
                              <p className="font-black text-sm text-slate-800">{asset.itemName}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">{asset.quantity} {isRtl ? 'وحدة' : 'Unit'}</p>
                           </div>
                        </div>
                        <div className="text-end">
                           <span className="text-[8px] font-black text-slate-300 block mb-1 uppercase tracking-tighter">Assigned At</span>
                           <span className="text-[9px] font-mono font-bold text-slate-500">{asset.assignedAt?.toDate().toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                       <PackageCheck className="h-10 w-10 text-slate-200 mb-2" />
                       <p className="text-xs font-bold text-slate-400 italic">{isRtl ? 'ذمة الموظف خالية من العهد حالياً.' : 'No active assets in possession.'}</p>
                    </div>
                  )}
               </div>
            </div>

            {/* Monthly Attendance Analysis Table */}
            <div className="space-y-6 text-start">
               <h3 className="text-lg font-black border-s-4 border-primary ps-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> {isRtl ? 'تحليل الحضور والغياب الشهري' : 'Monthly Attendance Analysis'}
               </h3>
               <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-sm text-start">
                     <thead className="bg-slate-50 border-b">
                        <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                           <th className="p-6 text-start">{isRtl ? 'الشهر' : 'Month'}</th>
                           <th className="p-6 text-center">{isRtl ? 'أيام الحضور' : 'Present'}</th>
                           <th className="p-6 text-center">{isRtl ? 'حالات التأخير' : 'Late'}</th>
                           <th className="p-6 text-center">{isRtl ? 'أيام الغياب' : 'Absent'}</th>
                           <th className="p-6 text-center">{isRtl ? 'إجمالي التأخير (د)' : 'Total Late Mins'}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {monthlyAttendanceStats.map((m: any) => (
                           <tr key={m.monthKey} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-6 font-black text-slate-800">{m.label}</td>
                              <td className="p-6 text-center">
                                 <span className="font-black text-emerald-600 text-lg">{m.present}</span>
                              </td>
                              <td className="p-6 text-center">
                                 <span className={cn("font-black text-lg", m.late > 0 ? "text-amber-600" : "text-slate-300")}>{m.late}</span>
                              </td>
                              <td className="p-6 text-center">
                                 <span className={cn("font-black text-lg", m.absent > 0 ? "text-rose-600" : "text-slate-300")}>{m.absent}</span>
                              </td>
                              <td className="p-6 text-center">
                                 <Badge variant="secondary" className={cn(
                                   "font-mono font-black border-0",
                                   m.lateMins > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-300"
                                 )}>
                                    {m.lateMins}
                                 </Badge>
                              </td>
                           </tr>
                        ))}
                        {!monthlyAttendanceStats.length && 
                          <tr><td colSpan={5} className="p-20 text-center italic text-slate-300 font-bold">{isRtl ? 'لا يوجد سجلات حضور مسجلة لهذا الموظف.' : 'No attendance records found.'}</td></tr>
                        }
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Leave History Table */}
            <div className="space-y-6 text-start">
               <h3 className="text-lg font-black border-s-4 border-blue-500 ps-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" /> {isRtl ? 'تاريخ الإجازات السنوية والرصيد' : 'Leave History & Balances'}
               </h3>
               <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-sm text-start">
                     <thead className="bg-slate-50 border-b">
                        <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                           <th className="p-6 text-start">{isRtl ? 'النوع' : 'Type'}</th>
                           <th className="p-6 text-start">{isRtl ? 'الفترة الزمنية' : 'Period'}</th>
                           <th className="p-6 text-center">{isRtl ? 'الأيام المخصومة' : 'Deducted'}</th>
                           <th className="p-6 text-center">{isRtl ? 'الرصيد المتبقي' : 'Running Balance'}</th>
                           <th className="p-6 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {leavesWithBalance?.map((l: any) => (
                           <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-6">
                                 <Badge variant="outline" className="font-black uppercase text-[9px] border-2">{l.type}</Badge>
                              </td>
                              <td className="p-6 font-mono text-xs text-slate-500">{l.startDate} → {l.endDate}</td>
                              <td className="p-6 text-center font-black text-slate-700">{l.workingDays}</td>
                              <td className="p-6 text-center">
                                 {l.runningBalance !== null ? (
                                    <span className="font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">
                                       {l.runningBalance}
                                    </span>
                                 ) : <span className="text-slate-300">---</span>}
                              </td>
                              <td className="p-6">
                                 <Badge variant="secondary" className={cn(
                                    "text-[9px] font-black uppercase",
                                    l.status === 'approved' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                                 )}>
                                    {l.status}
                                 </Badge>
                              </td>
                           </tr>
                        ))}
                        {!leavesWithBalance?.length && 
                          <tr><td colSpan={5} className="p-20 text-center italic text-slate-300 font-bold">{isRtl ? 'لا يوجد سجلات إجازات لهذا الموظف.' : 'No leave records found.'}</td></tr>
                        }
                     </tbody>
                  </table>
               </div>
            </div>

         </div>
      </PrintWrapper>
    </div>
  );
}
