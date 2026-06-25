'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, Plus, Loader2, CheckCircle2, 
  XCircle, ArrowRight, MessageSquare, Clock,
  Calendar, Hash, Pencil
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

export function LeavesManager() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [processingLeave, setProcessingLeave] = useState<LeaveRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [editForm, setEditForm] = useState({
    comment: '',
    startDate: '',
    endDate: '',
    workingDays: 0
  });

  const viewAccess = check('hr', 'view');
  const canApprove = check('hr', 'approve').can;

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId) : null, 
  [db, companyId]);

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
        workingDays: processingLeave.workingDays
      });
    }
  }, [processingLeave]);

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!leaveService || !user || !processingLeave) return;
    setIsProcessing(true);
    try {
      await leaveService.updateRequestStatus(processingLeave.id!, status, user.uid, {
        comment: editForm.comment,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        workingDays: editForm.workingDays
      });
      toast({ title: isRtl ? "تمت معالجة الطلب" : "Request Processed" });
      setProcessingLeave(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setIsProcessing(false);
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
           <p className="text-[10px] font-bold text-muted-foreground mt-1 opacity-70 italic">
             {viewAccess.scope === 'own' ? (isRtl ? 'عرض سجلاتك الشخصية وحالة طلباتك' : 'View your own requests and status') : (isRtl ? 'إدارة واعتماد إجازات فريق العمل' : 'Manage and approve team leaves')}
           </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/hr/leaves/new')}
          className="rounded-xl font-bold bg-primary text-white shadow-lg h-12 px-6 hover:scale-[1.02] transition-all"
        >
          <Plus className="me-2 h-4 w-4" /> {isRtl ? 'تقديم إجازة' : 'Apply'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
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
                  ) : (
                    leaves?.map((leave) => (
                      <TableRow key={leave.id} className="hover:bg-slate-50 transition-colors group">
                         <TableCell className="py-6 ps-8 text-start font-black text-slate-800">{leave.userName}</TableCell>
                         <TableCell className="text-start">
                            <Badge variant="outline" className="bg-white font-black uppercase text-[9px] px-3">{leave.type}</Badge>
                         </TableCell>
                         <TableCell className="text-start font-mono text-[10px] text-slate-500">{leave.startDate} → {leave.endDate}</TableCell>
                         <TableCell className="text-center"><span className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-xs">{leave.workingDays}</span></TableCell>
                         <TableCell className="text-start">
                            <Badge className={cn(
                              "font-black px-3 py-1 border-0 shadow-sm",
                              leave.status === 'approved' || leave.status === 'commenced' || leave.status === 'on-leave' || leave.status === 'returned' ? 'bg-emerald-500 text-white' :
                              leave.status === 'rejected' ? 'bg-rose-500 text-white' :
                              'bg-amber-50 text-amber-600'
                            )}>
                               {leave.status.toUpperCase()}
                            </Badge>
                         </TableCell>
                         <TableCell className="pe-8">
                            <div className="flex justify-end gap-2">
                               {leave.status === 'pending' && canApprove ? (
                                  <Button 
                                    onClick={() => setProcessingLeave(leave)} 
                                    className="h-10 px-4 rounded-xl bg-primary text-white font-black text-xs gap-2 shadow-lg"
                                  >
                                     <Pencil className="h-3.5 w-3.5" /> {isRtl ? 'معالجة' : 'Process'}
                                  </Button>
                               ) : (
                                  <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/hr/leaves/${leave.id}`)} className="rounded-xl">
                                     <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
                                  </Button>
                               )}
                            </div>
                         </TableCell>
                      </TableRow>
                    ))
                  )}
               </TableBody>
            </Table>
         </CardContent>
      </Card>

      <Dialog open={!!processingLeave} onOpenChange={(open) => !open && setProcessingLeave(null)}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
           <div className="bg-primary/5 p-10 text-slate-900 text-start border-b">
              <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                 <Clock className="h-9 w-9 text-primary" />
                 {isRtl ? 'قرار الإدارة وتصحيح البيانات' : 'Admin Decision & Correction'}
              </DialogTitle>
              <p className="text-slate-500 font-bold mt-2">{isRtl ? `طلب الموظف: ${processingLeave?.userName}` : `Employee: ${processingLeave?.userName}`}</p>
           </div>
           
           <div className="p-10 space-y-8 text-start bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-primary/10">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                       <Calendar className="h-3.5 w-3.5" /> {isRtl ? 'تاريخ البدء المعتمد' : 'Approve Start Date'}
                    </Label>
                    <SmartDateInput value={editForm.startDate} onChange={v => setEditForm({...editForm, startDate: v})} />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                       <Calendar className="h-3.5 w-3.5" /> {isRtl ? 'تاريخ العودة المعتمد' : 'Approve Return Date'}
                    </Label>
                    <SmartDateInput value={editForm.endDate} onChange={v => setEditForm({...editForm, endDate: v})} />
                 </div>
                 <div className="space-y-2 md:col-span-2 pt-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                       <Hash className="h-3.5 w-3.5" /> {isRtl ? 'أيام الخصم الفعلي (بعد المراجعة)' : 'Actual Days to Deduct'}
                    </Label>
                    <Input 
                      type="number" 
                      value={editForm.workingDays} 
                      onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})}
                      className="h-14 rounded-2xl border-2 font-black text-primary text-lg"
                    />
                 </div>
              </div>

              <div className="space-y-3">
                 <Label className="font-black text-xs uppercase text-slate-500 flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {isRtl ? 'ملاحظات الإدارة أو سبب الرفض' : 'Internal Notes / Reason'}
                 </Label>
                 <Textarea 
                   value={editForm.comment} 
                   onChange={(e) => setEditForm({...editForm, comment: e.target.value})}
                   className="min-h-[100px] rounded-2xl border-2 p-6 text-base focus:bg-slate-50 transition-all shadow-inner"
                   placeholder={isRtl ? "اكتب هنا ملاحظاتك للموظف..." : "Enter feedback..."}
                 />
              </div>
           </div>

           <DialogFooter className="p-10 bg-slate-50 border-t flex flex-row gap-4">
              <Button 
                onClick={() => handleAction('rejected')}
                disabled={isProcessing}
                variant="outline"
                className="flex-1 h-16 rounded-2xl border-2 border-rose-100 text-rose-600 font-black text-lg hover:bg-rose-50 transition-all"
              >
                 {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <XCircle className="me-2 h-6 w-6" />}
                 {isRtl ? 'رفض الطلب' : 'Reject'}
              </Button>
              <Button 
                onClick={() => handleAction('approved')}
                disabled={isProcessing}
                className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all gap-2 border-b-8 border-emerald-800"
              >
                 {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="me-2 h-6 w-6" />}
                 {isRtl ? 'اعتماد وصرف' : 'Approve'}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
