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
  UserCheck
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
      toast({ title: isRtl ? "تم تحديث الحالة بنجاح" : "Status Updated" });
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
           <h3 className="text-xl font-black flex items-center gap-2">
             <CalendarDays className="h-6 w-6 text-primary" />
             {isRtl ? 'إدارة إجازات القوى العاملة' : 'Workforce Leaves'}
           </h3>
        </div>
        <Button onClick={() => router.push('/dashboard/hr/leaves/new')} className="rounded-xl font-bold h-12 px-6 shadow-lg">
          <Plus className="me-2 h-4 w-4" /> {t('common.add')}
        </Button>
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-muted/30">
                  <TableRow>
                     <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'الفترة المخططة' : 'Period'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                     <TableHead className="pe-8 text-end">{isRtl ? 'الإجراءات التنفيذية' : 'Execution'}</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : (
                    leaves?.map((leave) => {
                      const isOverdue = leave.status === 'approved' && (isPast(parseISO(leave.startDate)) || isToday(parseISO(leave.startDate)));
                      
                      return (
                        <TableRow key={leave.id} className="hover:bg-slate-50 transition-colors border-b-slate-100 cursor-pointer" onClick={() => router.push(`/dashboard/hr/leaves/${leave.id}`)}>
                           <TableCell className="py-6 ps-8 text-start font-black text-slate-800">
                              <div className="flex flex-col gap-1">
                                 <span>{leave.userName}</span>
                                 <Badge variant="outline" className="w-fit text-[8px] uppercase">{leave.type}</Badge>
                              </div>
                           </TableCell>
                           <TableCell className="text-start">
                              <div className="flex flex-col text-[10px] font-bold text-slate-400">
                                 <span>{leave.startDate} → {leave.endDate}</span>
                                 <span className="text-primary">{leave.workingDays} {t('hr.workDays')}</span>
                              </div>
                           </TableCell>
                           <TableCell className="text-start">
                              <div className="flex flex-col gap-2">
                                 <Badge className={cn(
                                   "font-black px-3 py-1 border-0 shadow-sm w-fit uppercase text-[9px]",
                                   ['approved', 'on-leave', 'returned', 'commenced'].includes(leave.status) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                 )}>
                                    {leave.status}
                                 </Badge>
                                 {isOverdue && (
                                    <Badge className="bg-rose-50 text-rose-600 border-rose-100 font-black text-[8px] animate-pulse w-fit">
                                       {isRtl ? 'تنبيه: موعد المغادرة حان' : 'DELAYED DEPARTURE'}
                                    </Badge>
                                 )}
                              </div>
                           </TableCell>
                           <TableCell className="pe-8" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-2">
                                 {leave.status === 'pending' && canApprove && (
                                    <Button onClick={() => setProcessingLeave(leave)} className="h-9 px-4 rounded-lg bg-primary font-black text-[10px] gap-2">
                                       <Pencil className="h-3.5 w-3.5" /> {isRtl ? 'قرار الإدارة' : 'Decision'}
                                    </Button>
                                 )}
                                 {leave.status === 'approved' && canApprove && (
                                    <Button onClick={() => setProcessingLeave(leave)} className="h-9 px-4 rounded-lg bg-[#FFB000] font-black text-[10px] gap-2 text-white shadow-md">
                                       <PlaneTakeoff className="h-3.5 w-3.5" /> {isRtl ? 'تسجيل مغادرة' : 'Depart'}
                                    </Button>
                                 )}
                                 {leave.status === 'on-leave' && canApprove && (
                                    <Button onClick={() => setProcessingLeave(leave)} className="h-9 px-4 rounded-lg bg-blue-600 font-black text-[10px] gap-2 text-white shadow-md">
                                       <PlaneLanding className="h-3.5 w-3.5" /> {isRtl ? 'تسجيل عودة' : 'Return'}
                                    </Button>
                                 )}
                                 {leave.status === 'returned' && canApprove && (
                                    <Button onClick={() => setProcessingLeave(leave)} className="h-9 px-4 rounded-lg bg-emerald-600 font-black text-[10px] gap-2 text-white shadow-md">
                                       <Zap className="h-3.5 w-3.5" /> {isRtl ? 'اعتماد مباشرة' : 'Activate'}
                                    </Button>
                                 )}
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

      <Dialog open={!!processingLeave} onOpenChange={open => !open && setProcessingLeave(null)}>
        <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl text-start" dir={dir}>
           <div className="bg-primary/5 p-10 text-slate-900 border-b">
              <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
                 <Clock className="h-9 w-9 text-primary" />
                 {processingLeave?.status === 'pending' ? (isRtl ? 'قرار الإدارة وتصحيح البيانات' : 'Admin Decision') : (isRtl ? 'توثيق التاريخ الفعلي' : 'Document Actual Date')}
              </DialogTitle>
              <p className="text-slate-500 font-bold mt-2">الموظف: {processingLeave?.userName}</p>
           </div>
           
           <div className="p-10 space-y-8 bg-white max-h-[65vh] overflow-y-auto scrollbar-hide">
              {/* الخطوة 1: الموافقة */}
              {processingLeave?.status === 'pending' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-primary/20">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">تاريخ البدء المعتمد</Label><SmartDateInput value={editForm.startDate} onChange={v => setEditForm({...editForm, startDate: v})} /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">تاريخ العودة المعتمد</Label><SmartDateInput value={editForm.endDate} onChange={v => setEditForm({...editForm, endDate: v})} /></div>
                      <div className="col-span-2 space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">أيام الخصم المعتمدة</Label><Input type="number" value={editForm.workingDays} onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} className="h-14 rounded-xl font-black text-2xl text-center border-2" /></div>
                   </div>
                   <div className="flex gap-4">
                      <Button onClick={() => handleAction('rejected')} variant="outline" className="flex-1 h-14 rounded-xl border-rose-100 text-rose-600 font-black">رفض الطلب</Button>
                      <Button onClick={() => handleAction('approved')} className="flex-1 h-14 rounded-xl bg-emerald-600 text-white font-black shadow-lg">اعتماد الإجازة</Button>
                   </div>
                </div>
              )}

              {/* الخطوة 2: المغادرة */}
              {processingLeave?.status === 'approved' && (
                <div className="space-y-6 animate-in zoom-in-95">
                   <div className="space-y-2 text-start">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">تاريخ المغادرة الفعلي للموظف</Label>
                      <SmartDateInput value={editForm.actualDate} onChange={v => setEditForm({...editForm, actualDate: v})} />
                   </div>
                   <Button onClick={() => handleAction('on-leave')} className="w-full h-16 rounded-2xl bg-[#FFB000] text-white font-black text-lg gap-3 border-b-8 border-[#FF5722] shadow-xl">
                      <PlaneTakeoff className="h-6 w-6" /> تسجيل مغادرة الموظف (Depart)
                   </Button>
                </div>
              )}

              {/* الخطوة 3: العودة */}
              {processingLeave?.status === 'on-leave' && (
                <div className="space-y-6 animate-in zoom-in-95">
                   <div className="space-y-2 text-start">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">تاريخ العودة الفعلي من الإجازة</Label>
                      <SmartDateInput value={editForm.actualDate} onChange={v => setEditForm({...editForm, actualDate: v})} />
                   </div>
                   <div className="p-5 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-start gap-3 shadow-inner">
                      <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-blue-800 leading-relaxed">يرجى تسجيل التاريخ الذي باشر فيه الموظف الحضور الفعلي للمنشأة. سيتم استخدام هذا التاريخ لتدقيق الخصم النهائي من الرصيد.</p>
                   </div>
                   <Button onClick={() => handleAction('returned')} className="w-full h-16 rounded-2xl bg-blue-600 text-white font-black text-lg gap-3 shadow-xl border-b-8 border-blue-800">
                      <PlaneLanding className="h-6 w-6" /> تسجيل عودة الموظف (Return)
                   </Button>
                </div>
              )}

              {/* الخطوة 4: المباشرة النهائية */}
              {processingLeave?.status === 'returned' && (
                <div className="space-y-6 animate-in zoom-in-95">
                   <div className="p-8 bg-emerald-50 rounded-[2.5rem] border-2 border-emerald-100 space-y-6 shadow-inner">
                      <div className="flex items-center gap-3 text-emerald-700 font-black mb-2"><CheckCircle2 className="h-6 w-6" /> مراجعة الخصم النهائي</div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">إجمالي أيام الخصم من الرصيد (بعد المراجعة)</Label><Input type="number" value={editForm.workingDays} onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} className="h-16 rounded-xl font-black text-4xl text-emerald-700 text-center bg-white border-2" /></div>
                   </div>
                   <Button onClick={() => handleAction('commenced')} className="w-full h-20 rounded-[2.5rem] bg-emerald-600 text-white font-black text-2xl shadow-xl shadow-emerald-100 border-b-8 border-emerald-800 gap-4">
                      <Zap className="h-8 w-8" /> اعتماد المباشرة وتفعيل الموظف
                   </Button>
                </div>
              )}
           </div>
           
           <div className="p-8 bg-slate-50 border-t flex justify-end shrink-0">
              <Button variant="ghost" onClick={() => setProcessingLeave(null)} className="rounded-xl font-bold px-8">إغلاق</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
