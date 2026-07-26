'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  Activity,
  ShieldCheck,
  Send,
  AlertTriangle,
  Loader2,
  Users,
  UserCircle,
  Info,
  Search,
  Check,
  ChevronDown
} from "lucide-react";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
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
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { paths } from '@/firebase/multi-tenant';

export default function NewLeaveRequestPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [targetEmpId, setTargetEmpId] = useState<string>(globalUser?.employeeId || "");
  const [empSearch, setEmpSearch] = useState("");
  const [openEmpPicker, setOpenEmpPicker] = useState(false);
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
  });

  const allEmpsQuery = useMemo(() => 
    companyId && db && isAdmin ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, 
  [db, companyId, isAdmin]);
  const { data: employees } = useCollection<Employee>(allEmpsQuery);

  const filteredEmployees = useMemo(() => {
    if (!employees || !empSearch.trim()) return employees || [];
    const q = empSearch.toLowerCase();
    return employees.filter(e => 
      e.fullName.toLowerCase().includes(q) || 
      e.employeeNumber.includes(q)
    );
  }, [employees, empSearch]);

  const empRef = useMemo(() => 
    companyId && db && targetEmpId ? doc(db, paths.employees(companyId), targetEmpId) : null, 
  [db, companyId, targetEmpId]);
  const { data: employee, loading: empLoading } = useDoc<Employee>(empRef);

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  useEffect(() => {
    async function calculateMetrics() {
      if (!db || !companyId || !employee) return;

      if (form.startDate && form.endDate) {
        const start = parseISO(form.startDate);
        const end = parseISO(form.endDate);
        if (isValid(start) && isValid(end) && end >= start) {
          setTotalCalendarDays(differenceInDays(end, start) + 1);
        } else {
          setTotalCalendarDays(0);
        }
      }

      const whService = new WorkHoursService(db, companyId);
      let settings = await whService.getSettings();
      if (!settings) settings = whService.getDefaultSettings() as any;

      const wdService = new WorkingDaysService(settings!);

      if (employee.hireDate) {
        const balance = employee.annualLeaveBalance || 0;
        setAccruedBalance(balance);

        if (form.startDate) {
          setEligibility(wdService.isEligibleForLeave(employee.hireDate, form.startDate));
        }
      }

      if (form.startDate && form.endDate) {
        const working = wdService.calculateWorkingDays(form.startDate, form.endDate);
        setWorkingDays(working);
      }
    }

    calculateMetrics();
  }, [form.startDate, form.endDate, employee, db, companyId]);

  const handleSubmit = async () => {
    if (!leaveService || !user || !targetEmpId || !form.startDate || !form.endDate || !employee) return;

    if (form.type === 'annual' && !eligibility.eligible && !isAdmin) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "غير مؤهل" : "Ineligible", 
        description: isRtl 
          ? `لا يمكن طلب إجازة سنوية قبل إتمام 6 أشهر من الخدمة.` 
          : `Annual leave is only available after 6 months of service.` 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // تصحيح السيادة: استخدام fullName من سجل الموظف حصراً لضمان عدم ظهور الايميل
      await leaveService.submitRequest({
        userId: user.uid, 
        employeeId: targetEmpId,
        userName: employee.fullName || globalUser?.fullName || globalUser?.username || 'User',
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days: totalCalendarDays,
        workingDays: workingDays,
        reason: form.reason
      }, employee.departmentId); 
      
      toast({ title: t('saved'), description: isRtl ? "تم تقديم الطلب بنجاح" : "Request submitted" });
      router.push('/dashboard/hr');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (empLoading && !employee) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-200/60">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {isRtl ? 'بوابة الخدمة والانتساب' : 'Service & Delegation'}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تقديم طلب إجازة' : 'Submit Leave Request'}</h1>
        </div>
        
        {employee && (
          <div className="bg-white p-4 rounded-2xl shadow-xl ring-1 ring-black/5 flex items-center gap-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><CalendarDays className="h-5 w-5" /></div>
            <div className="text-start">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الرصيد المتبقي للموظف' : 'Remaining Balance'}</p>
                <h4 className="text-lg font-black text-slate-900">{accruedBalance} <span className="text-[9px] text-muted-foreground font-bold">{isRtl ? 'يوم' : 'Days'}</span></h4>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-6">
           {isAdmin && (
             <Card className="border-0 shadow-xl rounded-[1.5rem] bg-white ring-1 ring-black/5 overflow-hidden text-start">
                <CardHeader className="bg-primary/5 border-b p-6">
                   <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800">
                      <Users className="h-4 w-4 text-primary" />
                      {isRtl ? 'تقديم بالنيابة عن موظف' : 'Apply on behalf of'}
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                   <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'بحث واختيار الموظف' : 'Search & Select Employee'}</Label>
                      
                      <Popover open={openEmpPicker} onOpenChange={setOpenEmpPicker}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-12 rounded-xl border-2 font-bold justify-between px-4 bg-white">
                            <span className="truncate">{employee?.fullName || (isRtl ? 'اختر موظفاً...' : 'Select employee...')}</span>
                            <ChevronDown className="h-4 w-4 opacity-30" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0 rounded-2xl shadow-3xl border-2 z-[100]" align="start">
                           <div className="p-3 bg-slate-50 border-b">
                              <div className="relative">
                                 <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                 <Input 
                                   placeholder={isRtl ? "بحث بالاسم أو الرقم..." : "Search name or ID..."}
                                   className="h-9 ps-9 rounded-lg border-2 bg-white text-xs font-bold"
                                   value={empSearch}
                                   onChange={e => setEmpSearch(e.target.value)}
                                 />
                              </div>
                           </div>
                           <ScrollArea className="h-64">
                              <div className="p-2 space-y-1">
                                 {filteredEmployees.map(e => (
                                   <div 
                                     key={e.id} 
                                     onClick={() => { setTargetEmpId(e.id!); setOpenEmpPicker(false); setEmpSearch(""); }}
                                     className={cn(
                                       "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between",
                                       targetEmpId === e.id ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                                     )}
                                   >
                                      <div className="flex flex-col text-start">
                                         <span className="text-xs font-black">{e.fullName}</span>
                                         <span className="text-[8px] font-mono text-slate-400 uppercase">#{e.employeeNumber}</span>
                                      </div>
                                      {targetEmpId === e.id && <Check className="h-3.5 w-3.5" />}
                                   </div>
                                 ))}
                                 {filteredEmployees.length === 0 && <div className="py-10 text-center text-[10px] text-slate-400 italic">No employees found.</div>}
                              </div>
                           </ScrollArea>
                        </PopoverContent>
                      </Popover>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-xl flex items-start gap-2 border border-slate-100">
                      <Info className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <p className="text-[8px] font-bold text-slate-600 leading-relaxed">
                         {isRtl ? 'تنبيه: كمدير، يمكنك تجاوز قيد الـ 6 أشهر عند الضرورة.' : 'Note: As Admin, you can override the 6-month rule if needed.'}
                      </p>
                   </div>
                </CardContent>
             </Card>
           )}

           <Card className="border-0 shadow-xl rounded-[1.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-6 text-start">
                 <CardTitle className="text-base font-black flex items-center gap-2 text-slate-800">
                    <Activity className="h-4 w-4 text-primary" />
                    {isRtl ? 'تحليل الاحتساب الميداني' : 'Field Calculation'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6 text-start">
                 <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                       <span className="text-slate-500">{isRtl ? 'أيام التقويم:' : 'Calendar Days:'}</span>
                       <span className="font-black text-base">{totalCalendarDays}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold">
                       <span className="text-slate-500">{isRtl ? 'خصم الرصيد الفعلي:' : 'Net Balance Deduction:'}</span>
                       <Badge className="bg-emerald-50 text-emerald-600 font-black border-0 px-3 py-1 text-sm">{workingDays}</Badge>
                    </div>
                 </div>
                 
                 <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-slate-600 font-bold leading-relaxed">
                       {isRtl ? 'قانون العمل: لا تحسب الجمعة والعطلات الرسمية ضمن الإجازة السنوية (مادة 70).' : 'Art 70: Holidays/Weekends are not deducted from balance.'}
                    </p>
                 </div>
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
           <Card className="border-0 shadow-xl rounded-[1.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardContent className="p-8 space-y-8">
                 <div className="space-y-1.5 text-start">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'نوع الإجازة المطلوبة' : 'Leave Type'}</Label>
                    <Select value={form.type} onValueChange={(v: LeaveType) => setForm({...form, type: v})}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-slate-50/30">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="annual" className="font-bold">{isRtl ? 'إجازة سنوية' : 'Annual Leave'}</SelectItem>
                          <SelectItem value="sick" className="font-bold">{isRtl ? 'إجازة مرضية' : 'Sick Leave'}</SelectItem>
                          <SelectItem value="emergency" className="font-bold">{isRtl ? 'إجازة اضطرارية' : 'Emergency'}</SelectItem>
                          <SelectItem value="unpaid" className="font-bold">{isRtl ? 'إجازة بدون راتب' : 'Unpaid Leave'}</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ بداية الإجازة' : 'Effective Start Date'}</Label>
                       <SmartDateInput value={form.startDate} onChange={v => setForm({...form, startDate: v})} />
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ العودة للعمل' : 'Return to Work Date'}</Label>
                       <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                    </div>
                 </div>

                 <div className="space-y-1.5 text-start pt-4 border-t">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'سبب الإجازة / ملاحظات' : 'Reason / Notes'}</Label>
                    <Textarea 
                       value={form.reason} 
                       onChange={e => setForm({...form, reason: e.target.value})} 
                       placeholder="..."
                       className="min-h-[120px] rounded-xl border-2 bg-slate-50/30 p-6 text-base font-bold focus:bg-white transition-all shadow-inner" 
                    />
                 </div>
              </CardContent>
           </Card>

           <div className="flex gap-4">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !form.startDate || !form.endDate || !targetEmpId} 
                className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700"
              >
                 {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} 
                 {isRtl ? 'إرسال الطلب للاعتماد' : 'Submit for Approval'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => router.push('/dashboard/hr')} 
                className="flex-1 h-14 rounded-2xl border-2 font-black text-base bg-white shadow-sm"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
