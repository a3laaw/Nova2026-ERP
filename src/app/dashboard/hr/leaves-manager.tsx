'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, Plus, Loader2, CheckCircle2, 
  XCircle, Clock, Search, MessageSquare,
  FileText, Calendar as CalendarIcon
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { LeaveService } from '@/services/leave-service';
import { LeaveRequest, LeaveType } from '@/types/hr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function LeavesManager() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'annual' as LeaveType,
    startDate: '',
    endDate: '',
    reason: ''
  });

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const leavesQuery = useMemo(() => companyId && db ? query(collection(db, 'companies', companyId, 'leaves'), orderBy('createdAt', 'desc')) : null, [db, companyId]);
  const { data: leaves, loading } = useCollection<LeaveRequest>(leavesQuery);

  const handleSubmit = async () => {
    if (!leaveService || !user) return;
    setIsSubmitting(true);
    try {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      await leaveService.submitRequest({
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days: diffDays,
        reason: form.reason
      });

      toast({ title: t('saved'), description: isRtl ? 'تم تقديم طلب الإجازة.' : 'Leave request submitted.' });
      setIsFormOpen(false);
      setForm({ type: 'annual', startDate: '', endDate: '', reason: '' });
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: t('error'),
        description: e.message.includes('UNAUTHORIZED') ? (isRtl ? 'لا تملك صلاحية تقديم الإجازات.' : 'Unauthorized to submit leaves.') : t('saveFailed')
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
      toast({ 
        variant: "destructive", 
        title: t('error'),
        description: e.message.includes('UNAUTHORIZED') ? (isRtl ? 'لا تملك صلاحية اعتماد الإجازات.' : 'Unauthorized to approve leaves.') : t('saveFailed')
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-start">
           <h3 className="text-xl font-black flex items-center gap-2">
             <CalendarDays className="h-6 w-6 text-primary" />
             {isRtl ? 'طلبات الإجازات' : 'Leave Requests'}
           </h3>
           <p className="text-xs font-bold text-muted-foreground mt-1 opacity-70">
             {isRtl ? 'متابعة طلبات الغياب والإجازات الرسمية للموظفين' : 'Tracking employee leaves and absence requests'}
           </p>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20">
              <Plus className="me-2 h-4 w-4" /> {isRtl ? 'طلب إجازة' : 'Request Leave'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] max-w-lg p-0 overflow-hidden border-0 shadow-2xl" dir={dir}>
            <div className="bg-primary/5 p-8 border-b">
               <DialogHeader>
                  <DialogTitle className="text-start font-black text-2xl flex items-center gap-2">
                    <CalendarIcon className="h-6 w-6 text-primary" />
                    {isRtl ? 'تقديم طلب إجازة' : 'Submit Leave Request'}
                  </DialogTitle>
               </DialogHeader>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="space-y-2">
                  <Label className="font-black text-xs uppercase text-slate-400">{isRtl ? 'نوع الإجازة' : 'Leave Type'}</Label>
                  <Select value={form.type} onValueChange={(v: LeaveType) => setForm({...form, type: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="annual">{isRtl ? 'سنوية' : 'Annual'}</SelectItem>
                       <SelectItem value="sick">{isRtl ? 'مرضية' : 'Sick'}</SelectItem>
                       <SelectItem value="emergency">{isRtl ? 'اضطرارية' : 'Emergency'}</SelectItem>
                       <SelectItem value="unpaid">{isRtl ? 'بدون راتب' : 'Unpaid'}</SelectItem>
                    </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label className="font-black text-xs uppercase text-slate-400">{isRtl ? 'من تاريخ' : 'From'}</Label>
                     <Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="h-12 rounded-xl border-2" />
                  </div>
                  <div className="space-y-2">
                     <Label className="font-black text-xs uppercase text-slate-400">{isRtl ? 'إلى تاريخ' : 'To'}</Label>
                     <Input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="h-12 rounded-xl border-2" />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="font-black text-xs uppercase text-slate-400">{isRtl ? 'السبب / ملاحظات' : 'Reason / Notes'}</Label>
                  <Textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="rounded-xl border-2 min-h-[100px]" placeholder="..." />
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleSubmit} disabled={isSubmitting || !form.startDate || !form.endDate} className="w-full h-14 rounded-xl font-black text-lg bg-primary shadow-lg shadow-primary/20">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : (isRtl ? 'إرسال الطلب للاعتماد' : 'Submit for Approval')}
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
                     <TableHead className="text-start font-black py-6 ps-8">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                     <TableHead className="text-start font-black">{isRtl ? 'النوع' : 'Type'}</TableHead>
                     <TableHead className="text-start font-black">{isRtl ? 'الفترة' : 'Period'}</TableHead>
                     <TableHead className="text-center font-black">{isRtl ? 'الأيام' : 'Days'}</TableHead>
                     <TableHead className="text-start font-black">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                     <TableHead className="text-center font-black pe-8"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : leaves?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 italic text-muted-foreground font-bold">{isRtl ? 'لا توجد طلبات إجازة.' : 'No leave requests found.'}</TableCell></TableRow>
                  ) : (
                    leaves?.map((leave) => (
                      <TableRow key={leave.id} className="hover:bg-slate-50 transition-colors group">
                         <TableCell className="py-6 ps-8 text-start font-black text-slate-800">{leave.userName}</TableCell>
                         <TableCell className="text-start">
                            <Badge variant="outline" className="bg-white font-bold uppercase text-[9px] px-3">{leave.type}</Badge>
                         </TableCell>
                         <TableCell className="text-start">
                            <div className="flex flex-col text-[10px] font-bold text-muted-foreground">
                               <span>{leave.startDate}</span>
                               <span className="opacity-40">{leave.endDate}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-center font-black text-slate-700">{leave.days}</TableCell>
                         <TableCell className="text-start">
                            <Badge className={cn(
                              "font-black px-3 py-1 border-0",
                              leave.status === 'approved' ? 'bg-emerald-500 text-white' :
                              leave.status === 'rejected' ? 'bg-destructive text-white' :
                              'bg-amber-50 text-amber-600'
                            )}>
                               {leave.status === 'pending' ? <Clock className="h-3 w-3 me-1" /> : null}
                               {leave.status.toUpperCase()}
                            </Badge>
                         </TableCell>
                         <TableCell className="text-center pe-8">
                            {leave.status === 'pending' && globalUser?.role === 'admin' ? (
                               <div className="flex justify-center gap-2">
                                  <Button onClick={() => handleAction(leave.id!, 'approved')} size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-full text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-5 w-5" /></Button>
                                  <Button onClick={() => handleAction(leave.id!, 'rejected')} size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-full text-destructive hover:bg-destructive/5"><XCircle className="h-5 w-5" /></Button>
                               </div>
                            ) : (
                               <Button variant="ghost" size="icon" className="rounded-xl opacity-0 group-hover:opacity-100"><FileText className="h-4 w-4" /></Button>
                            )}
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
