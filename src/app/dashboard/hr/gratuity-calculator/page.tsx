'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calculator, Receipt, Info, ArrowRight, 
  Printer, UserCircle, CalendarDays, Wallet,
  ShieldCheck, AlertTriangle, Scale, History,
  Gavel, Clock, Loader2, Sparkles
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee } from '@/types/hr';
import { 
  EmployeeSettlementInput, 
  NoticeType, 
  SettlementResult, 
  TerminationReason 
} from '@/types/settlement';
import { EndOfServiceCalculator } from '@/services/end-of-service-calculator';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { SettlementBreakdown } from '@/components/hr/settlement-breakdown';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function GratuityCalculatorPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // States
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [noticeStartDate, setNoticeStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [noticeType, setNoticeType] = useState<NoticeType>('worked');
  const [terminationReason, setTerminationReason] = useState<TerminationReason>('resignation');
  const [result, setResult] = useState<SettlementResult | null>(null);

  // Data Fetching
  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, 
  [db, companyId]);
  const { data: employees, loading: empsLoading } = useCollection<Employee>(empsQuery);

  const selectedEmployee = useMemo(() => 
    employees?.find(e => e.id === selectedEmpId), 
  [employees, selectedEmpId]);

  const handleCalculate = () => {
    if (!selectedEmployee) {
      toast({ variant: "destructive", title: isRtl ? "يرجى اختيار موظف أولاً" : "Please select an employee" });
      return;
    }

    if (!selectedEmployee.hireDate) {
      toast({ variant: "destructive", title: isRtl ? "الموظف ليس له تاريخ تعيين مسجل" : "Employee has no hire date recorded" });
      return;
    }

    const lastSalary = (selectedEmployee.basicSalary || 0) + 
                       (selectedEmployee.housingAllowance || 0) + 
                       (selectedEmployee.transportAllowance || 0);

    if (lastSalary <= 0) {
      toast({ variant: "destructive", title: isRtl ? "يجب ضبط راتب الموظف قبل الحساب" : "Employee salary must be configured" });
      return;
    }

    try {
      const input: EmployeeSettlementInput = {
        employeeId: selectedEmployee.id!,
        fullName: selectedEmployee.fullName,
        hireDate: selectedEmployee.hireDate,
        basicSalary: selectedEmployee.basicSalary || 0,
        housingAllowance: selectedEmployee.housingAllowance || 0,
        transportAllowance: selectedEmployee.transportAllowance || 0,
        otherAllowances: selectedEmployee.otherAllowances || 0,
        annualLeaveUsed: selectedEmployee.annualLeaveBalance === 30 ? 0 : 30 - (selectedEmployee.annualLeaveBalance || 30), // Example logic
        carriedLeaveDays: 0,
        terminationReason,
      };

      const calcResult = EndOfServiceCalculator.buildSettlementResult(input, noticeStartDate, noticeType);
      setResult(calcResult);
      
      toast({ title: isRtl ? "تم التحليل القانوني بنجاح" : "Legal Analysis Complete" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit border border-primary/10">
              <Scale className="h-3 w-3" /> {isRtl ? 'محرك تسوية حقوق الموظفين - Nova Flow' : 'Nova Flow Employee Settlement Engine'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight">
             {isRtl ? 'حاسبة مستحقات نهاية الخدمة' : 'Final Settlement Calculator'}
           </h1>
           <p className="text-muted-foreground text-sm font-bold opacity-70 italic">
             {isRtl ? 'حساب دقيق للمكافآت، الإجازات، وبدلات الإنذار وفق قانون العمل الكويتي.' : 'Precise calculation of gratuity, leaves, and notice based on Kuwait Labor Law.'}
           </p>
        </div>
        <div className="flex gap-4">
           <Button variant="outline" onClick={() => window.print()} className="rounded-2xl border-2 h-14 px-8 font-black gap-2 hover:bg-slate-50 print:hidden transition-all">
             <Printer className="h-5 w-5" /> {isRtl ? 'طباعة التقرير القانوني' : 'Print Legal Report'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* Input Controls */}
        <div className="lg:col-span-4 space-y-6 print:hidden">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-primary/5 border-b p-8 text-start">
                 <CardTitle className="text-lg font-black flex items-center gap-2">
                    <UserCircle className="h-5 w-5 text-primary" />
                    {isRtl ? 'بيانات الموظف والترك' : 'Employee & Exit Data'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start">
                 
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الموظف المستهدف' : 'Target Employee'}</Label>
                    <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                       <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                          <SelectValue placeholder={isRtl ? "اختر موظفاً من القائمة" : "Select from list"} />
                       </SelectTrigger>
                       <SelectContent className="rounded-2xl">
                          {empsLoading ? <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div> : 
                            employees?.map(emp => (
                             <SelectItem key={emp.id} value={emp.id!} className="font-bold">{emp.fullName}</SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                 </div>

                 {selectedEmployee && (
                    <div className="p-6 rounded-3xl bg-slate-50 border-2 border-white shadow-inner space-y-3 animate-in slide-in-from-top-2">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ التعيين' : 'Hire Date'}</span>
                          <span className="font-mono text-xs font-black text-slate-800">{selectedEmployee.hireDate}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'الراتب الشامل' : 'Gross Salary'}</span>
                          <span className="font-black text-emerald-600">{(selectedEmployee.basicSalary || 0) + (selectedEmployee.housingAllowance || 0) + (selectedEmployee.transportAllowance || 0)} KWD</span>
                       </div>
                    </div>
                 )}

                 <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تاريخ بدء الإخطار' : 'Notice Start Date'}</Label>
                       <SmartDateInput value={noticeStartDate} onChange={setNoticeStartDate} />
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'التعامل مع فترة الإنذار' : 'Notice Handling'}</Label>
                       <Select value={noticeType} onValueChange={(v: any) => setNoticeType(v)}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                             <SelectItem value="worked" className="font-bold">{isRtl ? 'استيفاء فترة الإنذار (عمل)' : 'Work during notice'}</SelectItem>
                             <SelectItem value="indemnity" className="font-bold">{isRtl ? 'إنهاء فوري (صرف بدل)' : 'Indemnity payout'}</SelectItem>
                             <SelectItem value="waived" className="font-bold">{isRtl ? 'تنازل متبادل عن المدة' : 'Waived period'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'السبب القانوني للترك' : 'Termination Reason'}</Label>
                       <Select value={terminationReason} onValueChange={(v: any) => setTerminationReason(v)}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 font-black">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                             <SelectItem value="resignation" className="font-bold">{isRtl ? 'استقالة' : 'Resignation'}</SelectItem>
                             <SelectItem value="termination" className="font-bold text-blue-600">{isRtl ? 'إنهاء خدمات (صاحب عمل)' : 'Termination'}</SelectItem>
                             <SelectItem value="end_of_contract" className="font-bold">{isRtl ? 'انتهاء عقد' : 'Contract End'}</SelectItem>
                             <SelectItem value="misconduct" className="font-bold text-rose-600">{isRtl ? 'فصل تأديبي (مادة 41)' : 'Misconduct'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <Button 
                   onClick={handleCalculate}
                   disabled={!selectedEmpId}
                   className="w-full h-20 rounded-[2rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-4 border-b-8 border-orange-700"
                 >
                    <Sparkles className="h-8 w-8" />
                    {isRtl ? 'تحليل المستحقات' : 'Analyze Now'}
                 </Button>
              </CardContent>
           </Card>

           <div className="p-8 rounded-[2.5rem] bg-amber-50/50 border-2 border-dashed border-amber-200 flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
              <p className="text-xs text-amber-800 font-bold leading-relaxed text-start">
                 {isRtl ? 'تنبيه: يتم الحساب بناءً على سياسة الـ 26 يوماً المعتمدة في Nova ERP والراتب الشامل متضمناً كافة البدلات.' : 'Note: Calculation uses 26-day policy and Gross Salary including all allowances.'}
              </p>
           </div>
        </div>

        {/* Results Analysis */}
        <div className="lg:col-span-8">
           {result ? (
             <SettlementBreakdown result={result} isRtl={isRtl} />
           ) : (
             <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-20 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 animate-pulse">
                <div className="w-32 h-32 bg-white rounded-[3rem] flex items-center justify-center text-slate-200 shadow-sm mb-8 ring-8 ring-slate-100">
                   <Calculator className="h-16 w-16" />
                </div>
                <h3 className="text-3xl font-black text-slate-400">{isRtl ? 'بانتظار تحديد الموظف' : 'Waiting for Selection'}</h3>
                <p className="text-slate-300 font-bold mt-3 max-w-sm">
                  {isRtl ? 'قم باختيار الموظف ونوع الإنذار من القائمة الجانبية لبدء المحاكاة القانونية للمستحقات.' : 'Select an employee and notice type to start the legal simulation.'}
                </p>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
