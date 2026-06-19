'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, Plus, Loader2, CheckCircle2, 
  XCircle, Clock, Calendar as CalendarIcon,
  AlertCircle, Info, Calculator, ArrowRight
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { LeaveService } from '@/services/leave-service';
import { WorkingDaysService } from '@/services/working-days-service';
import { WorkHoursService } from '@/services/work-hours-service';
import { LeaveRequest, LeaveType } from '@/types/hr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { paths } from '@/firebase/multi-tenant';
import { SmartDateInput } from '@/components/ui/smart-date-input';

export function LeavesManager() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);
  const [form, setForm] = useState({
    type: 'annual' as LeaveType,
    startDate: '',
    endDate: '',
    reason: ''
  });

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);
  const { data: leaves, loading } = useCollection<LeaveRequest>(leavesQuery);

  useEffect(() => {
    async function updateDays() {
      if (form.startDate && form.endDate && db && companyId) {
        const whService = new WorkHoursService(db, companyId);
        const settings = await whService.getSettings();
        if (settings) {
          const wdService = new WorkingDaysService(settings);
          const days = wdService.calculateWorkingDays(form.startDate, form.endDate);
          setWorkingDays(days);
        }
      }
    }
    updateDays();
  }, [form.startDate, form.endDate, db, companyId]);

  const handleSubmit = async () => {
    if (!leaveService || !user || !form.startDate || !form.endDate) return;
    setIsSubmitting(true);
    try {
      const diffTime = Math.abs(new Date(form.endDate).getTime() - new Date(form.startDate).getTime());
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      await leaveService.submitRequest({
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days: totalDays,
        workingDays: workingDays,
        reason: form.reason
      });

      toast({ title: t('saved'), description: isRtl ? 'تم تقديم طلب الإجازة.' : 'Leave request submitted.' });
      setIsFormOpen(false);
      setForm({ type: 'annual', startDate: '', endDate: '', reason: '' });
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

  const handleAction = async (leaveId: string, status: 'approved' | 'rejected') => {
    if (!leaveService || !user) return;
    try {
      await leaveService.updateRequestStatus(leaveId, status, user.uid);
      toast({ title: t('saved') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error') });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-start">
           <h3 className="text-xl font-black flex items-center gap-2">
             <CalendarDays className="h-6 w-6 text-primary" />
             {isRtl ? 'إجازات الموظفين' : 'Employee Leaves'}
           </h3>
           <p className="text-xs font-bold text-muted-foreground mt-1 opacity-70">
             {isRtl ? 'نظام الحساب الآلي للإجازات والغياب' : 'Automated leave and absence calculation system'}
           </p>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 h-12 px-6">
              <Plus className="me-2 h-4 w-4" /> {isRtl ? 'تقديم إجازة' : 'Apply for Leave'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] max-w-lg p-0 overflow-hidden border-0 shadow-2xl" dir={dir}>
            <div className="bg-primary/5 p-8 border-b">
               <DialogHeader>
                  <DialogTitle className="text-start font-black text-2xl flex items-center gap-2">
                    <CalendarIcon className="h-6 w-6 text-primary" />
                    {isRtl ? 'طلب إجازة جديد' : 'Submit Leave Request'}
                  </DialogTitle>
               </DialogHeader>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{isRtl ? 'نوع الإجازة' : 'Leave Type'}</Label>
                  <Select value={form.type} onValueChange={(v: LeaveType) => setForm({...form, type: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="annual">{isRtl ? 'سنوية (خصم من الرصيد)' : 'Annual'}</SelectItem>
                       <SelectItem value="sick">{isRtl ? 'مرضية (شرائح الراتب)' : 'Sick'}</SelectItem>
                       <SelectItem value="emergency">{isRtl ? 'اضطرارية' : 'Emergency'}</SelectItem>
                       <SelectItem value="unpaid">{isRtl ? 'بدون راتب' : 'Unpaid'}</SelectItem>
                    </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{isRtl ? 'بداية الإجازة' : 'Start Date'}</Label>
                     <SmartDateInput value={form.startDate} onChange={v => setForm({...form, startDate: v})} />
                  </div>
                  <div className="space-y-2">
                     <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{isRtl ? 'نهاية الإجازة' : 'End Date'}</Label>
                     <SmartDateInput value={form.endDate} onChange={v => setForm({...form, endDate: v})} />
                  </div>
               </div>

               {workingDays > 0 && (
                 <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between animate-in zoom-in-95">
                    <div className="flex items-center gap-2 text-emerald-700">
                       <Calculator className="h-4 w-4" />
                       <span className="text-xs font-black uppercase tracking-tight">{isRtl ? 'أيام العمل المحتسبة' : 'Working Days'}</span>
                    </div>
                    <span className="text-xl font-black text-emerald-600">{workingDays}</span>
                 </div>
               )}

               <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{isRtl ? 'ملاحظات / سبب الإجازة' : 'Notes / Reason'}</Label>
                  <Textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="rounded-xl border-2 min-h-[100px]" placeholder="..." />
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleSubmit} disabled={isSubmitting || !form.startDate || !form.endDate} className="w-full h-14 rounded-xl font-black text-lg bg-primary shadow-lg shadow-primary/20">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : (isRtl ? 'إرسال للاعتماد' : 'Submit Request')}
               </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-muted/30">
                  <TableRow>
                     <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'النوع' : 'Type'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'الفترة' : 'Period'}</TableHead>
                     <TableHead className="text-center">{isRtl ? 'أيام العمل' : 'Work Days'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                     <TableHead className="pe-8"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : leaves?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 italic text-muted-foreground font-bold">{isRtl ? 'لا توجد طلبات إجازة مسجلة.' : 'No leave requests found.'}</TableCell></TableRow>
                  ) : (
                    leaves?.map((leave) => (
                      <TableRow key={leave.id} className="hover:bg-slate-50 transition-colors group">
                         <TableCell className="py-6 ps-8 text-start">
                            <span className="font-black text-slate-800">{leave.userName}</span>
                         </TableCell>
                         <TableCell className="text-start">
                            <Badge variant="outline" className="bg-white font-black uppercase text-[9px] px-3 border-slate-200">
                               {leave.type}
                            </Badge>
                         </TableCell>
                         <TableCell className="text-start">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                               <span>{leave.startDate}</span>
                               <ArrowRight className={cn("h-2 w-2 opacity-30", isRtl && "rotate-180")} />
                               <span>{leave.endDate}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-center">
                            <span className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-xs">{leave.workingDays}</span>
                         </TableCell>
                         <TableCell className="text-start">
                            <Badge className={cn(
                              "font-black px-3 py-1 border-0 shadow-sm",
                              leave.status === 'approved' ? 'bg-emerald-500 text-white' :
                              leave.status === 'rejected' ? 'bg-destructive text-white' :
                              'bg-amber-50 text-amber-600'
                            )}>
                               {leave.status.toUpperCase()}
                            </Badge>
                         </TableCell>
                         <TableCell className="pe-8">
                            {leave.status === 'pending' && (globalUser?.role === 'admin' || globalUser?.role === 'Admin') ? (
                               <div className="flex justify-end gap-2">
                                  <Button onClick={() => handleAction(leave.id!, 'approved')} size="sm" variant="ghost" className="h-10 w-10 p-0 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-emerald-100"><CheckCircle2 className="h-5 w-5" /></Button>
                                  <Button onClick={() => handleAction(leave.id!, 'rejected')} size="sm" variant="ghost" className="h-10 w-10 p-0 rounded-xl text-destructive hover:bg-destructive/5 border border-rose-100"><XCircle className="h-5 w-5" /></Button>
                               </div>
                            ) : null}
                         </TableCell>
                      </TableRow>
                    ))
                  )}
               </TableBody>
            </Table>
         </CardContent>
      </Card>
    </div>
  );
}
