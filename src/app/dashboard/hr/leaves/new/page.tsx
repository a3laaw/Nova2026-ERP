'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, CheckCircle2, 
  Clock, Calendar as CalendarIcon,
  AlertCircle, Info, Calculator, ArrowRight,
  Plane, Users, Activity, UploadCloud, X, ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  Trash2
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

  const currentBalance = 24; // رصيد افتراضي للعرض كما في التصميم

  useEffect(() => {
    async function calculateMetrics() {
      if (form.startDate && form.endDate && db && companyId) {
        const start = new Date(form.startDate);
        const end = new Date(form.endDate);
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
      toast({ 
        variant: "destructive", 
        title: t('error'),
        description: e.message.includes('OVERLAP') ? e.message : t('saveFailed')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const breadcrumbs = [
    { label: isRtl ? 'إدارة الإجازات' : 'Leaves Management', path: '/dashboard/hr' },
    { label: isRtl ? 'طلب إجازة جديد' : 'New Leave Request', path: '' }
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto" dir={dir}>
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-2 text-start">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground opacity-60">
           {breadcrumbs.map((b, i) => (
             <span key={i} className="flex items-center gap-2">
                {b.path ? (
                  <button onClick={() => router.push(b.path)} className="hover:text-primary transition-colors">{b.label}</button>
                ) : (
                  <span className="text-primary font-black">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <ChevronLeft className={cn("h-3 w-3", !isRtl && "rotate-180")} />}
             </span>
           ))}
        </div>
        <div className="flex justify-between items-center">
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تقديم طلب إجازة' : 'Submit Leave Request'}</h1>
           <div className="text-end">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{isRtl ? 'رصيد الإجازات المتاح' : 'Available Balance'}</p>
              <h4 className="text-xl font-black text-primary">{currentBalance} {isRtl ? 'يوم' : 'Days'}</h4>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Summary & Status */}
        <div className="lg:col-span-4 space-y-6">
           {/* Summary Card */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <CardTitle className="text-lg font-black">{isRtl ? 'ملخص الطلب' : 'Request Summary'}</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                 <div className="flex justify-between items-center py-2 border-b border-dashed">
                    <span className="text-sm font-bold text-muted-foreground">{isRtl ? 'المدة الإجمالية:' : 'Total Duration:'}</span>
                    <span className="font-black text-slate-800">{totalCalendarDays} {isRtl ? 'أيام' : 'Days'}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-dashed">
                    <span className="text-sm font-bold text-primary">{isRtl ? 'أيام العمل:' : 'Working Days:'}</span>
                    <span className="font-black text-primary text-lg">{workingDays} {isRtl ? 'أيام' : 'Days'}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-dashed">
                    <span className="text-sm font-bold text-muted-foreground">{isRtl ? 'العطلات الرسمية:' : 'Public Holidays:'}</span>
                    <span className="font-black text-slate-800">{totalCalendarDays - workingDays} {isRtl ? 'يوم' : 'Day'}</span>
                 </div>
                 <div className="flex justify-between items-center pt-4">
                    <span className="text-sm font-bold text-emerald-600">{isRtl ? 'الرصيد بعد الخصم:' : 'Balance After:'}</span>
                    <Badge className="bg-emerald-50 text-emerald-600 font-black px-3 py-1 rounded-lg">
                       {currentBalance - workingDays} {isRtl ? 'يوم' : 'Day'}
                    </Badge>
                 </div>
              </CardContent>
           </Card>

           {/* Alerts Card */}
           <Card className="border-0 shadow-lg rounded-[2rem] bg-amber-50 border-s-8 border-s-amber-400">
              <CardContent className="p-8 space-y-4 text-start text-amber-900">
                 <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <h5 className="font-black text-sm">{isRtl ? 'تنبيهات هامة' : 'Important Alerts'}</h5>
                 </div>
                 <ul className="space-y-3">
                    {[
                      isRtl ? 'يجب تقديم طلب الإجازة السنوية قبل 14 يوماً على الأقل.' : 'Annual leave must be submitted 14 days in advance.',
                      isRtl ? 'تأكد من تسليم كافة المهام العالقة لزميلك المباشر.' : 'Ensure all pending tasks are handed over.',
                      isRtl ? 'في حال الإجازة المرضية، يجب إرفاق التقرير الطبي خلال 48 ساعة.' : 'Medical reports must be attached within 48h.'
                    ].map((note, i) => (
                      <li key={i} className="text-[10px] font-bold leading-relaxed flex items-start gap-2">
                         <div className="h-1 w-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                         {note}
                      </li>
                    ))}
                 </ul>
              </CardContent>
           </Card>

           {/* Approval Path */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <CardTitle className="text-lg font-black">{isRtl ? 'مسار الاعتماد' : 'Approval Path'}</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                 <div className="relative space-y-8">
                    <div className="absolute top-0 bottom-0 start-[15px] w-[2px] bg-slate-100" />
                    {[
                       { role: isRtl ? 'المدير المباشر' : 'Line Manager', name: 'أحمد السعد', status: 'pending' },
                       { role: isRtl ? 'مدير القسم' : 'Dept Manager', name: 'سارة الكويتي', status: 'upcoming' },
                       { role: isRtl ? 'الموارد البشرية' : 'HR Dept', name: 'قسم العمليات', status: 'upcoming' }
                    ].map((step, i) => (
                       <div key={i} className="relative flex items-start gap-6 ps-8">
                          <div className={cn(
                             "absolute start-0 top-1 h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm z-10",
                             step.status === 'pending' ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-300"
                          )}>
                             {step.status === 'pending' ? <Clock className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                          </div>
                          <div className="text-start">
                             <p className="text-sm font-black text-slate-800">{step.role}</p>
                             <p className="text-[10px] font-bold text-muted-foreground">{step.name}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Right Column: Form Sections */}
        <div className="lg:col-span-8 space-y-8">
           
           {/* Section 1: Leave Type */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5">
              <CardContent className="p-8 space-y-6">
                 <div className="flex items-center gap-3 text-slate-800 border-b pb-4">
                    <CalendarDays className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-black">{isRtl ? 'نوع الإجازة' : 'Leave Type'}</h3>
                 </div>
                 <Select value={form.type} onValueChange={(v: LeaveType) => setForm({...form, type: v})}>
                    <SelectTrigger className="h-16 rounded-2xl border-2 text-lg font-bold">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="annual">{isRtl ? 'إجازة سنوية (خصم من الرصيد)' : 'Annual Leave'}</SelectItem>
                       <SelectItem value="sick">{isRtl ? 'إجازة مرضية' : 'Sick Leave'}</SelectItem>
                       <SelectItem value="emergency">{isRtl ? 'إجازة اضطرارية' : 'Emergency Leave'}</SelectItem>
                       <SelectItem value="unpaid">{isRtl ? 'إجازة بدون راتب' : 'Unpaid Leave'}</SelectItem>
                    </SelectContent>
                 </Select>
              </CardContent>
           </Card>

           {/* Section 2: Period & Calendar */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5">
              <CardContent className="p-8 space-y-8">
                 <div className="flex items-center gap-3 text-slate-800 border-b pb-4">
                    <CalendarIcon className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-black">{isRtl ? 'فترة الإجازة' : 'Leave Period'}</h3>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 text-start">
                       <Label className="font-black text-xs text-muted-foreground uppercase">{isRtl ? 'تاريخ البدء' : 'Start Date'}</Label>
                       <SmartDateInput value={form.startDate} onChange={v => setForm({...form, startDate: v})} />
                    </div>
                    <div className="space-y-2 text-start">
                       <Label className="font-black text-xs text-muted-foreground uppercase">{isRtl ? 'تاريخ الانتهاء' : 'End Date'}</Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                 </div>

                 {/* Visual Calendar */}
                 <div className="p-8 bg-slate-50/50 rounded-[2rem] border-2 border-slate-100 flex items-center justify-center">
                    <Calendar
                       mode="range"
                       selected={{
                         from: form.startDate ? new Date(form.startDate) : undefined,
                         to: form.endDate ? new Date(form.endDate) : undefined
                       }}
                       locale={isRtl ? ar : undefined}
                       className="rounded-3xl bg-white shadow-xl p-6"
                       disabled={{ before: new Date() }}
                    />
                 </div>
              </CardContent>
           </Card>

           {/* Section 3: Reason */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5">
              <CardContent className="p-8 space-y-6">
                 <div className="flex items-center gap-3 text-slate-800 border-b pb-4">
                    <Plane className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-black">{isRtl ? 'سبب الإجازة والملاحظات' : 'Reason & Notes'}</h3>
                 </div>
                 
                 <div className="flex flex-wrap gap-3">
                    {[
                      { id: 'travel', label: isRtl ? 'سفر' : 'Travel', icon: Plane },
                      { id: 'family', label: isRtl ? 'ظرف عائلي' : 'Family', icon: Users },
                      { id: 'rest', label: isRtl ? 'راحة واستجمام' : 'Rest', icon: Activity },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setForm({...form, quickReason: item.label})}
                        className={cn(
                          "px-6 py-3 rounded-2xl border-2 font-black transition-all flex items-center gap-2",
                          form.quickReason === item.label 
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" 
                            : "bg-white text-slate-400 border-slate-100 hover:border-primary/20"
                        )}
                      >
                         <item.icon className="h-4 w-4" />
                         {item.label}
                      </button>
                    ))}
                 </div>

                 <Textarea 
                   value={form.reason}
                   onChange={e => setForm({...form, reason: e.target.value})}
                   placeholder={isRtl ? 'أضف تفاصيل إضافية عن سبب الإجازة...' : 'Add more details about the reason...'}
                   className="min-h-[120px] rounded-[1.5rem] border-2 bg-slate-50/50 p-6 text-lg focus:bg-white"
                 />
              </CardContent>
           </Card>

           {/* Section 4: Attachments */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5">
              <CardContent className="p-8 space-y-6">
                 <div className="flex items-center gap-3 text-slate-800 border-b pb-4">
                    <UploadCloud className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-black">{isRtl ? 'المرفقات (اختياري)' : 'Attachments (Optional)'}</h3>
                 </div>
                 
                 <div className="border-4 border-dashed border-slate-100 rounded-[2rem] p-12 text-center bg-slate-50/30 hover:bg-slate-50 hover:border-primary/20 transition-all cursor-pointer group">
                    <UploadCloud className="h-16 w-16 text-slate-300 mx-auto group-hover:scale-110 group-hover:text-primary transition-all mb-4" />
                    <p className="text-base font-black text-slate-700">{isRtl ? 'اضغط هنا لرفع الملفات أو اسحبها وأفلتها' : 'Click to upload files or drag and drop'}</p>
                    <p className="text-xs font-bold text-muted-foreground mt-2">PDF, JPG, PNG (Max 5MB)</p>
                 </div>
              </CardContent>
           </Card>

           {/* Action Buttons */}
           <div className="flex gap-4 pt-8">
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !form.startDate || !form.endDate}
                className="flex-[2] h-20 rounded-[2rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all gap-3"
              >
                 {isSubmitting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Send className="h-8 w-8" />}
                 {isRtl ? 'إرسال للاعتماد' : 'Submit Request'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard/hr')}
                className="flex-1 h-20 rounded-[2rem] border-2 font-black text-xl hover:bg-slate-50"
              >
                 {isRtl ? 'إلغاء الطلب' : 'Cancel'}
              </Button>
           </div>

        </div>

      </div>
    </div>
  );
}
