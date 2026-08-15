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
  NoticeType, 
  SettlementResult, 
  TerminationReason 
} from '@/types/settlement';
import { GratuityService, type GratuityCalculationInput, type GratuityResult } from '@/services/gratuity-service';
import { addMonths, format, parseISO } from 'date-fns';
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

  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [noticeStartDate, setNoticeStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [noticeType, setNoticeType] = useState<NoticeType>('worked');
  const [terminationReason, setTerminationReason] = useState<TerminationReason>('resignation');
  const [result, setResult] = useState<SettlementResult | null>(null);

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, 
  [db, companyId]);
  const { data: employees, loading: empsLoading } = useCollection<Employee>(empsQuery);

  const selectedEmployee = useMemo(() => employees?.find(e => e.id === selectedEmpId), [employees, selectedEmpId]);

  const handleCalculate = () => {
    if (!selectedEmployee) return toast({ variant: "destructive", title: t('hr.searchSelectEmployee') });
    if (!selectedEmployee.hireDate) return toast({ variant: "destructive", title: t('hr.gratuity.legalNotes') });

    const totalSalary = (selectedEmployee.basicSalary || 0) + (selectedEmployee.housingAllowance || 0) + (selectedEmployee.transportAllowance || 0) + (selectedEmployee.otherAllowances || 0);
    if (totalSalary <= 0) return toast({ variant: "destructive", title: t('common.error') });

    try {
      let gNoticeType: GratuityCalculationInput['noticeType'] = 'served';
      let effectiveEndDate = noticeStartDate;
      let noticeText = t('hr.settlement.waivedPeriod');

      if (noticeType === 'worked') {
        gNoticeType = 'served';
        effectiveEndDate = format(addMonths(parseISO(noticeStartDate), 3), 'yyyy-MM-dd');
        noticeText = t('hr.settlement.workedNotice');
      } else if (noticeType === 'indemnity') {
        gNoticeType = 'not_served_by_employer';
        effectiveEndDate = noticeStartDate;
        noticeText = t('hr.settlement.indemnityPayout');
      }

      const gInput: GratuityCalculationInput = {
        hireDate: selectedEmployee.hireDate,
        endDate: effectiveEndDate,
        totalSalary,
        reason: terminationReason === 'resignation' ? 'resignation' : terminationReason === 'misconduct' ? 'misconduct' : 'termination',
        noticeType: gNoticeType,
        remainingLeaveDays: selectedEmployee.annualLeaveBalance || 0,
      };

      const g: GratuityResult = GratuityService.calculate(gInput);
      setResult({
        gratuity: g.finalGratuity, leaveBalancePay: g.leaveBalancePay, noticeIndemnity: g.noticeIndemnity,
        total: g.totalEntitlement, notice: noticeText, yearsOfService: g.serviceDuration.years,
        monthsOfService: g.serviceDuration.months, lastSalary: totalSalary, leaveBalance: g.accruedLeaveDays,
        dailyWage: g.dailyWage, baseGratuityBeforeFactor: g.baseGratuity, resignationFactor: g.resignationFactor,
        effectiveEndDate, isCapped: g.isCapped
      });
    } catch (e: any) { toast({ variant: "destructive", title: t('error'), description: e.message }); }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20 animate-in fade-in bg-[#fdfaf3]" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <Scale className="h-3 w-3" /> {t('hr.settlement.engineTitle')}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{t('hr.settlement.calculatorTitle')}</h1>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="rounded-2xl border-2 h-10 px-6 font-black gap-2 print:hidden transition-all">
          <Printer className="h-4 w-4" /> {t('hr.gratuity.printLegal')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4 space-y-6 print:hidden">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-primary/5 border-b p-8 text-start">
                 <CardTitle className="text-lg font-black flex items-center gap-2"><UserCircle className="h-5 w-5 text-primary" /> {t('hr.settlement.employeeData')}</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('hr.reports.dossierSearch')}</Label>
                    <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                       <SelectTrigger className="h-11 rounded-xl border-2 font-black"><SelectValue placeholder={t('hr.settlement.selectFromList')} /></SelectTrigger>
                       <SelectContent className="rounded-xl border-0 shadow-2xl">
                          {employees?.map(emp => <SelectItem key={emp.id} value={emp.id!} className="font-bold py-3">{emp.fullName}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">بداية الإنذار</Label><SmartDateInput value={noticeStartDate} onChange={setNoticeStartDate} /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">المعالجة</Label><Select value={noticeType} onValueChange={(v: any) => setNoticeType(v)}><SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="worked" className="font-bold">مُنقضية بالعمل</SelectItem><SelectItem value="indemnity" className="font-bold">تعويض نقدي</SelectItem><SelectItem value="waived" className="font-bold">تنازل</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">السبب</Label><Select value={terminationReason} onValueChange={(v: any) => setTerminationReason(v)}><SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="resignation" className="font-bold">استقالة</SelectItem><SelectItem value="termination" className="font-bold">إنهاء خدمة</SelectItem></SelectContent></Select></div>
                 </div>
                 <Button onClick={handleCalculate} disabled={!selectedEmpId} className="w-full h-12 rounded-2xl bg-primary text-white font-black text-sm shadow-xl mt-4 gap-3 border-b-4 border-orange-700">
                    <Sparkles className="h-4 w-4" /> {t('common.confirm')}
                 </Button>
              </CardContent>
           </Card>
        </div>
        <div className="lg:col-span-8">
           {result ? <SettlementBreakdown result={result} isRtl={isRtl} /> : <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center opacity-30"><Calculator className="h-20 w-20 text-slate-200 mb-4" /><h3 className="text-xl font-black text-slate-400">بانتظار اختيار الموظف</h3></div>}
        </div>
      </div>
    </div>
  );
}