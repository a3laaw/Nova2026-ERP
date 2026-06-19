'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  Clock, Calendar as CalendarIcon,
  AlertCircle, ArrowRight,
  Plane, Users, Activity,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { LeaveService } from '@/services/leave-service';
import { WorkingDaysService } from '@/services/working-days-service';
import { WorkHoursService } from '@/services/work-hours-service';
import { LeaveType } from '@/types/hr';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { ar } from 'date-fns/locale';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { DateRange } from "react-day-picker";

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
  
  const [form, setForm] = useState({
    type: 'annual' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
    quickReason: ''
  });

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const currentBalance = 24; 

  // محرك الحساب الآلي والتزامن
  useEffect(() => {
    async function calculateMetrics() {
      if (form.startDate && form.endDate && db && companyId) {
        try {
          const start = parseISO(form.startDate);
          const end = parseISO(form.endDate);
          
          if (isValid(start) && isValid(end) && end >= start) {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const total = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            setTotalCalendarDays(total);

            const whService = new WorkHoursService(db, companyId);
            const settings = await whService.getSettings();
            if (settings) {
              const wdService = new WorkingDaysService(settings);
              const days = wdService.calculateWorkingDays(form.startDate, form.endDate);
              setWorkingDays(days);
            }
          } else {
            setWorkingDays(0);
            setTotalCalendarDays(0);
          }
        } catch (e) {
          setWorkingDays(0);
          setTotalCalendarDays(0);
        }
      } else {
        setWorkingDays(0);
        setTotalCalendarDays(0);
      }
    }
    calculateMetrics();
  }, [form.startDate, form.endDate, db, companyId]);

  // التعامل مع اختيار التقويم (Range) بشكل ذري
  const handleCalendarSelect = (range: DateRange | undefined) => {
    setForm(prev => ({
      ...prev,
      startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : ''
    }));
  };

  const selectedRange: DateRange | undefined = useMemo(() => {
    try {
      const from = form.startDate ? parseISO(form.startDate) : undefined;
      const to = form.endDate ? parseISO(form.endDate) : undefined;
      
      return { 
        from: from && isValid(from) ? from : undefined, 
        to: to && isValid(to) ? to : undefined 
      };
    } catch {
      return undefined;
    }
  }, [form.startDate, form.endDate]);

  const handleSubmit = async () => {
    if (!leaveService || !user || !form.startDate || !form.endDate) return;
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
      });

      toast({ title: t('saved'), description: isRtl ? 'تم تقديم طلب الإجازة بنجاح.' : 'Leave request submitted successfully.' });
      router.push('/dashboard/hr');
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: t('error'),
        description: e.message.includes('OVERLAP') ? e.message : t('saveFailed')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-8 border-slate-200">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" />
              {isRtl ? 'بوابة الموظف الذكية' : 'Smart Employee Portal'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'طلب إجازة جديد' : 'New Leave Request'}</h1>
           <p className="text-muted-foreground font-bold text-sm">{isRtl ? 'قم بتحديد نوع وفترة الإجازة لمراجعة التأثير على رصيدك المتاح.' : 'Set your leave type and period to review the impact on your balance.'}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-xl ring-1 ring-black/5 flex items-center gap-6 min-w-[240px]">
           <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <CalendarDays className="h-6 w-6" />
           </div>
           <div className="text-start">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الرصيد المتاح' : 'Available Balance'}</p>
              <h4 className="text-2xl font-black text-slate-900">{currentBalance} <span className="text-xs text-muted-foreground">{isRtl ? 'يوم' : 'Days'}</span></h4>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Interactive Visuals */}
        <div className="lg:col-span-5 space-y-8">
           
           {/* Visual Range Calendar */}
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-right-4 duration-500">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                       <CalendarIcon className="h-5 w-5 text-primary" />
                       {isRtl ? 'معاينة الفترة' : 'Period Preview'}
                    </CardTitle>
                    <Badge variant="secondary" className="rounded-lg font-black px-3 py-1 bg-primary/10 text-primary border-0">
                       {totalCalendarDays} {isRtl ? 'أيام' : 'Days'}
                    </Badge>
                 </div>
              </CardHeader>
              <CardContent className="p-8 flex justify-center items-center bg-white">
                 <Calendar
                    mode="range"
                    selected={selectedRange}
                    onSelect={handleCalendarSelect}
                    locale={isRtl ? ar : undefined}
                    className="rounded-3xl border-0 p-0"
                    disabled={{ before: startOfDay(new Date()) }}
                    numberOfMonths={1}
                    classNames={{
                        months: "flex flex-col",
                        month: "space-y-6",
                        caption: "flex justify-center pt-2 relative items-center mb-4",
                        caption_label: "text-lg font-black text-slate-800",
                        nav: "space-x-1 flex items-center",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex justify-between mb-4",
                        head_cell: "text-slate-400 rounded-md w-12 font-black text-xs uppercase",
                        row: "flex w-full mt-2 justify-between",
                        cell: cn(
                          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                          "[&:has([aria-selected])]:bg-primary/5 [&:has([aria-selected].day-range-end)]:rounded-e-2xl [&:has([aria-selected].day-range-start)]:rounded-s-2xl",
                          "h-12 w-12"
                        ),
                        day: cn(
                          "h-12 w-12 p-0 font-bold aria-selected:opacity-100 rounded-2xl hover:bg-slate-100 transition-all"
                        ),
                        day_range_start: "day-range-start rounded-2xl bg-primary text-white hover:bg-primary hover:text-white",
                        day_range_end: "day-range-end rounded-2xl bg-primary text-white hover:bg-primary hover:text-white",
                        day_range_middle: "aria-selected:bg-primary/10 aria-selected:text-primary rounded-none",
                        day_selected: "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
                        day_today: "bg-slate-100 text-primary",
                        day_outside: "text-slate-300 opacity-50",
                        day_disabled: "text-slate-200 opacity-50 line-through",
                    }}
                 />
              </CardContent>
              <div className="p-8 pt-0 grid grid-cols-2 gap-4">
                 <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">{isRtl ? 'أيام العمل' : 'Work Days'}</p>
                    <p className="text-2xl font-black text-emerald-700">{workingDays}</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'عطلات' : 'Off Days'}</p>
                    <p className="text-2xl font-black text-slate-600">{totalCalendarDays - workingDays}</p>
                 </div>
              </div>
           </Card>

           {/* Metrics & Impact */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden ring-1 ring-white/5">
              <CardContent className="p-8 space-y-6">
                 <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black">{isRtl ? 'الأثر المالي والزمني' : 'Financial Impact'}</h3>
                 </div>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="text-sm font-bold text-slate-400">{isRtl ? 'الرصيد بعد الخصم:' : 'Balance After:'}</span>
                       <span className="text-xl font-black text-emerald-400">{currentBalance - workingDays} {isRtl ? 'يوم' : 'Days'}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-primary transition-all duration-1000" 
                         style={{ width: `${Math.max(0, ((currentBalance - workingDays) / 30) * 100)}%` }}
                       />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 italic">
                       * {isRtl ? 'يتم تحديث الرصيد نهائياً بعد اعتماد الطلب من HR.' : 'Balance updates after final HR approval.'}
                    </p>
                 </div>
              </CardContent>
           </Card>

        </div>

        {/* Right Column: Form Fields */}
        <div className="lg:col-span-7 space-y-8 animate-in slide-in-from-left-4 duration-500">
           
           {/* Section 1: Type & Period */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <div className="h-2 w-full bg-primary" />
              <CardContent className="p-10 space-y-8">
                 <div className="space-y-6 text-start">
                    <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'نوع الإجازة المطلوبة' : 'Leave Category'}</Label>
                    <Select value={form.type} onValueChange={(v: LeaveType) => setForm({...form, type: v})}>
                        <SelectTrigger className="h-16 rounded-2xl border-2 text-lg font-black bg-slate-50/50 focus:bg-white transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">{isRtl ? 'إجازة سنوية (خصم من الرصيد)' : 'Annual Leave'}</SelectItem>
                          <SelectItem value="sick">{isRtl ? 'إجازة مرضية' : 'Sick Leave'}</SelectItem>
                          <SelectItem value="emergency">{isRtl ? 'إجازة اضطرارية' : 'Emergency Leave'}</SelectItem>
                          <SelectItem value="unpaid">{isRtl ? 'إجازة بدون راتب' : 'Unpaid Leave'}</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                    <div className="space-y-3 text-start">
                       <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'تاريخ البدء' : 'Effective Start'}</Label>
                       <SmartDateInput value={form.startDate} onChange={v => setForm({...form, startDate: v})} />
                    </div>
                    <div className="space-y-3 text-start">
                       <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'تاريخ الانتهاء' : 'Effective End'}</Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                 </div>
              </CardContent>
           </Card>

           {/* Section 2: Quick Reason */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5">
              <CardContent className="p-10 space-y-8">
                 <div className="flex items-center gap-3 text-slate-800">
                    <Plane className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-black">{isRtl ? 'سبب الإجازة' : 'Reason for Leave'}</h3>
                 </div>
                 
                 <div className="flex flex-wrap gap-4">
                    {[
                      { id: 'travel', label: isRtl ? 'سفر خارجي' : 'International Travel', icon: Plane },
                      { id: 'family', label: isRtl ? 'ظروف أسرية' : 'Family Matters', icon: Users },
                      { id: 'rest', label: isRtl ? 'راحة ومرض' : 'Rest & Recover', icon: Activity },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setForm({...form, quickReason: item.label})}
                        className={cn(
                          "px-6 py-4 rounded-2xl border-2 font-black transition-all flex items-center gap-3",
                          form.quickReason === item.label 
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" 
                            : "bg-slate-50 text-slate-400 border-transparent hover:border-primary/20 hover:bg-white"
                        )}
                      >
                         <item.icon className="h-5 w-5" />
                         {item.label}
                      </button>
                    ))}
                 </div>

                 <Textarea 
                   value={form.reason}
                   onChange={e => setForm({...form, reason: e.target.value})}
                   placeholder={isRtl ? 'هل تود إضافة المزيد من التفاصيل؟' : 'Would you like to add more details?'}
                   className="min-h-[140px] rounded-[2rem] border-2 bg-slate-50/50 p-8 text-lg focus:bg-white transition-all resize-none shadow-inner"
                 />
              </CardContent>
           </Card>

           {/* Section 3: Compliance Alerts */}
           <div className="bg-amber-50/80 backdrop-blur-sm border-2 border-amber-200 rounded-[2rem] p-8 flex items-start gap-4 text-amber-900">
              <AlertCircle className="h-6 w-6 shrink-0 mt-1" />
              <div className="text-start">
                 <h5 className="font-black text-sm mb-1">{isRtl ? 'تذكير بالسياسة الداخلية' : 'Policy Reminder'}</h5>
                 <p className="text-xs font-bold leading-relaxed opacity-80">
                   {isRtl 
                     ? 'يتم صرف الإجازة السنوية بعد موافقة المدير المباشر واعتماد قسم الموارد البشرية. تأكد من تقديم الطلب قبل أسبوعين على الأقل من موعد المغادرة المخطط له.' 
                     : 'Annual leave is granted after line manager and HR approval. Ensure submission at least 14 days before your planned departure.'}
                 </p>
              </div>
           </div>

           {/* Action Buttons */}
           <div className="flex flex-col sm:flex-row gap-6 pt-4">
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !form.startDate || !form.endDate}
                className="flex-[2] h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4"
              >
                 {isSubmitting ? <Clock className="h-8 w-8 animate-spin" /> : <Send className="h-8 w-8" />}
                 {isRtl ? 'إرسال طلب الإجازة' : 'Submit Leave Request'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard/hr')}
                className="flex-1 h-20 rounded-[2.5rem] border-2 border-slate-200 font-black text-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                 {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
           </div>

        </div>

      </div>
    </div>
  );
}
