'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, Plus, Loader2, CheckCircle2, 
  XCircle, ArrowRight, MessageSquare, Save, Clock
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function LeavesManager() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [processingLeave, setProcessingLeave] = useState<LeaveRequest | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);
  const { data: leaves, loading } = useCollection<LeaveRequest>(leavesQuery);

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!leaveService || !user || !processingLeave) return;
    setIsProcessing(true);
    try {
      await leaveService.updateRequestStatus(processingLeave.id!, status, user.uid, {
        comment: adminComment
      });
      toast({ title: t('saved') });
      setProcessingLeave(null);
      setAdminComment("");
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
           <p className="text-xs font-bold text-muted-foreground mt-1 opacity-70">
             {isRtl ? 'نظام الحساب الآلي للإجازات والغياب' : 'Automated leave and absence calculation system'}
           </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/hr/leaves/new')}
          className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 h-12 px-6 hover:scale-[1.02] transition-transform"
        >
          <Plus className="me-2 h-4 w-4" /> {isRtl ? 'تقديم إجازة' : 'Apply for Leave'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5" dir={dir}>
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
                            <div className="flex justify-end gap-2">
                               {leave.status === 'pending' && (globalUser?.role === 'admin' || globalUser?.role === 'Admin') ? (
                                  <Button 
                                    onClick={() => setProcessingLeave(leave)} 
                                    size="sm" 
                                    className="h-10 px-4 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold text-xs"
                                  >
                                     {isRtl ? 'معالجة الطلب' : 'Process'}
                                  </Button>
                               ) : (
                                  <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/hr/leaves/${leave.id}`)} className="rounded-xl h-10 w-10">
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

      {/* نافذة معالجة الطلب الذكية */}
      <Dialog open={!!processingLeave} onOpenChange={(open) => !open && setProcessingLeave(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-xl p-0 overflow-hidden" dir={dir}>
           <div className="bg-primary/5 p-8 border-b">
              <DialogTitle className="text-start font-black text-2xl flex items-center gap-3">
                 <Clock className="h-7 w-7 text-primary" />
                 {isRtl ? 'اتخاذ قرار بشأن الإجازة' : 'Process Leave Request'}
              </DialogTitle>
              <DialogDescription className="text-start font-bold mt-2">
                 {isRtl ? `موظف: ${processingLeave?.userName}` : `Employee: ${processingLeave?.userName}`}
              </DialogDescription>
           </div>
           
           <div className="p-8 space-y-6 text-start">
              <div className="p-4 rounded-2xl bg-slate-50 border-2 border-white shadow-inner grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'الفترة المطلوبة' : 'Period'}</Label>
                    <p className="text-xs font-black">{processingLeave?.startDate} → {processingLeave?.endDate}</p>
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'أيام العمل' : 'Work Days'}</Label>
                    <p className="text-xs font-black text-primary">{processingLeave?.workingDays} {isRtl ? 'يوم' : 'Days'}</p>
                 </div>
              </div>

              <div className="space-y-3">
                 <Label className="font-black text-xs uppercase text-slate-500 flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" />
                    {isRtl ? 'ملاحظات الإدارة / سبب الرفض' : 'Admin Notes / Reason'}
                 </Label>
                 <Textarea 
                   value={adminComment} 
                   onChange={(e) => setAdminComment(e.target.value)}
                   className="min-h-[120px] rounded-2xl border-2 p-4 text-sm"
                   placeholder={isRtl ? "اكتب هنا أي ملاحظات تود إبلاغ الموظف بها..." : "Enter any notes for the employee..."}
                 />
              </div>
           </div>

           <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
              <Button 
                onClick={() => handleAction('rejected')}
                disabled={isProcessing}
                variant="outline"
                className="flex-1 h-14 rounded-xl border-2 border-rose-100 text-rose-600 font-black hover:bg-rose-50"
              >
                 {isProcessing ? <Loader2 className="animate-spin" /> : <XCircle className="me-2 h-5 w-5" />}
                 {isRtl ? 'رفض الطلب' : 'Reject'}
              </Button>
              <Button 
                onClick={() => handleAction('approved')}
                disabled={isProcessing}
                className="flex-1 h-14 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 shadow-xl shadow-emerald-100"
              >
                 {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="me-2 h-5 w-5" />}
                 {isRtl ? 'اعتماد الإجازة' : 'Approve'}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
