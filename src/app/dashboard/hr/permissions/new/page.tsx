'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, Send, ShieldCheck, 
  AlertTriangle, ArrowRight,
  Info, Loader2, Timer,
  History
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { PermissionService } from '@/services/permission-service';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { differenceInMinutes, parse } from 'date-fns';

export default function NewPermissionPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [monthlyUsed, setMonthlyUsed] = useState(0);

  const [form, setForm] = useState({
    type: 'late_arrival' as 'late_arrival' | 'early_departure',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '09:00',
    reason: ''
  });

  const permService = useMemo(() => 
    db && companyId ? new PermissionService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  // حساب المدة وفحص الرصيد عند تغيير المدخلات
  useEffect(() => {
    try {
      const start = parse(form.startTime, 'HH:mm', new Date());
      const end = parse(form.endTime, 'HH:mm', new Date());
      const diff = differenceInMinutes(end, start);
      if (diff > 0) {
        setDuration(Number((diff / 60).toFixed(2)));
      } else {
        setDuration(0);
      }
    } catch (e) { setDuration(0); }
  }, [form.startTime, form.endTime]);

  useEffect(() => {
    async function fetchQuota() {
      if (permService && user && form.date) {
        const hours = await permService.getMonthlyUsedHours(user.uid, form.date);
        setMonthlyUsed(hours);
      }
    }
    fetchQuota();
  }, [permService, user, form.date]);

  const handleSubmit = async () => {
    if (!permService || !user) return;
    setLoading(true);
    try {
      await permService.submitRequest({
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        type: form.type,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        durationHours: duration,
        reason: form.reason
      });
      toast({ title: t('saved'), description: isRtl ? 'تم تقديم طلب الاستئذان بنجاح.' : 'Request submitted successfully.' });
      router.push('/dashboard/hr/permissions');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {isRtl ? 'بوابة الخدمات الإدارية' : 'HR Portal'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'طلب استئذان جديد' : 'New Permission'}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-6">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-slate-50/30 border-b p-8 text-start">
                 <CardTitle className="text-lg font-black flex items-center gap-3">
                    <History className="h-5 w-5 text-primary" />
                    {isRtl ? 'مؤشرات الرصيد' : 'Quota Metrics'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8 text-start">
                 <div className="space-y-5">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-500 uppercase">{isRtl ? 'المدة المطلوبة:' : 'Requested:'}</span>
                       <Badge className={cn("text-lg font-black px-4", duration > 3 ? "bg-rose-500 text-white" : "bg-primary/10 text-primary")}>
                          {duration}h
                       </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-500 uppercase">{isRtl ? 'رصيد الشهر المستخدم:' : 'Month Used:'}</span>
                       <span className="text-xl font-black text-slate-900">{monthlyUsed}h / 12h</span>
                    </div>
                    <div className="h-[1px] bg-slate-100 w-full" />
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                       <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                       <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                          {isRtl ? 'تنبيه: الحد الأقصى للاستئذان الواحد هو 3 ساعات، والحد الشهري 12 ساعة.' : 'Limit: 3 hours per request, 12 hours total per month.'}
                       </p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardContent className="p-10 space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-start">
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'نوع الاستئذان' : 'Type'}</Label>
                       <Select value={form.type} onValueChange={(v: any) => setForm({...form, type: v})}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 font-black"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="late_arrival" className="font-bold">{isRtl ? 'حضور متأخر' : 'Late Arrival'}</SelectItem>
                             <SelectItem value="early_departure" className="font-bold">{isRtl ? 'انصراف مبكر' : 'Early Departure'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'التاريخ' : 'Date'}</Label>
                       <SmartDateInput value={form.date} onChange={v => setForm({...form, date: v})} />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50 text-start">
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'وقت البداية' : 'Start Time'}</Label>
                       <Input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} className="h-14 rounded-2xl border-2 text-lg font-black" />
                    </div>
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'وقت النهاية' : 'End Time'}</Label>
                       <Input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} className="h-14 rounded-2xl border-2 text-lg font-black" />
                    </div>
                 </div>

                 <div className="space-y-4 pt-6 border-t border-slate-50 text-start">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'سبب الاستئذان' : 'Reason'}</Label>
                    <Textarea 
                       value={form.reason} 
                       onChange={e => setForm({...form, reason: e.target.value})} 
                       placeholder="..."
                       className="min-h-[120px] rounded-[2rem] border-2 bg-slate-50/30 p-6 text-lg focus:bg-white transition-all resize-none shadow-inner" 
                    />
                 </div>
              </CardContent>
           </Card>

           <div className="flex gap-4">
              <Button 
                onClick={handleSubmit} 
                disabled={loading || duration <= 0 || duration > 3} 
                className="flex-[2] h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700"
              >
                 {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Send className="h-8 w-8" />} 
                 {isRtl ? 'إرسال الطلب' : 'Submit Permission'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => router.push('/dashboard/hr/permissions')} 
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
