'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  Plane, Activity,
  ShieldCheck,
  Send,
  Clock,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  FileText,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { LeaveService } from '@/services/leave-service';
import { WorkingDaysService } from '@/services/working-days-service';
import { WorkHoursService } from '@/services/work-hours-service';
import { LeaveType, Employee } from '@/types/hr';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { paths } from '@/firebase/multi-tenant';

export default function NewLeaveRequestPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);
  const [totalCalendarDays, setTotalCalendarDays] = useState(0);
  const [accruedBalance, setAccruedBalance] = useState(0);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; months: number }>({ eligible: true, months: 0 });
  
  const [form, setForm] = useState({
    type: 'annual' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
    quickReason: ''
  });

  const empRef = useMemo(() => 
    companyId && db && user ? doc(db, paths.employees(companyId), user.uid) : null, 
  [db, companyId, user]);
  const { data: employee, loading: empLoading } = useDoc<Employee>(empRef);

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  useEffect(() => {
    async function calculateMetrics() {
      if (!db || !companyId || !employee?.hireDate) return;

      const whService = new WorkHoursService(db, companyId);
      const settings = await whService.getSettings();
      if (!settings) return;

      const wdService = new WorkingDaysService(settings);
      const balance = wdService.calculateAccruedLeave(employee.hireDate);
      setAccruedBalance(balance);

      if (form.startDate) {
        setEligibility(wdService.isEligibleForLeave(employee.hireDate, form.startDate));
      }

      if (form.startDate && form.endDate) {
        const start = parseISO(form.startDate);
        const end = parseISO(form.endDate);
        
        if (isValid(start) && isValid(end) && end >= start) {
          const diffTime = Math.abs(end.getTime() - start.getTime());
          setTotalCalendarDays(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
          setWorkingDays(wdService.calculateWorkingDays(form.startDate, form.endDate));
        } else {
          setWorkingDays(0);
          setTotalCalendarDays(0);
        }
      }
    }
    calculateMetrics();
  }, [form.startDate, form.endDate, employee, db, companyId]);

  const handleSubmit = async () => {
    if (!leaveService || !user || !form.startDate || !form.endDate) return;

    if (form.type === 'annual' && !eligibility.eligible) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "غير مؤهل" : "Ineligible", 
        description: isRtl 
          ? `لا يمكنك طلب إجازة سنوية قبل إتمام 6 أشهر (أتممت ${eligibility.months} شهر).` 
          : `Annual leave is only available after 6 months.` 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await leaveService.submitRequest({
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days: totalCalendarDays,
        workingDays: workingDays,
        reason: form.reason || form.quickReason
      }, globalUser?.departmentId); // تمرير القسم آلياً من سياق المستخدم
      
      toast({ title: t('saved') });
      router.push('/dashboard/hr');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (empLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-200/60">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {isRtl ? 'بوابة الخدمة الذاتية للموظف' : 'Self-Service Portal'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'تقديم طلب إجازة' : 'Submit Leave Request'}</h1>
        </div>
        
        <div className="bg-white p-5 rounded-3xl shadow-xl ring-1 ring-black/5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><CalendarDays className="h-5 w-5" /></div>
          <div className="text-start">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الرصيد التراكمي' : 'Accrued Balance'}</p>
              <h4 className="text-xl font-black text-slate-900">{accruedBalance} <span className="text-[10px] text-muted-foreground font-bold">{isRtl ? 'يوم' : 'Days'}</span></h4>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        <div className="lg:col-span-1 space-y-6">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
                 <CardTitle className="text-lg font-black flex items-center gap-3 text-slate-800">
                    <Activity className="h-5 w-5 text-primary" />
                    {isRtl ? 'تحليل الاحتساب' : 'Calculation'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8 text-start">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-bold">
                       <span className="text-slate-500">{isRtl ? 'أيام التقويم:' : 'Calendar Days:'}</span>
                       <span className="font-black">{totalCalendarDays}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold">
                       <span className="text-slate-500">{isRtl ? 'خصم الرصيد (أيام عمل):' : 'Net Deduction:'}</span>
                       <Badge className="bg-emerald-50 text-emerald-600 font-black border-0">{workingDays}</Badge>
                    </div>
                 </div>
                 
                 <div className="p-5 rounded-3xl bg-amber-50 border-2 border-amber-100 space-y-2">
                    <div className="flex items-center gap-2 text-amber-600">
                       <AlertTriangle className="h-4 w-4" />
                       <span className="text-[10px] font-black uppercase">{isRtl ? 'تنبيه قانوني' : 'Legal Alert'}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 font-bold leading-relaxed">
                       {isRtl ? 'وفقاً للمادة 70، لا تحسب أيام الجمعة والعطلات الرسمية ضمن الإجازة السنوية.' : 'Holidays/Weekends are not deducted from balance per Art 70.'}
                    </p>
                 </div>
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardContent className="p-10 space-y-10">
                 <div className="space-y-4 text-start">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'نوع الإجازة' : 'Leave Type'}</Label>
                    <Select value={form.type} onValueChange={(v: LeaveType) => setForm({...form, type: v})}>
                        <SelectTrigger className="h-16 rounded-2xl border-2 text-lg font-black bg-slate-50/30">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="annual" className="font-bold">{isRtl ? 'إجازة سنوية' : 'Annual Leave'}</SelectItem>
                          <SelectItem value="sick" className="font-bold">{isRtl ? 'إجازة مرضية' : 'Sick Leave'}</SelectItem>
                          <SelectItem value="emergency" className="font-bold">{isRtl ? 'إجازة اضطرارية' : 'Emergency'}</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-start">
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ البدء' : 'Start Date'}</Label>
                       <SmartDateInput value={form.startDate} onChange={v => setForm({...form, startDate: v})} />
                    </div>
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ العودة' : 'Return Date'}</Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                 </div>

                 <div className="space-y-4 text-start pt-4 border-t">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'السبب أو ملاحظات إضافية' : 'Reason / Notes'}</Label>
                    <Textarea 
                       value={form.reason} 
                       onChange={e => setForm({...form, reason: e.target.value})} 
                       placeholder="..."
                       className="min-h-[120px] rounded-[2rem] border-2 bg-slate-50/30 p-6 text-lg focus:bg-white transition-all" 
                    />
                 </div>
              </CardContent>
           </Card>

           <div className="flex gap-4">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !form.startDate || !form.endDate} 
                className="flex-[2] h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700"
              >
                 {isSubmitting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Send className="h-8 w-8" />} 
                 {isRtl ? 'إرسال الطلب' : 'Submit Request'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => router.push('/dashboard/hr')} 
                className="flex-1 h-20 rounded-[2.5rem] border-2 font-black text-xl bg-white shadow-sm"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
