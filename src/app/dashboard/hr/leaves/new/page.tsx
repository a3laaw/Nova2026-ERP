
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  Calendar as CalendarIcon,
  Plane, Users, Activity,
  ShieldCheck,
  Send,
  Clock,
  ArrowRight
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

  // حساب أيام العمل
  useEffect(() => {
    async function calculateMetrics() {
      if (form.startDate && form.endDate && db && companyId) {
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
      } else {
        setWorkingDays(0);
        setTotalCalendarDays(0);
      }
    }
    calculateMetrics();
  }, [form.startDate, form.endDate, db, companyId]);

  const handleDateSelect = (range: DateRange | undefined) => {
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
      return { from, to };
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
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      
      {/* Header & Balance */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-8 border-slate-200">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {isRtl ? 'بوابة الخدمة الذاتية' : 'Self-Service Portal'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'طلب إجازة جديد' : 'New Leave Request'}</h1>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-xl ring-1 ring-black/5 flex items-center gap-6 min-w-[240px]">
           <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><CalendarDays className="h-6 w-6" /></div>
           <div className="text-start">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الرصيد الحالي' : 'Available Balance'}</p>
              <h4 className="text-2xl font-black text-slate-900">{currentBalance} <span className="text-xs text-muted-foreground">{isRtl ? 'يوم' : 'Days'}</span></h4>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Interactive Calendar (The Heart of selection) */}
        <div className="lg:col-span-5 space-y-8">
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8 flex justify-between items-center">
                 <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-800"><CalendarIcon className="h-5 w-5 text-primary" /> {isRtl ? 'اختيار النطاق الزمني' : 'Range Selection'}</CardTitle>
                 <Badge className="bg-primary/10 text-primary border-0 rounded-lg px-3 py-1 font-black">{totalCalendarDays} {isRtl ? 'يوم' : 'Days'}</Badge>
              </CardHeader>
              <CardContent className="p-8">
                 <Calendar
                    mode="range"
                    selected={selectedRange}
                    onSelect={handleDateSelect}
                    locale={isRtl ? ar : undefined}
                    className="rounded-3xl border-0 p-0 w-full"
                    disabled={{ before: startOfDay(new Date()) }}
                    numberOfMonths={1}
                    classNames={{
                        months: "flex flex-col",
                        month: "space-y-6",
                        caption: "flex justify-center pt-2 relative items-center mb-8 px-10",
                        caption_label: "text-xl font-black text-slate-800",
                        nav: "space-x-1 flex items-center absolute inset-x-0 top-2 justify-between px-2",
                        nav_button: cn(
                          "h-10 w-10 bg-slate-100 hover:bg-primary hover:text-white rounded-2xl transition-all p-0 flex items-center justify-center border-0 shadow-sm"
                        ),
                        nav_button_previous: "order-first",
                        nav_button_next: "order-last",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex justify-between mb-4",
                        head_cell: "text-slate-400 w-12 font-black text-[10px] uppercase",
                        row: "flex w-full mt-2 justify-between",
                        cell: cn(
                          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 h-12 w-12 transition-all",
                          "[&:has([aria-selected])]:bg-primary/10", // تلوين المسار بخلفية خفيفة
                          "[&:has([aria-selected].day-range-end)]:rounded-e-3xl",
                          "[&:has([aria-selected].day-range-start)]:rounded-s-3xl",
                          "first:[&:has([aria-selected])]:rounded-s-3xl",
                          "last:[&:has([aria-selected])]:rounded-e-3xl"
                        ),
                        day: cn("h-12 w-12 p-0 font-bold rounded-3xl hover:bg-slate-100 transition-all"),
                        day_range_start: "day-range-start rounded-3xl bg-primary text-white hover:bg-primary hover:text-white shadow-xl shadow-primary/30 z-30",
                        day_range_end: "day-range-end rounded-3xl bg-primary text-white hover:bg-primary hover:text-white shadow-xl shadow-primary/30 z-30",
                        day_range_middle: "aria-selected:bg-primary/10 aria-selected:text-primary rounded-none z-10",
                        day_selected: "bg-primary text-white focus:bg-primary focus:text-white",
                        day_today: "bg-slate-100 text-primary border-2 border-primary/20",
                        day_outside: "text-slate-300 opacity-50",
                    }}
                 />
              </CardContent>
              <div className="p-8 pt-0 grid grid-cols-2 gap-4 border-t border-slate-50 pt-8 mt-4">
                 <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-1 tracking-widest">{isRtl ? 'أيام العمل' : 'Work Days'}</p>
                    <p className="text-3xl font-black text-emerald-700">{workingDays}</p>
                 </div>
                 <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{isRtl ? 'عطلات' : 'Holidays'}</p>
                    <p className="text-3xl font-black text-slate-600">{totalCalendarDays - workingDays}</p>
                 </div>
              </div>
           </Card>

           {/* Remaining Balance Tracker */}
           <Card className="border-0 shadow-xl rounded-[3rem] bg-slate-900 text-white overflow-hidden">
              <CardContent className="p-8 space-y-6">
                 <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black">{isRtl ? 'تحديث الرصيد التقديري' : 'Estimated Balance Update'}</h3>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-400">{isRtl ? 'الرصيد بعد الخصم:' : 'After Deduction:'}</span>
                    <span className="text-2xl font-black text-emerald-400">{currentBalance - workingDays} {isRtl ? 'يوم' : 'Days'}</span>
                 </div>
                 <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.max(0, ((currentBalance - workingDays) / 30) * 100)}%` }} />
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Right Column: Form */}
        <div className="lg:col-span-7 space-y-8 animate-in slide-in-from-bottom-6 duration-500">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <div className="h-2 bg-primary w-full" />
              <CardContent className="p-10 space-y-10">
                 <div className="space-y-4 text-start">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تصنيف الإجازة' : 'Leave Type'}</Label>
                    <Select value={form.type} onValueChange={(v: LeaveType) => setForm({...form, type: v})}>
                        <SelectTrigger className="h-16 rounded-2xl border-2 text-lg font-black bg-slate-50/30 focus:bg-white transition-all"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl border-2 shadow-2xl">
                          <SelectItem value="annual" className="py-4 font-bold">{isRtl ? 'إجازة سنوية' : 'Annual Leave'}</SelectItem>
                          <SelectItem value="sick" className="py-4 font-bold">{isRtl ? 'إجازة مرضية' : 'Sick Leave'}</SelectItem>
                          <SelectItem value="emergency" className="py-4 font-bold">{isRtl ? 'إجازة اضطرارية' : 'Emergency'}</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
                    <div className="space-y-3 text-start">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ المغادرة' : 'Start Date'}</Label>
                       <SmartDateInput value={form.startDate} onChange={v => setForm({...form, startDate: v})} />
                    </div>
                    <div className="space-y-3 text-start">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ العودة' : 'End Date'}</Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardContent className="p-10 space-y-8">
                 <div className="flex items-center gap-3 text-slate-800"><Plane className="h-6 w-6 text-primary" /><h3 className="text-xl font-black">{isRtl ? 'ملاحظات إضافية' : 'Additional Notes'}</h3></div>
                 <div className="flex flex-wrap gap-4">
                    {[{ id: 'travel', label: isRtl ? 'سفر' : 'Travel', icon: Plane, color: 'text-blue-500' }, { id: 'family', label: isRtl ? 'عائلية' : 'Family', icon: Users, color: 'text-purple-500' }, { id: 'rest', label: isRtl ? 'راحة' : 'Rest', icon: Activity, color: 'text-emerald-500' }].map(item => (
                      <button key={item.id} type="button" onClick={() => setForm({...form, quickReason: item.label})}
                        className={cn("px-6 py-4 rounded-2xl border-2 font-black transition-all flex items-center gap-3", form.quickReason === item.label ? "bg-primary text-white border-primary shadow-lg scale-105" : "bg-slate-50 text-slate-500 border-transparent hover:border-primary/20 hover:bg-white")}>
                         <item.icon className={cn("h-5 w-5", form.quickReason === item.label ? "text-white" : item.color)} /> {item.label}
                      </button>
                    ))}
                 </div>
                 <Textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder={isRtl ? 'تفاصيل إضافية للإدارة...' : 'Details for management...'} className="min-h-[140px] rounded-[2rem] border-2 bg-slate-50/30 p-8 text-lg focus:bg-white transition-all resize-none shadow-inner border-slate-100" />
              </CardContent>
           </Card>

           <div className="flex flex-col sm:flex-row gap-6 pt-4">
              <Button onClick={handleSubmit} disabled={isSubmitting || !form.startDate || !form.endDate} className="flex-[2] h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-orange-700">
                 {isSubmitting ? <Clock className="h-8 w-8 animate-spin" /> : <Send className="h-8 w-8" />} {isRtl ? 'إرسال الطلب للمدير' : 'Submit to Manager'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/hr')} className="flex-1 h-20 rounded-[2.5rem] border-2 border-slate-200 font-black text-xl hover:bg-white transition-all bg-slate-50">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
           </div>
        </div>
      </div>
    </div>
  );
}
