'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, Plus, Loader2, CheckCircle2, 
  XCircle, ArrowRight, MessageSquare, Clock,
  Calendar, Hash, Pencil, ShieldAlert,
  AlertTriangle, PlaneLanding, PlaneTakeoff, Zap,
  UserCheck, Info, ShieldCheck
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { LeaveService } from '@/services/leave-service';
import { LeaveRequest } from '@/types/hr';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { canPerformOnRecord } from '@/lib/permissions/engine';
import { parseISO, isPast, isToday } from 'date-fns';

/**
 * @fileOverview رادار إدارة الإجازات السيادي.
 * يدعم دورة حياة كاملة بنوافذ منبثقة إجبارية للتواريخ الفعلية (Depart, Return, Activate).
 */
export function LeavesManager() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const { check, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [processingLeave, setProcessingLeave] = useState<LeaveRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [editForm, setEditForm] = useState({
    comment: '',
    startDate: '',
    endDate: '',
    workingDays: 0,
    actualDate: new Date().toISOString().split('T')[0]
  });

  const viewAccess = check('hr', 'view');
  const canApprove = check('hr', 'approve').can;

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);
  
  const { data: rawLeaves, loading } = useCollection<LeaveRequest>(leavesQuery);

  const leaves = useMemo(() => {
    if (!viewAccess.can) return [];
    return rawLeaves.filter(leave => canPerformOnRecord(
      viewAccess,
      { uid: user?.uid || '', departmentId: globalUser?.departmentId },
      { createdBy: leave.userId || (leave as any).createdBy, departmentId: (leave as any).departmentId }
    ));
  }, [rawLeaves, viewAccess, globalUser, user]);

  useEffect(() => {
    if (processingLeave) {
      setEditForm({
        comment: '',
        startDate: processingLeave.startDate,
        endDate: processingLeave.endDate,
        workingDays: processingLeave.workingDays,
        actualDate: new Date().toISOString().split('T')[0]
      });
    }
  }, [processingLeave]);

  const handleAction = async (status: LeaveRequest['status']) => {
    if (!leaveService || !user || !processingLeave) return;
    setIsProcessing(true);
    try {
      await leaveService.updateRequestStatus(processingLeave.id!, status, user.uid, {
        comment: editForm.comment,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        workingDays: editForm.workingDays,
        actualDepartureDate: status === 'on-leave' ? editForm.actualDate : undefined,
        actualReturnDate: status === 'returned' ? editForm.actualDate : undefined
      });
      toast({ title: isRtl ? "تم تحديث السجل بنجاح" : "Record updated successfully" });
      setProcessingLeave(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-1">
        <div className="text-start">
           <h3 className="text-xl font-black flex items-center gap-3 text-slate-900">
             <CalendarDays className="h-6 w-6 text-primary" />
             {isRtl ? 'إدارة إجازات القوى العاملة' : 'Workforce Leaves'}
           </h3>
           <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{isRtl ? 'توثيق المغادرة والعودة الفعلية' : 'Document actual departure & return'}</p>
        </div>
        <Button onClick={() => router.push('/dashboard/hr/leaves/new')} className="rounded-xl font-black h-12 px-8 shadow-xl shadow-primary/20 border-b-4 border-orange-700">
          <Plus className="me-2 h-4 w-4" /> {t('common.add')}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50/50">
                  <TableRow>
                     <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                     <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'الفترة المخططة' : 'Planned Period'}</TableHead>
                     <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'الحالة الحالية' : 'Current Status'}</TableHead>
                     <TableHead className="pe-10 text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'الإجراءات التنفيذية' : 'Execution'}</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-40"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : (
                    leaves?.map((leave) => {
                      const isOverdue = leave.status === 'approved' && (isPast(parseISO(leave.startDate)) || isToday(parseISO(leave.startDate)));
                      
                      return (
                        <TableRow key={leave.id} className="hover:bg-slate-50 transition-colors border-b-slate-100 group cursor-pointer" onClick={() => router.push(`/dashboard/hr/leaves/${leave.id}`)}>
                           <TableCell className="py-6 ps-10 text-start font-black text-slate-800">
                              <div className="flex flex-col gap-1.5">
                                 <span className="text-base">{leave.userName}</span>
                                 <Badge variant="outline" className="w-fit text-[8px] font-black uppercase border-slate-200 bg-white">{leave.type}</Badge>
                              </div>
                           </TableCell>
                           <TableCell className="text-start">
                              <div className="flex flex-col text-[10px] font-bold text-slate-400">
                                 <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-primary opacity-30" />
                                    <span>{leave.startDate} → {leave.endDate}</span>
                                 </div>
                                 <span className="text-primary font-black mt-1">{leave.workingDays} {t('hr.workDays')}</span>
                              </div>
                           </TableCell>
                           <TableCell className="text-start">
                              <div className="flex flex-col gap-2">
                                 <Badge className={cn(
                                   "font-black px-4 py-1.5 border-0 shadow-sm w-fit uppercase text-[10px]",
                                   ['approved', 'on-leave', 'returned', 'commenced'].includes(leave.status) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                 )}>
                                    {leave.status}
                                 </Badge>
                                 {isOverdue && (
                                    <Badge className="bg-rose-100 text-rose-600 border-rose-200 font-black text-[9px] animate-pulse w-fit flex items-center gap-1.5">
                                       <AlertTriangle className="h-3 w-3" /> {isRtl ? 'تنبيه: حان موعد المغادرة' : 'PENDING DEPARTURE'}
                                    </Badge>
                                 )}
                              </div>
                           </TableCell>
                           <TableCell className="pe-10" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-3">
                                 {leave.status === 'pending' && canApprove && (
                                    <Button onClick={() => setProcessingLeave(leave)} className="h-10 px-6 rounded-xl bg-primary text-white font-black text-xs shadow-lg">
                                       <Pencil className="h-4 w-4 me-2" /> {isRtl ? 'قرار الإدارة' : 'Admin Decision'}
                                    </Button>
                                 )}
                                 {leave.status === 'approved' && canApprove && (
                                    <Button onClick={() => setProcessingLeave(leave)} className="h-10 px-6 rounded-xl bg-[#FFB000] text-white font-black text-xs shadow-xl border-b-4 border-[#FF5722]">
                                       <PlaneTakeoff className="h-4 w-4 me-2" /> {isRtl ? 'تسجيل مغادرة' : 'Depart'}
                                    </Button>
                                 )}
                                 {leave.status === 'on-leave' && canApprove && (
                                    <Button onClick={() => setProcessingLeave(leave)} className="h-10 px-6 rounded-xl bg-blue-600 text-white font-black text-xs shadow-xl border-b-4 border-blue-800">
                                       <PlaneLanding className="h-4 w-4 me-2" /> {isRtl ? 'تسجيل عودة' : 'Register Return'}
                                    </Button>
                                 )}
                                 {leave.status === 'returned' && canApprove && (
                                    <Button onClick={() => setProcessingLeave(leave)} className="h-10 px-6 rounded-xl bg-emerald-600 text-white font-black text-xs shadow-xl border-b-4 border-emerald-800">
                                       <Zap className="h-4 w-4 me-2" /> {isRtl ? 'اعتماد مباشرة' : 'Final Activate'}
                                    </Button>
                                 )}
                                 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-300 hover:text-primary group-hover:bg-primary/5 transition-all">
                                    <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
                                 </Button>
                              </div>
                           </TableCell>
                        </TableRow>
                      );
                    })
                  )}
               </TableBody>
            </Table>
         </CardContent>
      </Card>

      {/* النافذة المنبثقة الإجبارية لدورة حياة الإجازة */}
      <Dialog open={!!processingLeave} onOpenChange={open => !open && setProcessingLeave(null)}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl text-start" dir={dir}>
           <div className="bg-primary/5 p-10 text-slate-900 border-b relative">
              <div className="absolute top-0 right-0 p-8 opacity-5"><CalendarDays className="h-32 w-32" /></div>
              <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4 text-slate-900 relative z-10">
                 {processingLeave?.status === 'pending' ? <Clock className="h-9 w-9 text-primary" /> : <ShieldAlert className="h-9 w-9 text-primary" />}
                 {processingLeave?.status === 'pending' ? (isRtl ? 'قرار الإدارة وتدقيق البيانات' : 'Admin Decision & Audit') : 
                  processingLeave?.status === 'approved' ? (isRtl ? 'توثيق مغادرة الموظف' : 'Document Departure') :
                  processingLeave?.status === 'on-leave' ? (isRtl ? 'توثيق العودة الفعلية' : 'Document Actual Return') :
                  (isRtl ? 'اعتماد المباشرة النهائية' : 'Final Commencement')}
              </DialogTitle>
              <p className="text-slate-500 font-bold mt-2 relative z-10">{isRtl ? 'الموظف المستهدف:' : 'Target Staff:'} {processingLeave?.userName}</p>
           </div>
           
           <div className="p-10 space-y-8 bg-white max-h-[65vh] overflow-y-auto scrollbar-hide">
              
              {/* الخطوة 1: الموافقة الإدارية (للحالة Pending) */}
              {processingLeave?.status === 'pending' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-6 p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-primary/20 shadow-inner">
                      <div className="space-y-2 text-start">
                         <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ البدء المعتمد</Label>
                         <SmartDateInput value={editForm.startDate} onChange={v => setEditForm({...editForm, startDate: v})} />
                      </div>
                      <div className="space-y-2 text-start">
                         <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ العودة المعتمد</Label>
                         <SmartDateInput value={editForm.endDate} onChange={v => setEditForm({...editForm, endDate: v})} />
                      </div>
                      <div className="col-span-2 space-y-2 text-start">
                         <Label className="text-[10px] font-black uppercase text-slate-400">أيام الخصم المعتمدة للطلب</Label>
                         <Input type="number" value={editForm.workingDays} onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} className="h-16 rounded-2xl font-black text-4xl text-center border-2 bg-white text-primary" />
                         <p className="text-[9px] text-center font-bold text-slate-400 mt-2 italic">سيقوم النظام بخصم هذه الأيام من الرصيد فور إتمام المباشرة لاحقاً.</p>
                      </div>
                   </div>
                   <div className="space-y-2 text-start">
                      <Label className="text-[10px] font-black uppercase text-slate-400">ملاحظات إدارية</Label>
                      <Textarea value={editForm.comment} onChange={e => setEditForm({...editForm, comment: e.target.value})} className="min-h-[100px] rounded-2xl border-2 shadow-sm" />
                   </div>
                   <div className="flex gap-4">
                      <Button onClick={() => handleAction('rejected')} disabled={isProcessing} variant="outline" className="flex-1 h-16 rounded-2xl border-2 text-rose-600 font-black text-lg hover:bg-rose-50 shadow-sm">{t('status.rejected')}</Button>
                      <Button onClick={() => handleAction('approved')} disabled={isProcessing} className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-100 text-lg border-b-8 border-emerald-800">{t('common.confirm')}</Button>
                   </div>
                </div>
              )}

              {/* الخطوة 2: نافذة المغادرة (للحالة Approved) */}
              {processingLeave?.status === 'approved' && (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                   <div className="p-8 bg-orange-50/50 rounded-[2.5rem] border-2 border-orange-100 space-y-6 shadow-inner text-center">
                      <div className="space-y-2">
                         <Label className="text-[11px] font-black uppercase text-orange-600 tracking-widest flex items-center justify-center gap-2">
                            <PlaneTakeoff className="h-4 w-4" /> تاريخ خروج الموظف الفعلي من المنشأة
                         </Label>
                         <div className="max-w-xs mx-auto">
                            <SmartDateInput value={editForm.actualDate} onChange={v => setEditForm({...editForm, actualDate: v})} />
                         </div>
                      </div>
                      <div className="p-5 bg-white/80 rounded-2xl border border-orange-100 flex items-start gap-4 text-start">
                         <Info className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                         <p className="text-[10px] font-bold text-orange-800 leading-relaxed italic">بمجرد التأكيد، سيتم تحديث حالة الموظف في رادار الحضور إلى (في إجازة) ولن يظهر ضمن كشوف الرواتب المباشرة لهذه الفترة.</p>
                      </div>
                   </div>
                   <Button onClick={() => handleAction('on-leave')} disabled={isProcessing} className="w-full h-20 rounded-[2.5rem] bg-[#FFB000] text-white font-black text-2xl gap-4 border-b-8 border-[#FF5722] shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-all">
                      {isProcessing ? <Loader2 className="animate-spin h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />} تأكيد المغادرة الفعلية
                   </Button>
                </div>
              )}

              {/* الخطوة 3: نافذة العودة (للحالة On-Leave) */}
              {processingLeave?.status === 'on-leave' && (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                   <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border-2 border-blue-100 space-y-6 shadow-inner text-center">
                      <div className="space-y-2">
                         <Label className="text-[11px] font-black uppercase text-blue-600 tracking-widest flex items-center justify-center gap-2">
                            <PlaneLanding className="h-4 w-4" /> تاريخ رجوع الموظف الفعلي ومباشرة الحضور
                         </Label>
                         <div className="max-w-xs mx-auto">
                            <SmartDateInput value={editForm.actualDate} onChange={v => setEditForm({...editForm, actualDate: v})} />
                         </div>
                      </div>
                      <div className="p-5 bg-white/80 rounded-2xl border border-blue-100 flex items-start gap-4 text-start">
                         <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                         <p className="text-[10px] font-bold text-blue-800 leading-relaxed italic">سيتم استخدام هذا التاريخ في الخطوة النهائية لتدقيق الخصم المالي الحقيقي من رصيد الإجازات السنوي المتبقي.</p>
                      </div>
                   </div>
                   <Button onClick={() => handleAction('returned')} disabled={isProcessing} className="w-full h-20 rounded-[2.5rem] bg-blue-600 text-white font-black text-2xl gap-4 shadow-2xl shadow-blue-200 border-b-8 border-blue-800 hover:scale-[1.02] transition-all">
                      {isProcessing ? <Loader2 className="animate-spin h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />} تسجيل العودة والوصول
                   </Button>
                </div>
              )}

              {/* الخطوة 4: المباشرة النهائية (للحالة Returned) */}
              {processingLeave?.status === 'returned' && (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                   <div className="p-10 bg-emerald-50 rounded-[3rem] border-2 border-emerald-100 space-y-8 shadow-inner">
                      <div className="flex items-center gap-4 text-emerald-700 font-black text-xl border-b border-emerald-100 pb-4">
                         <ShieldCheck className="h-8 w-8" /> مراجعة الاستحقاق المالي النهائي
                      </div>
                      
                      <div className="space-y-2 text-start">
                         <Label className="text-[11px] font-black uppercase text-emerald-600 tracking-[0.2em]">إجمالي أيام الخصم من الرصيد (بعد المراجعة)</Label>
                         <Input 
                           type="number" 
                           value={editForm.workingDays} 
                           onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} 
                           className="h-20 rounded-2xl font-black text-6xl text-emerald-700 text-center bg-white border-2 border-emerald-200 shadow-xl" 
                         />
                         <p className="text-[10px] text-center font-bold text-slate-400 mt-4 italic">بناءً على تاريخ المغادرة والعودة المسجل، يرجى تأكيد عدد أيام العمل التي سيتم خصمها فعلياً من رصيد الموظف السنوي.</p>
                      </div>
                   </div>
                   <Button onClick={() => handleAction('commenced')} disabled={isProcessing} className="w-full h-24 rounded-[3rem] bg-emerald-600 text-white font-black text-3xl shadow-xl shadow-emerald-100 border-b-8 border-emerald-800 gap-6 hover:scale-[1.02] transition-all">
                      {isProcessing ? <Loader2 className="animate-spin h-10 w-10" /> : <Zap className="h-10 w-10" />} اعتماد المباشرة وتفعيل الموظف
                   </Button>
                </div>
              )}
           </div>
           
           <div className="p-8 bg-slate-50 border-t flex justify-end shrink-0">
              <Button variant="ghost" onClick={() => setProcessingLeave(null)} className="rounded-xl font-bold px-10 text-slate-400 hover:text-slate-900 transition-all">{t('common.cancel')}</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}