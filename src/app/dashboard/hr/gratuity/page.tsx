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
  ShieldCheck, AlertTriangle, Scale, History,
  Gavel, Clock, Loader2
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Employee } from '@/types/hr';
import { GratuityService, GratuityCalculationInput, GratuityResult, TerminationReason, NoticeType } from '@/services/gratuity-service';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { cn } from '@/lib/utils';

export default function GratuityCalculatorPage() {
  const { globalUser } = useAuthContext();
  const { t, tSafe, lang, dir } = useLanguage();
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

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId))) : null, 
  [db, companyId]);
  
  const { data: employees, loading: empsLoading } = useCollection<Employee>(empsQuery);

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

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-700 text-start" dir={dir}>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <Scale className="h-3 w-3" /> {tSafe('hr.gratuity.engineTitle', 'محرك حساب المكافأة', 'Gratuity Engine')}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{tSafe('hr.gratuity.calculatorTitle', 'مستحقات نهاية الخدمة', 'End of Service')}</h1>
           <p className="text-muted-foreground text-sm font-bold opacity-70 italic">
             {tSafe('hr.gratuity.strictApplication', 'تطبيق صارم لقانون العمل الكويتي وقاعدة الـ 26 يوماً.', 'Strict application of Kuwait Labor Law and the 26-day rule.')}
           </p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="rounded-2xl border-2 h-14 px-8 font-black gap-2 hover:bg-slate-50 transition-all print:hidden">
          <Printer className="h-5 w-5" /> {tSafe('hr.gratuity.printLegal', 'طباعة الكشف القانوني', 'Print Legal Statement')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className="lg:col-span-4 space-y-6 print:hidden text-start">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <CardTitle className="text-lg font-black flex items-center gap-2">
                    <UserCircle className="h-5 w-5 text-primary" />
                    {tSafe('hr.gratuity.serviceData', 'بيانات الخدمة', 'Service Data')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('hr.reports.dossierSearch', 'البحث بالسجل', 'Search Dossier')}</Label>
                    <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                          <SelectValue placeholder={tSafe('hr.selectEmployee', 'اختر الموظف...', 'Select Employee...')} />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl border-2 shadow-2xl z-[200]">
                          {empsLoading ? <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div> : 
                            employees?.map(emp => (
                             <SelectItem key={emp.id} value={emp.id!} className="font-bold py-3">{emp.fullName}</SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('hr.hireDate')}</Label>
                       <SmartDateInput value={form.hireDate} onChange={v => setForm({...form, hireDate: v})} />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ نهاية الخدمة' : 'End Date'}</Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الراتب الإجمالي الأخير' : 'Last Gross Salary'}</Label>
                       <div className="relative">
                          <Input 
                            type="number" 
                            value={form.totalSalary} 
                            readOnly
                            className="h-12 rounded-xl border-2 font-black text-emerald-600 text-lg bg-slate-50 cursor-not-allowed text-center" 
                          />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'سبب انتهاء الخدمة' : 'Exit Reason'}</Label>
                       <Select value={form.reason} onValueChange={(v: TerminationReason) => setForm({...form, reason: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2 shadow-2xl z-[200]">
                             <SelectItem value="resignation" className="font-bold py-3">استقالة</SelectItem>
                             <SelectItem value="termination" className="font-bold py-3">إنهاء خدمة من صاحب العمل</SelectItem>
                             <SelectItem value="retirement" className="font-bold py-3">تقاعد</SelectItem>
                             <SelectItem value="misconduct" className="font-bold py-3 text-rose-600">فصل تأديبي (مادة 41)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'فترة الإنذار' : 'Notice Period'}</Label>
                       <Select value={form.noticeType} onValueChange={(v: NoticeType) => setForm({...form, noticeType: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2 shadow-2xl z-[200]">
                             <SelectItem value="served" className="font-bold py-3">تم العمل خلال المهلة</SelectItem>
                             <SelectItem value="not_served_by_employer" className="font-bold py-3">إنهاء فوري (يدفع صاحب العمل)</SelectItem>
                             <SelectItem value="not_served_by_employee" className="font-bold py-3">ترك فوري (يخصم من الموظف)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <Button onClick={handleCalculate} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all mt-4 border-b-8 border-orange-700">
                    <Calculator className="me-2 h-6 w-6" /> {tSafe('inline.calculate.now', 'حساب الاستحقاقات', 'Calculate Now')}
                 </Button>
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-8">
           {result ? (
             <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-start">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-white border-b-8 border-emerald-500 ring-1 ring-black/5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي مستحقات التصفية' : 'Total Net Entitlement'}</p>
                      <h3 className="text-4xl font-black text-emerald-600">{result.totalEntitlement.toLocaleString()} <span className="text-xs">KWD</span></h3>
                   </Card>
                   <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-white border-b-8 border-primary ring-1 ring-black/5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'مدة الخدمة' : 'Service Duration'}</p>
                      <h3 className="text-3xl font-black text-slate-800">{result.serviceDuration.years} {isRtl ? 'سنة' : 'Y'} {result.serviceDuration.months} {isRtl ? 'شهر' : 'M'}</h3>
                   </Card>
                   <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-8 border-b-8 border-blue-500 ring-1 ring-black/5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'نسبة استحقاق المكافأة' : 'Payout Ratio'}</p>
                      <h3 className="text-3xl font-black text-blue-600">{(result.resignationFactor * 100).toFixed(0)}%</h3>
                   </Card>
                </div>

                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                   <CardHeader className="bg-slate-50 border-b p-10 flex flex-row items-center justify-between">
                      <div className="text-start">
                         <CardTitle className="text-2xl font-black font-headline">{isRtl ? 'تفاصيل الاحتساب النقدي' : 'Financial Breakdown'}</CardTitle>
                         <CardDescription className="font-bold italic">{isRtl ? 'تحليل البنود وفق قاعدة الـ 26 يوماً القانونية.' : 'Itemized analysis based on the 26-day legal rule.'}</CardDescription>
                      </div>
                      <Gavel className="h-10 w-10 text-primary/20" />
                   </CardHeader>
                   <CardContent className="p-10 space-y-10 text-start">
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                         <div className="space-y-6">
                            <h4 className="font-black text-sm text-primary uppercase border-b pb-2 flex items-center gap-2">
                               <ShieldCheck className="h-4 w-4" /> {isRtl ? 'مكافأة نهاية الخدمة' : 'End of Service Benefit'}
                            </h4>
                            <div className="space-y-4">
                               <div className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-slate-500">{isRtl ? 'المبلغ الأساسي' : 'Base Amount'}</span>
                                  <span className="font-black">{result.baseGratuity.toLocaleString()} KWD</span>
                               </div>
                               <div className="flex justify-between items-center text-sm font-black p-4 bg-amber-50 rounded-2xl border-2 border-white shadow-inner text-amber-800">
                                  <span>{isRtl ? 'معامل الاستحقاق (الاستقالة)' : 'Factor (Resignation)'}</span>
                                  <span>x {(result.resignationFactor).toFixed(2)}</span>
                               </div>
                               <div className="flex justify-between items-center text-lg pt-4 border-t font-black text-emerald-600">
                                  <span>{isRtl ? 'المكافأة النهائية' : 'Final Benefit'}</span>
                                  <span>{result.finalGratuity.toLocaleString()} KWD</span>
                               </div>
                            </div>
                         </div>

                         <div className="space-y-6">
                            <h4 className="font-black text-sm text-blue-600 uppercase border-b pb-2 flex items-center gap-2">
                               <Wallet className="h-4 w-4" /> {isRtl ? 'التسويات والبدلات النقدية' : 'Adjustments & Payouts'}
                            </h4>
                            <div className="space-y-6">
                               <div className="flex justify-between items-start text-sm font-bold p-5 bg-blue-50/50 rounded-[1.5rem] border-2 border-white shadow-sm">
                                  <div className="text-start">
                                     <span className="font-black text-slate-800 block">{isRtl ? 'مقابل رصيد الإجازات' : 'Leave Balance Pay'}</span>
                                     <span className="text-[9px] text-primary uppercase font-black">قاعدة الـ 26 يوماً (أجر يومي: {result.dailyWage.toFixed(3)})</span>
                                  </div>
                                  <div className="text-end">
                                     <span className="font-black text-blue-600 text-lg">{result.leaveBalancePay.toLocaleString()} KWD</span>
                                     <div className="text-[9px] text-muted-foreground font-bold">{result.accruedLeaveDays} {t('common.days')}</div>
                                  </div>
                               </div>
                               <div className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-slate-500">{isRtl ? 'بدل مهلة الإنذار' : 'Notice Indemnity'}</span>
                                  <span className={cn("font-black", result.noticeIndemnity < 0 ? "text-rose-600" : "text-emerald-600")}>
                                     {result.noticeIndemnity.toLocaleString()} KWD
                                  </span>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner space-y-4">
                         <h5 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <History className="h-3 w-3" /> {isRtl ? 'الملاحظات النظامية' : 'Legal Compliance Notes'}
                         </h5>
                         <div className="space-y-2">
                            {result.legalNotes.map((note, i) => (
                               <div key={i} className="text-xs font-bold text-slate-600 flex items-center gap-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" /> 
                                  <span>{note}</span>
                               </div>
                            ))}
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
           ) : (
             <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-20 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 animate-pulse">
                <Calculator className="h-24 w-24 text-slate-200 mb-6" />
                <h3 className="text-2xl font-black text-slate-400 uppercase tracking-[0.3em]">{isRtl ? 'بانتظار اختيار الموظف' : 'Select Employee to Start'}</h3>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
