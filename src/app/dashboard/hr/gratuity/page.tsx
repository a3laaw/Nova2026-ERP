'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calculator, Receipt, Info, ArrowRight, 
  Printer, UserCircle, CalendarDays, Wallet,
  ShieldCheck, AlertTriangle, Scale, History
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee } from '@/types/hr';
import { GratuityService, GratuityCalculationInput, GratuityResult, TerminationReason, NoticeType } from '@/services/gratuity-service';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { cn } from '@/lib/utils';

export default function GratuityCalculatorPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [form, setForm] = useState<GratuityCalculationInput>({
    hireDate: '',
    endDate: new Date().toISOString().split('T')[0],
    totalSalary: 0,
    reason: 'resignation',
    noticeType: 'served',
    remainingLeaveDays: 0
  });

  const [result, setResult] = useState<GratuityResult | null>(null);

  // جلب الموظفين للمقارنة
  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, 
  [db, companyId]);
  const { data: employees, loading: empsLoading } = useCollection<Employee>(empsQuery);

  // تحديث البيانات تلقائياً عند اختيار موظف
  useEffect(() => {
    if (selectedEmpId && employees) {
      const emp = employees.find(e => e.id === selectedEmpId);
      if (emp) {
        setForm(prev => ({
          ...prev,
          hireDate: emp.hireDate || '',
          totalSalary: (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0),
          remainingLeaveDays: emp.annualLeaveBalance || 0
        }));
      }
    }
  }, [selectedEmpId, employees]);

  const handleCalculate = () => {
    if (!form.hireDate || !form.endDate || form.totalSalary <= 0) return;
    const res = GratuityService.calculate(form);
    setResult(res);
  };

  const handlePrint = () => {
     window.print();
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <Scale className="h-3 w-3" /> {isRtl ? 'محرك قانون العمل الكويتي' : 'Kuwait Labor Law Engine'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'حاسبة مكافأة نهاية الخدمة' : 'Gratuity Calculator'}</h1>
           <p className="text-muted-foreground text-sm font-bold opacity-70 italic">{isRtl ? 'تحليل المستحقات المالية القانونية للموظفين' : 'Legal financial entitlements analysis'}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handlePrint}
          className="rounded-2xl border-2 h-14 px-8 font-black gap-2 hover:bg-slate-50 transition-all print:hidden"
        >
          <Printer className="h-5 w-5" /> {isRtl ? 'طباعة التقرير' : 'Print Report'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Input Form */}
        <div className="lg:col-span-4 space-y-6 print:hidden">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
                 <CardTitle className="text-lg font-black flex items-center gap-2">
                    <UserCircle className="h-5 w-5 text-primary" />
                    {isRtl ? 'بيانات الموظف' : 'Employee Details'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اختر موظفاً (اختياري)' : 'Select Employee'}</Label>
                    <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                          <SelectValue placeholder="..." />
                       </SelectTrigger>
                       <SelectContent>
                          {employees?.map(emp => (
                             <SelectItem key={emp.id} value={emp.id!} className="font-bold">{emp.fullName}</SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ التعيين' : 'Hire Date'}</Label>
                       <SmartDateInput value={form.hireDate} onChange={v => setForm({...form, hireDate: v})} />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ انتهاء الخدمة' : 'End Date'}</Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الراتب الإجمالي (د.ك)' : 'Total Salary'}</Label>
                       <Input 
                         type="number" 
                         value={form.totalSalary} 
                         onChange={e => setForm({...form, totalSalary: Number(e.target.value)})}
                         className="h-12 rounded-xl border-2 font-mono font-black text-emerald-600 text-lg" 
                       />
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'سبب انتهاء الخدمة' : 'Reason'}</Label>
                       <Select value={form.reason} onValueChange={(v: TerminationReason) => setForm({...form, reason: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="resignation" className="font-bold">{isRtl ? 'استقالة' : 'Resignation'}</SelectItem>
                             <SelectItem value="termination" className="font-bold">{isRtl ? 'إنهاء خدمة من صاحب العمل' : 'Termination'}</SelectItem>
                             <SelectItem value="retirement" className="font-bold">{isRtl ? 'تقاعد' : 'Retirement'}</SelectItem>
                             <SelectItem value="misconduct" className="font-bold text-rose-600">{isRtl ? 'فصل تأديبي (المادة 41)' : 'Misconduct'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'حالة الإنذار' : 'Notice Period'}</Label>
                       <Select value={form.noticeType} onValueChange={(v: NoticeType) => setForm({...form, noticeType: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="served" className="font-bold">{isRtl ? 'تم الالتزام بفترة الإنذار' : 'Notice Served'}</SelectItem>
                             <SelectItem value="not_served_by_employer" className="font-bold">{isRtl ? 'لم يلتزم صاحب العمل (بدل إنذار)' : 'Employer default'}</SelectItem>
                             <SelectItem value="not_served_by_employee" className="font-bold">{isRtl ? 'لم يلتزم الموظف (خصم بدل إنذار)' : 'Employee default'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'رصيد الإجازات المتبقي (أيام)' : 'Leave Balance'}</Label>
                       <Input 
                         type="number" 
                         value={form.remainingLeaveDays} 
                         onChange={e => setForm({...form, remainingLeaveDays: Number(e.target.value)})}
                         className="h-12 rounded-xl border-2 font-bold" 
                       />
                    </div>
                 </div>

                 <Button 
                   onClick={handleCalculate}
                   className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-105 transition-all mt-4"
                 >
                    <Calculator className="me-2 h-6 w-6" /> {isRtl ? 'احسب المستحقات' : 'Calculate'}
                 </Button>
              </CardContent>
           </Card>
        </div>

        {/* Right: Results Analysis */}
        <div className="lg:col-span-8">
           {result ? (
             <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                
                {/* Summary Header Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <Card className="border-0 shadow-lg rounded-[2rem] p-8 text-start bg-white border-b-8 border-emerald-500">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'صافي المستحقات' : 'Total Entitlement'}</p>
                      <h3 className="text-4xl font-black text-emerald-600">{result.totalEntitlement.toLocaleString()} <span className="text-xs">KWD</span></h3>
                   </Card>
                   <Card className="border-0 shadow-lg rounded-[2rem] p-8 text-start bg-white border-b-8 border-primary">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'مدة الخدمة' : 'Service Years'}</p>
                      <h3 className="text-3xl font-black text-slate-800">{result.serviceDuration.years} <span className="text-xs">{isRtl ? 'سنة' : 'Years'}</span></h3>
                   </Card>
                   <Card className="border-0 shadow-lg rounded-[2rem] p-8 text-start bg-white border-b-8 border-blue-500">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'الأجر اليومي' : 'Daily Wage'}</p>
                      <h3 className="text-3xl font-black text-blue-600">{result.dailyWage.toFixed(3)} <span className="text-xs">KWD</span></h3>
                   </Card>
                </div>

                {/* Detailed Breakdown */}
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                   <CardHeader className="bg-slate-50 border-b p-10 flex flex-row items-center justify-between">
                      <div className="text-start">
                         <CardTitle className="text-2xl font-black font-headline">{isRtl ? 'التحليل المالي التفصيلي' : 'Financial Breakdown'}</CardTitle>
                         <CardDescription className="font-bold">{isRtl ? 'توضيح بنود الاستحقاق بناءً على معطيات الخدمة' : 'Breakdown of entitlements based on service data'}</CardDescription>
                      </div>
                      <Receipt className="h-10 w-10 text-primary/20" />
                   </CardHeader>
                   <CardContent className="p-10 space-y-10 text-start">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                         <div className="space-y-6">
                            <h4 className="font-black text-sm text-primary uppercase border-b pb-2 flex items-center gap-2">
                               <ShieldCheck className="h-4 w-4" /> {isRtl ? 'مكافأة الخدمة' : 'Service Gratuity'}
                            </h4>
                            <div className="space-y-4">
                               <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500 font-bold">{isRtl ? 'المكافأة المستحقة (Base)' : 'Accrued Gratuity'}</span>
                                  <span className="font-black">{result.baseGratuity.toLocaleString()} KWD</span>
                               </div>
                               <div className="flex justify-between items-center text-sm p-3 bg-amber-50 rounded-xl border border-amber-100">
                                  <span className="text-amber-800 font-black flex items-center gap-2">
                                     <AlertTriangle className="h-3 w-3" /> {isRtl ? 'نسبة الاستحقاق (السبب)' : 'Entitlement Factor'}
                                  </span>
                                  <span className="font-black text-amber-700">{(result.resignationFactor * 100).toFixed(0)}%</span>
                               </div>
                               <div className="flex justify-between items-center text-lg pt-2 border-t font-black">
                                  <span className="text-slate-900">{isRtl ? 'إجمالي المكافأة الصافية' : 'Net Gratuity'}</span>
                                  <span className="text-emerald-600">{result.finalGratuity.toLocaleString()} KWD</span>
                               </div>
                            </div>
                         </div>

                         <div className="space-y-6">
                            <h4 className="font-black text-sm text-blue-600 uppercase border-b pb-2 flex items-center gap-2">
                               <Wallet className="h-4 w-4" /> {isRtl ? 'إضافات وخصومات' : 'Additional Items'}
                            </h4>
                            <div className="space-y-4">
                               <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500 font-bold">{isRtl ? 'بدل رصيد الإجازات' : 'Leave Balance Pay'}</span>
                                  <span className="font-black text-slate-700">{result.leaveBalancePay.toLocaleString()} KWD</span>
                               </div>
                               <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500 font-bold">{isRtl ? 'بدل الإنذار / الإخطار' : 'Notice Indemnity'}</span>
                                  <span className={cn("font-black", result.noticeIndemnity < 0 ? "text-rose-600" : "text-emerald-600")}>
                                     {result.noticeIndemnity.toLocaleString()} KWD
                                  </span>
                               </div>
                               {result.isCapped && (
                                 <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-[10px] font-bold text-rose-700 flex items-center gap-2">
                                    <Info className="h-3 w-3" />
                                    {isRtl ? 'ملاحظة: تم تطبيق سقف الـ 18 شهراً وفق القانون.' : 'Note: 18-month legal cap was applied.'}
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>

                      <div className="p-10 bg-slate-900 rounded-[2.5rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform">
                            <Calculator className="h-40 w-40" />
                         </div>
                         <div className="text-start space-y-1 relative z-10">
                            <p className="text-slate-400 font-black text-xs uppercase tracking-widest">{isRtl ? 'المبلغ الإجمالي المستحق للصرف' : 'Total Net Payable Amount'}</p>
                            <h2 className="text-5xl font-black font-headline text-emerald-400">{result.totalEntitlement.toLocaleString()} <span className="text-xl">KWD</span></h2>
                         </div>
                         <div className="relative z-10">
                            <div className="p-6 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10 flex flex-col items-center">
                               <p className="text-[10px] font-black uppercase text-slate-300 mb-2">{isRtl ? 'مدة الخدمة بالكامل' : 'Total Service'}</p>
                               <div className="flex items-center gap-4">
                                  <div className="text-center"><p className="text-xl font-black">{result.serviceDuration.years}</p><p className="text-[8px] uppercase text-slate-400">{isRtl ? 'سنة' : 'Y'}</p></div>
                                  <div className="w-[1px] h-8 bg-white/10" />
                                  <div className="text-center"><p className="text-xl font-black">{result.serviceDuration.months}</p><p className="text-[8px] uppercase text-slate-400">{isRtl ? 'شهر' : 'M'}</p></div>
                                  <div className="w-[1px] h-8 bg-white/10" />
                                  <div className="text-center"><p className="text-xl font-black">{result.serviceDuration.days}</p><p className="text-[8px] uppercase text-slate-400">{isRtl ? 'يوم' : 'D'}</p></div>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="pt-8 border-t space-y-4">
                         <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <Scale className="h-6 w-6 text-slate-400 shrink-0 mt-1" />
                            <div className="space-y-2">
                               <h5 className="font-black text-sm text-slate-800">{isRtl ? 'الأساس القانوني للاحتساب' : 'Legal Basis'}</h5>
                               <p className="text-xs text-slate-500 leading-relaxed font-bold">
                                  {isRtl ? 
                                    'تم الاحتساب وفقاً لقانون العمل الكويتي رقم 6 لسنة 2010. تم استخدام نظام الـ 26 يوماً لاحتساب الأجر اليومي، مع مراعاة مدد الخدمة وسقف الـ 18 شهراً للمكافأة، وتعديلات المادة 51 بخصوص التدرج في استحقاق الاستقالة.' :
                                    'Calculated as per Kuwait Labor Law No. 6 of 2010. Daily wage is based on 26 days per month, considering service tiers and 18-month gratuity cap, with resignation factor as per Art 51.'}
                               </p>
                            </div>
                         </div>
                      </div>

                   </CardContent>
                </Card>
             </div>
           ) : (
             <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-20 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100">
                <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-slate-200 shadow-sm mb-6 animate-pulse">
                   <History className="h-12 w-12" />
                </div>
                <h3 className="text-2xl font-black text-slate-400">{isRtl ? 'بانتظار إدخال البيانات' : 'Waiting for Data'}</h3>
                <p className="text-slate-300 font-bold mt-2 max-w-sm">{isRtl ? 'يرجى إكمال نموذج الاحتساب الجانبي أو اختيار موظف للبدء في تحليل المستحقات.' : 'Please complete the calculation form or select an employee to start.'}</p>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
