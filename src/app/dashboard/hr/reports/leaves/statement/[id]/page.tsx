'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, ShieldCheck, Printer,
  Scale, Info, TrendingUp, TrendingDown, History,
  CalendarDays, Calculator, ArrowLeft
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee, LeaveRequest } from '@/types/hr';
import { WorkHoursSettings } from '@/types/work-hours';
import { WorkHoursService } from '@/services/work-hours-service';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { format, parseISO, addMonths, startOfMonth, isBefore } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export default function LeaveStatementPage() {
  const empId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [settings, setSettings] = useState<WorkHoursSettings | null>(null);

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

  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), where('userId', '==', empId)) : null, 
  [db, companyId, empId]);
  const { data: rawLeaves } = useCollection<LeaveRequest>(leavesQuery);

  /**
   * محرك بناء "كشف حساب رصيد الإجازات" (Leave Ledger)
   */
  const leaveLedger = useMemo(() => {
    if (!employee?.hireDate || !settings) return [];
    
    const ledger: any[] = [];
    let runningBalance = 0;
    const hireDate = parseISO(employee.hireDate);
    if (hireDate.getFullYear() < 100) hireDate.setFullYear(hireDate.getFullYear() + 2000);

    const today = new Date();
    const approvedLeaves = rawLeaves
      .filter(l => ['approved', 'on-leave', 'returned'].includes(l.status))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    let currentMonth = startOfMonth(hireDate);
    
    // محاكاة الاستحقاقات الشهرية والخصومات
    while (isBefore(currentMonth, today) || format(currentMonth, 'yyyy-MM') === format(today, 'yyyy-MM')) {
      const monthKey = format(currentMonth, 'yyyy-MM');
      const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: isRtl ? ar : enUS }).replace('0026', '2026');

      // إضافة الاستحقاق الشهري (ائتمان)
      runningBalance += 2.5;
      ledger.push({
        date: format(currentMonth, 'yyyy-MM-01'),
        type: 'accrual',
        description: isRtl ? `استحقاق شهري (${monthLabel})` : `Monthly Accrual (${monthLabel})`,
        basis: isRtl ? 'المادة 70 (2.5 يوم/شهر)' : 'Art. 70 (2.5d/mo)',
        change: 2.5,
        balance: Math.round(runningBalance * 100) / 100
      });

      // معالجة الإجازات التي بدأت في هذا الشهر (خصم)
      const monthsLeaves = approvedLeaves.filter(l => l.startDate.startsWith(monthKey));
      monthsLeaves.forEach(l => {
        runningBalance -= (l.workingDays || 0);
        ledger.push({
          date: l.startDate,
          type: 'deduction',
          description: isRtl ? `إجازة ${l.type}` : `${l.type} Leave`,
          basis: isRtl ? `فترة: ${l.startDate} إلى ${l.endDate}` : `Period: ${l.startDate} to ${l.endDate}`,
          change: -(l.workingDays || 0),
          balance: Math.round(runningBalance * 100) / 100
        });
      });

      currentMonth = addMonths(currentMonth, 1);
    }

    return ledger.sort((a, b) => b.date.localeCompare(a.date) || (a.type === 'accrual' ? 1 : -1));
  }, [employee, rawLeaves, settings, isRtl]);

  if (empLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!employee) return <div className="p-20 text-center">{isRtl ? 'الموظف غير موجود' : 'Employee not found'}</div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
             <ArrowLeft className={cn("h-5 w-5", isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline">{isRtl ? 'كشف حركة رصيد الإجازات' : 'Detailed Leave Ledger'}</h1>
             <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                <Scale className="h-3 w-3 text-primary" /> {isRtl ? 'تقرير مالي قانوني (المادة 70)' : 'Legal Statutory Report (Art. 70)'}
             </p>
           </div>
        </div>
        <Button onClick={() => window.print()} className="rounded-2xl h-14 px-8 font-black gap-2 bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 transition-all">
           <Printer className="h-5 w-5" /> {isRtl ? 'طباعة الكشف الرسمي' : 'Print Official Ledger'}
        </Button>
      </div>

      <PrintWrapper title={isRtl ? "كشف حساب رصيد الإجازات السنوية" : "Statement of Annual Leave Balance"}>
         <div className="space-y-10">
            {/* Employee Banner */}
            <div className="p-10 rounded-[2.5rem] bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
               <div className="text-start flex items-center gap-6">
                  <div className="h-20 w-20 rounded-2xl bg-white/10 flex items-center justify-center text-primary font-black text-2xl border border-white/10">
                     {employee.employeeNumber}
                  </div>
                  <div>
                     <h2 className="text-3xl font-black">{employee.fullName}</h2>
                     <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-xs">{employee.jobTitle} | {employee.departmentName}</p>
                     <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full w-fit">
                        <CalendarDays className="h-3 w-3" /> {isRtl ? 'تاريخ التعيين:' : 'Hire Date:'} {employee.hireDate}
                     </div>
                  </div>
               </div>
               <div className="bg-white/5 p-8 rounded-3xl border border-white/10 text-center min-w-[200px]">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{isRtl ? 'الرصيد الختامي الحالي' : 'Net Final Balance'}</p>
                  <p className="text-5xl font-black text-emerald-400 font-mono">{leaveLedger.length > 0 ? leaveLedger[0].balance : 0}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{isRtl ? 'يوم مستحق' : 'Accrued Days'}</p>
               </div>
            </div>

            {/* Explanatory Note */}
            <div className="p-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-start gap-4 text-start">
               <Info className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
               <div className="space-y-1">
                  <h5 className="font-black text-blue-800 text-sm">{isRtl ? 'منهجية الحساب (المادة 70)' : 'Calculation Methodology (Art. 70)'}</h5>
                  <p className="text-xs text-blue-700/70 leading-relaxed font-bold">
                    {isRtl 
                      ? 'يتم إضافة 2.5 يوم رصيد لكل شهر عمل فعلي منذ تاريخ التعيين. الخصم يتم فقط عند القيام بإجازات معتمدة وبناءً على "أيام العمل الصافية" (باستبعاد الجمعة والعطلات الرسمية) وفق نص القانون.' 
                      : '2.5 days are added for each full month of service. Deductions are made only for approved leaves based on "Net Working Days" (excluding weekends/holidays) per Kuwait Labor Law.'}
                  </p>
               </div>
            </div>

            {/* Ledger Table */}
            <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-sm bg-white">
               <table className="w-full text-sm text-start">
                  <thead className="bg-slate-50 border-b">
                     <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                        <th className="p-6 text-start">{isRtl ? 'التاريخ' : 'Date'}</th>
                        <th className="p-6 text-start">{isRtl ? 'نوع العملية / الملاحظة' : 'Transaction'}</th>
                        <th className="p-6 text-start">{isRtl ? 'الأساس / المرجعية' : 'Legal Basis'}</th>
                        <th className="p-6 text-center">{isRtl ? 'الحركة' : 'Change'}</th>
                        <th className="p-6 text-center">{isRtl ? 'الرصيد التراكمي' : 'Balance'}</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {leaveLedger.map((row: any, i: number) => (
                        <tr key={i} className={cn("hover:bg-slate-50/50 transition-colors", row.type === 'accrual' ? "bg-emerald-50/10" : "bg-rose-50/5")}>
                           <td className="p-6 font-mono text-xs text-slate-500">{row.date}</td>
                           <td className="p-6 font-black text-slate-800">
                              <div className="flex items-center gap-2">
                                 {row.type === 'accrual' ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-rose-500" />}
                                 {row.description}
                              </div>
                           </td>
                           <td className="p-6 text-xs font-bold text-slate-400 italic">{row.basis}</td>
                           <td className="p-6 text-center">
                              <Badge className={cn(
                                "font-black border-0 px-3",
                                row.change > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              )}>
                                 {row.change > 0 ? `+${row.change}` : row.change}
                              </Badge>
                           </td>
                           <td className="p-6 text-center">
                              <span className="font-black text-slate-900 bg-slate-100 px-4 py-1.5 rounded-full font-mono text-lg shadow-inner">
                                 {row.balance}
                              </span>
                           </td>
                        </tr>
                     ))}
                     {!leaveLedger.length && 
                       <tr><td colSpan={5} className="p-32 text-center italic text-slate-300 font-bold">{isRtl ? 'لا يوجد حركات مسجلة للرصيد بعد.' : 'No balance movement recorded.'}</td></tr>
                     }
                  </tbody>
               </table>
            </div>

            {/* Validation Footer */}
            <div className="flex justify-between items-end pt-12 mt-12 border-t-2 border-dashed border-slate-100">
               <div className="text-start space-y-8">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'توقيع الموظف بالمطابقة' : 'Employee Confirmation'}</p>
                     <div className="h-10 w-48 border-b border-slate-200" />
                  </div>
               </div>
               <div className="text-center space-y-4">
                  <div className="h-24 w-24 rounded-full border-4 border-slate-50 flex items-center justify-center mx-auto">
                     <ShieldCheck className="h-12 w-12 text-slate-100" />
                  </div>
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">{isRtl ? 'ختم إدارة الموارد البشرية' : 'HR Dept Official Stamp'}</p>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}