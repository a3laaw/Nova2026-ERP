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
  Gavel, Clock
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

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, 
  [db, companyId]);
  const { data: employees } = useCollection<Employee>(empsQuery);

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
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <Scale className="h-3 w-3" /> {isRtl ? 'محرك الامتثال لقانون العمل الكويتي' : 'Kuwait Labor Law Engine'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'حاسبة المستحقات النهائية' : 'Gratuity & Indemnity Calc'}</h1>
           <p className="text-muted-foreground text-sm font-bold opacity-70 italic">
             {isRtl ? 'تطبيق دقيق للمواد 41، 44، 51، و53 من قانون العمل.' : 'Strict application of Art 41, 44, 51, and 53.'}
           </p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="rounded-2xl border-2 h-14 px-8 font-black gap-2 hover:bg-slate-50 transition-all print:hidden">
          <Printer className="h-5 w-5" /> {isRtl ? 'طباعة التقرير القانوني' : 'Print Legal Report'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Input Form */}
        <div className="lg:col-span-4 space-y-6 print:hidden text-start">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <CardTitle className="text-lg font-black flex items-center gap-2">
                    <UserCircle className="h-5 w-5 text-primary" />
                    {isRtl ? 'بيانات الخدمة' : 'Service Data'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الموظف' : 'Employee'}</Label>
                    <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
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
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ الانتهاء' : 'End Date'}</Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الراتب الشامل (د.ك)' : 'Gross Salary'}</Label>
                       <Input 
                         type="number" 
                         value={form.totalSalary} 
                         onChange={e => setForm({...form, totalSalary: Number(e.target.value)})}
                         className="h-12 rounded-xl border-2 font-black text-emerald-600 text-lg" 
                       />
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'السبب القانوني' : 'Legal Reason'}</Label>
                       <Select value={form.reason} onValueChange={(v: TerminationReason) => setForm({...form, reason: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="resignation" className="font-bold">{isRtl ? 'استقالة' : 'Resignation'}</SelectItem>
                             <SelectItem value="termination" className="font-bold">{isRtl ? 'إنهاء (صاحب العمل)' : 'Employer Termination'}</SelectItem>
                             <SelectItem value="retirement" className="font-bold">{isRtl ? 'تقاعد' : 'Retirement'}</SelectItem>
                             <SelectItem value="misconduct" className="font-bold text-rose-600">{isRtl ? 'فصل تأديبي (مادة 41)' : 'Misconduct'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'فترة الإنذار (90 يوماً)' : 'Notice Period (90 Days)'}</Label>
                       <Select value={form.noticeType} onValueChange={(v: NoticeType) => setForm({...form, noticeType: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="served" className="font-bold">{isRtl ? 'تم الالتزام بـ 3 أشهر' : 'Notice Served (3M)'}</SelectItem>
                             <SelectItem value="not_served_by_employer" className="font-bold">{isRtl ? 'مخالفة صاحب العمل (بدل)' : 'Employer Breach'}</SelectItem>
                             <SelectItem value="not_served_by_employee" className="font-bold">{isRtl ? 'مخالفة الموظف (خصم)' : 'Employee Breach'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <Button onClick={handleCalculate} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-105 transition-all mt-4">
                    <Calculator className="me-2 h-6 w-6" /> {isRtl ? 'تحليل المستحقات' : 'Analyze Now'}
                 </Button>
              </CardContent>
           </Card>
        </div>

        {/* Right: Results Analysis */}
        <div className="lg:col-span-8">
           {result ? (
             <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-start">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-white border-b-8 border-emerald-500">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'صافي المبلغ المصروف' : 'Final Net Amount'}</p>
                      <h3 className="text-4xl font-black text-emerald-600">{result.totalEntitlement.toLocaleString()} <span className="text-xs">KWD</span></h3>
                   </Card>
                   <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-white border-b-8 border-primary">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'مدة الخدمة الفعلية' : 'Service Years'}</p>
                      <h3 className="text-3xl font-black text-slate-800">{result.serviceDuration.years} <span className="text-xs">{isRtl ? 'سنة' : 'Y'}</span> {result.serviceDuration.months} <span className="text-xs">{isRtl ? 'شهر' : 'M'}</span></h3>
                   </Card>
                   <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-white border-b-8 border-blue-500">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'استحقاق الاستقالة' : 'Resignation Factor'}</p>
                      <h3 className="text-3xl font-black text-blue-600">{(result.resignationFactor * 100).toFixed(0)}%</h3>
                   </Card>
                </div>

                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                   <CardHeader className="bg-slate-50 border-b p-10 flex flex-row items-center justify-between">
                      <div>
                         <CardTitle className="text-2xl font-black font-headline">{isRtl ? 'تفصيل المستحقات القانونية' : 'Legal Breakdown'}</CardTitle>
                         <CardDescription className="font-bold italic">{isRtl ? 'تحليل البنود وفقاً لقانون العمل' : 'Itemized analysis based on Labor Law'}</CardDescription>
                      </div>
                      <Gavel className="h-10 w-10 text-primary/20" />
                   </CardHeader>
                   <CardContent className="p-10 space-y-10">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                         <div className="space-y-6">
                            <h4 className="font-black text-sm text-primary uppercase border-b pb-2 flex items-center gap-2">
                               <ShieldCheck className="h-4 w-4" /> {isRtl ? 'مكافأة الخدمة (المادة 51)' : 'Gratuity (Art 51)'}
                            </h4>
                            <div className="space-y-4">
                               <div className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-slate-500">{isRtl ? 'رصيد المكافأة المتراكم' : 'Accumulated Gratuity'}</span>
                                  <span>{result.baseGratuity.toLocaleString()} KWD</span>
                               </div>
                               <div className="flex justify-between items-center text-sm font-black p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800">
                                  <span>{isRtl ? 'عامل المادة 53 (تدرج السنوات)' : 'Art 53 Tier Factor'}</span>
                                  <span>x {(result.resignationFactor).toFixed(2)}</span>
                               </div>
                               <div className="flex justify-between items-center text-lg pt-2 border-t font-black text-emerald-600">
                                  <span>{isRtl ? 'صافي المكافأة المستحقة' : 'Net Gratuity'}</span>
                                  <span>{result.finalGratuity.toLocaleString()} KWD</span>
                               </div>
                            </div>
                         </div>

                         <div className="space-y-6">
                            <h4 className="font-black text-sm text-blue-600 uppercase border-b pb-2 flex items-center gap-2">
                               <Wallet className="h-4 w-4" /> {isRtl ? 'الإنذار والتسويات' : 'Notice & Adjustments'}
                            </h4>
                            <div className="space-y-4">
                               <div className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-slate-500">{isRtl ? 'بدل الإنذار (90 يوماً)' : 'Notice Indemnity (90D)'}</span>
                                  <span className={cn("font-black", result.noticeIndemnity < 0 ? "text-rose-600" : "text-emerald-600")}>
                                     {result.noticeIndemnity.toLocaleString()} KWD
                                  </span>
                               </div>
                               <div className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-slate-500">{isRtl ? 'رصيد الإجازات المتبقي' : 'Leave Balance Pay'}</span>
                                  <span>{result.leaveBalancePay.toLocaleString()} KWD</span>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="p-8 bg-slate-50 rounded-3xl border-2 space-y-4">
                         <h5 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <History className="h-3 w-3" /> {isRtl ? 'ملاحظات التدقيق القانوني' : 'Legal Audit Logs'}
                         </h5>
                         <div className="space-y-2">
                            {result.legalNotes.map((note, i) => (
                               <p key={i} className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {note}
                                </p>
                            ))}
                         </div>
                      </div>

                      <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200 flex items-start gap-4">
                         <Clock className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                         <div className="space-y-1">
                            <h6 className="font-black text-sm text-amber-800">{isRtl ? 'حقوق العامل خلال فترة الإنذار' : 'Worker Rights During Notice'}</h6>
                            <p className="text-xs text-amber-700 leading-relaxed font-bold">
                               {isRtl 
                                 ? 'بناءً على المادة 44، يحق للموظف خلال فترة الـ 90 يوماً التغيب يوماً واحداً في الأسبوع أو العمل لمدة 6 ساعات فقط يومياً للبحث عن عمل، مع استحقاقه لكامل الأجر.'
                                 : 'As per Art 44, the worker is entitled to take 1 day off per week or work 6 hours daily during the 90-day notice to search for a job, with full pay.'}
                            </p>
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
           ) : (
             <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-20 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 animate-pulse">
                <Calculator className="h-20 w-20 text-slate-200 mb-6" />
                <h3 className="text-2xl font-black text-slate-400">{isRtl ? 'بانتظار المدخلات' : 'Waiting for Inputs'}</h3>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
