
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  Plane, Users, Activity,
  ShieldCheck,
  Send,
  Clock,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  FileText,
  CheckCircle2
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
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';
import { SmartDateInput } from '@/components/ui/smart-date-input';

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
    <div className="space-y-10 max-w-5xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-200/60">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {isRtl ? 'بوابة الخدمة الذاتية' : 'Self-Service Portal'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'طلب إجازة جديد' : 'New Leave Request'}</h1>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-xl ring-1 ring-black/5 flex items-center gap-4 min-w-[200px]">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><CalendarDays className="h-5 w-5" /></div>
            <div className="text-start">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الرصيد المتاح' : 'Available'}</p>
                <h4 className="text-xl font-black text-slate-900">{currentBalance} <span className="text-[10px] text-muted-foreground font-bold">{isRtl ? 'يوم' : 'Days'}</span></h4>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        
        {/* Left Column: Light Summary Card */}
        <div className="lg:col-span-1 space-y-6">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
                 <CardTitle className="text-lg font-black flex items-center gap-3 text-slate-800">
                    <Activity className="h-5 w-5 text-primary" />
                    {isRtl ? 'ملخص الاحتساب' : 'Leave Summary'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8 text-start">
                 <div className="space-y-5">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{isRtl ? 'إجمالي الأيام:' : 'Total Days:'}</span>
                       <span className="text-xl font-black text-slate-900">{totalCalendarDays}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{isRtl ? 'أيام العمل المخصومة:' : 'Work Days:'}</span>
                       <Badge className="bg-emerald-50 text-emerald-600 font-black text-lg border-0 shadow-sm px-4 py-1">
                          {workingDays}
                       </Badge>
                    </div>
                    <div className="h-[1px] bg-slate-100 w-full" />
                    <div className="flex justify-between items-end pt-2">
                       <div className="text-start">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">{isRtl ? 'الرصيد المتبقي المتوقع' : 'Expected Remainder'}</span>
                          <span className="text-3xl font-black font-headline text-primary mt-1 block">{currentBalance - workingDays}</span>
                       </div>
                       <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-20" />
                    </div>
                 </div>
                 
                 <div className="mt-6 p-5 rounded-3xl bg-amber-50/50 border-2 border-amber-100/50 space-y-3">
                    <div className="flex items-center gap-2 text-amber-600">
                       <AlertTriangle className="h-4 w-4" />
                       <span className="text-[10px] font-black uppercase tracking-widest">{isRtl ? 'تنبيهات هامة' : 'Important'}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-bold">
                       {isRtl ? '• يتم استبعاد أيام العطل الأسبوعية والرسمية من الخصم.' : '• Weekends and holidays are excluded from deduction.'}
                    </p>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-bold">
                       {isRtl ? '• يجب تقديم الطلب قبل 7 أيام عمل على الأقل.' : '• Must apply at least 7 work days in advance.'}
                    </p>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Right Column: Main Form */}
        <div className="lg:col-span-2 space-y-8">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <div className="h-2 bg-primary/20 w-full" />
              <CardContent className="p-10 space-y-10">
                 
                 <div className="space-y-4 text-start">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <Briefcase className="h-3 w-3" /> {isRtl ? 'تصنيف الإجازة' : 'Leave Type'}
                    </Label>
                    <Select value={form.type} onValueChange={(v: LeaveType) => setForm({...form, type: v})}>
                        <SelectTrigger className="h-16 rounded-2xl border-2 text-lg font-black bg-slate-50/30 focus:bg-white transition-all border-slate-100">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-2 shadow-2xl">
                          <SelectItem value="annual" className="py-4 font-bold">{isRtl ? 'إجازة سنوية' : 'Annual Leave'}</SelectItem>
                          <SelectItem value="sick" className="py-4 font-bold">{isRtl ? 'إجازة مرضية' : 'Sick Leave'}</SelectItem>
                          <SelectItem value="emergency" className="py-4 font-bold">{isRtl ? 'إجازة اضطرارية' : 'Emergency'}</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
                    <div className="space-y-3 text-start">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <ArrowRight className={cn("h-3 w-3 text-primary", isRtl && "rotate-180")} />
                          {isRtl ? 'تاريخ بداية الإجازة' : 'Start Date'}
                       </Label>
                       <SmartDateInput value={form.startDate} onChange={v => setForm({...form, startDate: v})} />
                    </div>
                    <div className="space-y-3 text-start">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <ArrowRight className={cn("h-3 w-3 text-emerald-500", !isRtl && "rotate-180")} />
                          {isRtl ? 'تاريخ العودة للعمل' : 'Return Date'}
                       </Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                 </div>

                 <div className="space-y-6 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-slate-800 text-start">
                       <div className="h-10 w-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                          <FileText className="h-5 w-5" />
                       </div>
                       <h3 className="text-xl font-black">{isRtl ? 'ملاحظات إضافية' : 'Additional Notes'}</h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                       {[
                         { id: 'travel', label: isRtl ? 'سفر' : 'Travel', icon: Plane, color: 'text-blue-500' }, 
                         { id: 'family', label: isRtl ? 'عائلية' : 'Family', icon: Users, color: 'text-purple-500' }, 
                         { id: 'rest', label: isRtl ? 'راحة' : 'Rest', icon: Activity, color: 'text-emerald-500' }
                       ].map(item => (
                         <button 
                           key={item.id} 
                           type="button" 
                           onClick={() => setForm({...form, quickReason: item.label})}
                           className={cn(
                             "px-6 py-4 rounded-2xl border-2 font-black transition-all flex items-center gap-3", 
                             form.quickReason === item.label 
                               ? "bg-primary text-white border-primary shadow-lg scale-105" 
                               : "bg-slate-50 text-slate-500 border-transparent hover:border-primary/20 hover:bg-white"
                           )}
                         >
                            <item.icon className={cn("h-5 w-5", form.quickReason === item.label ? "text-white" : item.color)} /> 
                            {item.label}
                         </button>
                       ))}
                    </div>

                    <Textarea 
                       value={form.reason} 
                       onChange={e => setForm({...form, reason: e.target.value})} 
                       placeholder={isRtl ? 'تفاصيل إضافية للإدارة...' : 'Details for management...'} 
                       className="min-h-[140px] rounded-[2rem] border-2 bg-slate-50/30 p-8 text-lg focus:bg-white transition-all resize-none shadow-inner border-slate-100 focus:border-primary/30" 
                    />
                 </div>
              </CardContent>
           </Card>

           <div className="flex flex-col sm:flex-row gap-6 pt-4">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !form.startDate || !form.endDate} 
                className="flex-[2] h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-orange-700"
              >
                 {isSubmitting ? <Clock className="h-8 w-8 animate-spin" /> : <Send className="h-8 w-8" />} 
                 {isRtl ? 'إرسال طلب الإجازة' : 'Submit Leave Request'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => router.push('/dashboard/hr')} 
                className="flex-1 h-20 rounded-[2.5rem] border-2 border-slate-200 font-black text-xl hover:bg-white transition-all bg-white text-slate-600 shadow-sm"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
