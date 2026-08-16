'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, CheckCircle2, XCircle,
  User, History, Printer, PlaneTakeoff, PlaneLanding, Scale,
  Clock, ShieldAlert, AlertTriangle, Info, CalendarDays,
  ArrowRight, Landmark, Zap, ShieldCheck, Save, X
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { LeaveService } from '@/services/leave-service';
import { LeaveRequest } from '@/types/hr';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

/**
 * @fileOverview صفحة تفاصيل الإجازة السيادية.
 * تم تحديثها لفرض التوثيق اليدوي للمغادرة والعودة عبر نوافذ منبثقة (Popups).
 */
export default function LeaveDetailsPage() {
  const leaveId = useParams().id as string;
  const { user, globalUser } = useAuthContext();
  const { t, lang, dir, isRtl, tSafe } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();

  const [processing, setProcessing] = useState(false);
  const [showExecutionDialog, setShowExecutionDialog] = useState<'depart' | 'return' | 'commence' | null>(null);
  
  const [editForm, setEditForm] = useState({
    comment: '',
    startDate: '',
    endDate: '',
    workingDays: 0,
    actualDate: new Date().toISOString().split('T')[0]
  });

  const companyId = globalUser?.companyId;
  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const leaveRef = useMemo(() => 
    companyId && db ? doc(db, paths.leaveRequests(companyId), leaveId) : null, 
  [db, companyId, leaveId]);

  const { data: leave, loading } = useDoc<LeaveRequest>(leaveRef);

  useEffect(() => {
    if (leave) {
      setEditForm(prev => ({
        ...prev,
        comment: leave.comment || '',
        startDate: leave.startDate,
        endDate: leave.endDate,
        workingDays: leave.workingDays
      }));
    }
  }, [leave]);

  const handleAction = async (status: LeaveRequest['status']) => {
    if (!leaveService || !user) return;
    setProcessing(true);
    try {
      await leaveService.updateRequestStatus(leaveId, status, user.uid, {
        comment: editForm.comment,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        workingDays: editForm.workingDays,
        actualDepartureDate: status === 'on-leave' ? editForm.actualDate : undefined,
        actualReturnDate: status === 'returned' ? editForm.actualDate : undefined
      });
      toast({ title: t('common.saved') });
      setShowExecutionDialog(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!leave) return <div className="p-20 text-center text-slate-400 font-bold">{t('hr.requestNotFound')}</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4 text-start">
           <Button variant="ghost" onClick={() => router.back()} className="h-10 w-10 p-0 rounded-xl border-2 bg-white shadow-sm hover:text-primary transition-all text-slate-400">
             <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <div className="flex items-center gap-3">
                 <h1 className="text-3xl font-black font-headline text-slate-900">{t('hr.leaveStatus')}</h1>
                 <Badge className={cn(
                   "font-black px-4 py-1 rounded-xl shadow-sm uppercase text-[10px]",
                   leave.status === 'approved' ? 'bg-blue-500 text-white' : 
                   leave.status === 'on-leave' ? 'bg-amber-500 text-white' :
                   leave.status === 'returned' ? 'bg-purple-500 text-white' :
                   leave.status === 'commenced' ? 'bg-emerald-500 text-white' :
                   leave.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200 border' : 
                   'bg-rose-500 text-white'
                 )}>
                    {t('status.' + leave.status)}
                 </Badge>
              </div>
           </div>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="rounded-xl h-10 px-6 font-black gap-2 border-2">
           <Printer className="h-4 w-4" /> {t('common.print')}
        </Button>
      </div>

      <PrintWrapper title={t('hr.officialAuthorization')}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           <div className="lg:col-span-8 space-y-8">
              
              {/* لوحة التحكم التنفيذية - أزرار تفتح نوافذ منبثقة */}
              {isAdmin && ['approved', 'on-leave', 'returned'].includes(leave.status) && (
                <Card className="border-4 border-dashed border-primary/20 rounded-[2.5rem] bg-white overflow-hidden shadow-2xl print:hidden">
                   <div className="bg-primary/5 p-8 border-b text-start">
                      <h3 className="text-xl font-black font-headline flex items-center gap-3">
                         <Zap className="h-6 w-6 text-primary" />
                         {isRtl ? 'إجراءات التنفيذ الميداني' : 'Field Execution Actions'}
                      </h3>
                   </div>
                   <CardContent className="p-10 flex gap-4">
                      {leave.status === 'approved' && (
                        <Button onClick={() => setShowExecutionDialog('depart')} className="flex-1 h-20 rounded-3xl bg-[#FFB000] text-white font-black text-xl shadow-xl border-b-8 border-[#FF5722] gap-4 hover:scale-[1.02] transition-all">
                           <PlaneTakeoff className="h-8 w-8" /> {isRtl ? 'تسجيل مغادرة الموظف' : 'Register Departure'}
                        </Button>
                      )}
                      {leave.status === 'on-leave' && (
                        <Button onClick={() => setShowExecutionDialog('return')} className="flex-1 h-20 rounded-3xl bg-blue-600 text-white font-black text-xl shadow-xl border-b-8 border-blue-800 gap-4 hover:scale-[1.02] transition-all">
                           <PlaneLanding className="h-8 w-8" /> {isRtl ? 'تسجيل عودة الموظف' : 'Register Return'}
                        </Button>
                      )}
                      {leave.status === 'returned' && (
                        <Button onClick={() => setShowExecutionDialog('commence')} className="flex-1 h-20 rounded-3xl bg-emerald-600 text-white font-black text-xl shadow-xl border-b-8 border-emerald-800 gap-4 hover:scale-[1.02] transition-all">
                           <Zap className="h-8 w-8" /> {isRtl ? 'اعتماد مباشرة العمل' : 'Final Activation'}
                        </Button>
                      )}
                   </CardContent>
                </Card>
              )}

              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-50/50 border-b p-8">
                    <CardTitle className="text-xl font-black text-start">{t('hr.requestDetails')}</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-10 text-start">
                    <div className="flex items-center gap-6">
                       <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/10">
                          <User className="h-8 w-8" />
                       </div>
                       <div className="text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.name')}</p>
                          <h4 className="text-2xl font-black text-slate-900">{leave.userName}</h4>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="p-6 rounded-2xl bg-slate-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">النوع</p>
                          <p className="text-lg font-black text-primary uppercase">{leave.type}</p>
                       </div>
                       <div className="p-6 rounded-2xl bg-slate-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي الأيام</p>
                          <p className="text-lg font-black text-slate-900">{leave.days} {t('common.days')}</p>
                       </div>
                       <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">الخصم من الرصيد</p>
                          <p className="text-lg font-black text-emerald-700">{leave.workingDays} {t('hr.workDays')}</p>
                       </div>
                    </div>

                    <div className="p-8 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                       <div className="text-center md:text-start space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ البدء المخطط</p>
                          <p className="text-2xl font-black text-slate-900">{leave.startDate}</p>
                       </div>
                       <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                          <ArrowRight className={cn("h-6 w-6", isRtl && "rotate-180")} />
                       </div>
                       <div className="text-center md:text-end space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ العودة المخطط</p>
                          <p className="text-2xl font-black text-slate-900">{leave.endDate}</p>
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>

           <div className="lg:col-span-4 space-y-6">
              <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
                 <CardHeader className="bg-slate-50 border-b p-6">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                       <History className="h-5 w-5 text-primary" />
                       سجل التنفيذ الفعلي
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                    <div className="space-y-6 text-start">
                       <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                          <div className="absolute -start-[9px] top-0 h-4 w-4 rounded-full bg-primary border-4 border-white shadow-sm" />
                          <p className="text-[9px] font-black text-slate-400 uppercase">تاريخ الطلب</p>
                          <p className="text-xs font-bold text-slate-700 mt-1">{leave.createdAt?.toDate().toLocaleString()}</p>
                       </div>
                       {leave.actualDepartureDate && (
                          <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                             <div className="absolute -start-[9px] top-0 h-4 w-4 rounded-full bg-amber-500 border-4 border-white shadow-sm" />
                             <p className="text-[9px] font-black text-amber-600 uppercase">المغادرة الفعلية</p>
                             <p className="text-xs font-bold text-slate-700 mt-1">{leave.actualDepartureDate}</p>
                          </div>
                       )}
                       {leave.actualReturnDate && (
                          <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                             <div className="absolute -start-[9px] top-0 h-4 w-4 rounded-full bg-purple-500 border-4 border-white shadow-sm" />
                             <p className="text-[9px] font-black text-purple-600 uppercase">العودة الفعلية</p>
                             <p className="text-xs font-bold text-slate-700 mt-1">{leave.actualReturnDate}</p>
                          </div>
                       )}
                    </div>
                 </CardContent>
              </Card>
           </div>
        </div>
      </PrintWrapper>

      {/* النوافذ المنبثقة الإلزامية */}
      <Dialog open={!!showExecutionDialog} onOpenChange={() => setShowExecutionDialog(null)}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-xl text-start" dir={dir}>
            <div className="bg-primary/5 p-10 text-slate-900 border-b">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                  {showExecutionDialog === 'depart' && <PlaneTakeoff className="h-9 w-9 text-orange-500" />}
                  {showExecutionDialog === 'return' && <PlaneLanding className="h-9 w-9 text-blue-600" />}
                  {showExecutionDialog === 'commence' && <ShieldCheck className="h-9 w-9 text-emerald-600" />}
                  {showExecutionDialog === 'depart' ? 'توثيق مغادرة الموظف' : 
                   showExecutionDialog === 'return' ? 'توثيق العودة الفعلية' : 
                   'اعتماد المباشرة النهائية'}
               </DialogTitle>
               <p className="text-slate-500 font-bold mt-2 italic">{leave.userName}</p>
            </div>

            <div className="p-10 space-y-8 bg-white">
               {showExecutionDialog === 'depart' && (
                  <div className="space-y-6">
                     <div className="p-8 bg-orange-50/50 rounded-[2.5rem] border-2 border-orange-100 space-y-4 shadow-inner">
                        <Label className="text-[11px] font-black uppercase text-orange-600 tracking-widest text-center block">تاريخ خروج الموظف الفعلي</Label>
                        <SmartDateInput value={editForm.actualDate} onChange={v => setEditForm({...editForm, actualDate: v})} />
                     </div>
                     <Button onClick={() => handleAction('on-leave')} disabled={processing} className="w-full h-16 rounded-2xl bg-[#FFB000] text-white font-black text-xl shadow-xl border-b-8 border-[#FF5722] gap-4">
                        <CheckCircle2 className="h-6 w-6" /> تأكيد المغادرة
                     </Button>
                  </div>
               )}

               {showExecutionDialog === 'return' && (
                  <div className="space-y-6">
                     <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border-2 border-blue-100 space-y-4 shadow-inner">
                        <Label className="text-[11px] font-black uppercase text-blue-600 tracking-widest text-center block">تاريخ عودة الموظف الفعلي</Label>
                        <SmartDateInput value={editForm.actualDate} onChange={v => setEditForm({...editForm, actualDate: v})} />
                     </div>
                     <Button onClick={() => handleAction('returned')} disabled={processing} className="w-full h-16 rounded-2xl bg-blue-600 text-white font-black text-xl shadow-xl border-b-8 border-blue-800 gap-4">
                        <CheckCircle2 className="h-6 w-6" /> تسجيل العودة
                     </Button>
                  </div>
               )}

               {showExecutionDialog === 'commence' && (
                  <div className="space-y-8">
                     <div className="p-10 bg-emerald-50 rounded-[3rem] border-2 border-emerald-100 space-y-8 shadow-inner">
                        <div className="space-y-2 text-start">
                           <Label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest">أيام الخصم النهائية (المراجعة)</Label>
                           <Input 
                             type="number" 
                             value={editForm.workingDays} 
                             onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} 
                             className="h-20 rounded-2xl font-black text-6xl text-emerald-700 text-center bg-white border-2 border-emerald-200 shadow-xl" 
                           />
                           <p className="text-[10px] text-slate-400 font-bold text-center mt-2 italic">يتم خصم هذه الأيام من رصيد الموظف السنوي فور الاعتماد.</p>
                        </div>
                     </div>
                     <Button onClick={() => handleAction('commenced')} disabled={processing} className="w-full h-24 rounded-[3rem] bg-emerald-600 text-white font-black text-3xl shadow-xl shadow-emerald-100 border-b-8 border-emerald-800 gap-6">
                        <Zap className="h-10 w-10" /> اعتماد وتفعيل الموظف
                     </Button>
                  </div>
               )}
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex justify-end">
               <Button variant="ghost" onClick={() => setShowExecutionDialog(null)} className="rounded-xl font-bold px-10 text-slate-400">إلغاء</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
