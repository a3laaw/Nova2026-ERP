'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, CheckCircle2, XCircle,
  Calendar, User, FileText, AlertTriangle,
  History, ShieldCheck, MessageSquare, Hash,
  Scale, Info, PlaneTakeoff, PlaneLanding, Briefcase,
  Timer, Pencil, Save, Clock, Printer
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

export default function LeaveDetailsPage() {
  const leaveId = useParams().id as string;
  const { user, globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { isAdmin, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const [processing, setProcessing] = useState(false);
  const [actualReturnDate, setActualReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [editForm, setEditForm] = useState({
    comment: '',
    startDate: '',
    endDate: '',
    workingDays: 0
  });

  // فحص صلاحية الطباعة
  const canPrint = check('hr', 'print').can;

  const companyId = globalUser?.companyId;
  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId) : null, 
  [db, companyId]);

  const leaveRef = useMemo(() => 
    companyId && db ? doc(db, paths.leaveRequests(companyId), leaveId) : null, 
  [db, companyId, leaveId]);

  const { data: leave, loading } = useDoc<LeaveRequest>(leaveRef);

  useEffect(() => {
    if (leave) {
      setEditForm({
        comment: leave.comment || '',
        startDate: leave.startDate,
        endDate: leave.endDate,
        workingDays: leave.workingDays
      });
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
        actualReturnDate: actualReturnDate
      });
      toast({ title: t('saved') });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!leave) return <div className="p-20 text-center text-slate-400 font-bold">{isRtl ? 'الطلب غير موجود' : 'Request not found'}</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      
      {/* Header Actions */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/hr/leaves')} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'حالة طلب الإجازة' : 'Leave Request Status'}</h1>
                <Badge className={cn(
                  "font-black px-4 py-1 rounded-xl shadow-sm uppercase",
                  leave.status === 'approved' ? 'bg-blue-500 text-white' : 
                  leave.status === 'on-leave' ? 'bg-amber-500 text-white' :
                  leave.status === 'returned' ? 'bg-purple-500 text-white' :
                  leave.status === 'commenced' ? 'bg-emerald-500 text-white' :
                  leave.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200 border' : 
                  'bg-rose-500 text-white'
                )}>
                   {leave.status}
                </Badge>
             </div>
          </div>
        </div>

        {/* زر الطباعة مع فحص الصلاحية */}
        {canPrint && (
           <Button 
             onClick={handlePrint}
             className="h-12 px-6 rounded-xl bg-white border-2 text-slate-900 font-black gap-2 hover:bg-slate-50 transition-all shadow-sm"
           >
              <Printer className="h-5 w-5 text-primary" />
              {isRtl ? 'طباعة مستند الإجازة' : 'Print Document'}
           </Button>
        )}
      </div>

      <PrintWrapper title={isRtl ? "إقرار إجازة رسمية" : "Official Leave Authorization"}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              
              {/* Main Decision Area for Admin (Hidden on Print) */}
              {isAdmin && leave.status === 'pending' && (
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-2 ring-primary/20 print:hidden">
                   <div className="bg-slate-900 p-8 text-white text-start">
                      <h3 className="text-2xl font-black font-headline flex items-center gap-3">
                         <Clock className="h-7 w-7 text-primary" />
                         {isRtl ? 'قرار الإدارة وتصحيح البيانات' : 'Admin Decision & Correction'}
                      </h3>
                      <p className="text-slate-400 font-bold mt-1">{isRtl ? 'بإمكانك تعديل التواريخ أو الأيام قبل الاعتماد.' : 'You can adjust dates or days before approval.'}</p>
                   </div>
                   <CardContent className="p-8 space-y-8 text-start">
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
                               <Hash className="h-3.5 w-3.5" /> {isRtl ? 'أيام الخصم الفعلي (بعد المراجعة القانونية)' : 'Actual Days to Deduct'}
                            </Label>
                            <Input 
                              type="number" 
                              value={editForm.workingDays} 
                              onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})}
                              className="h-14 rounded-2xl border-2 font-black text-primary text-xl"
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

                      <div className="flex gap-4 pt-4">
                         <Button 
                           onClick={() => handleAction('rejected')}
                           disabled={processing}
                           variant="outline"
                           className="flex-1 h-16 rounded-2xl border-2 border-rose-100 text-rose-600 font-black text-lg hover:bg-rose-50 transition-all"
                         >
                            {processing ? <Loader2 className="animate-spin h-5 w-5" /> : <XCircle className="me-2 h-6 w-6" />}
                            {isRtl ? 'رفض الطلب' : 'Reject'}
                         </Button>
                         <Button 
                           onClick={() => handleAction('approved')}
                           disabled={processing}
                           className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all gap-2"
                         >
                            {processing ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="me-2 h-6 w-6" />}
                            {isRtl ? 'اعتماد وصرف' : 'Approve'}
                         </Button>
                      </div>
                   </CardContent>
                </Card>
              )}

              {/* Request Info Summary (Always Visible/Printable) */}
              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden text-start">
                 <CardHeader className="bg-slate-50/50 border-b p-8">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                       <User className="h-6 w-6 text-primary" /> {leave.userName}
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                       <div className="p-6 rounded-3xl bg-slate-50 border space-y-1">
                          <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'بداية الإجازة المعتمدة' : 'Approved Start'}</Label>
                          <p className="text-2xl font-black text-slate-800">{leave.startDate}</p>
                       </div>
                       <div className="p-6 rounded-3xl bg-slate-50 border space-y-1">
                          <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ العودة للعمل' : 'Approved Return'}</Label>
                          <p className="text-2xl font-black text-slate-800">{leave.endDate}</p>
                       </div>
                    </div>

                    <div className="p-8 rounded-[2rem] bg-emerald-50/30 border-2 border-emerald-100 flex justify-between items-center">
                       <div className="text-start">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{isRtl ? 'صافي أيام الخصم من الرصيد' : 'Net Deduction Days'}</p>
                          <p className="text-4xl font-black text-emerald-700 mt-1">{leave.workingDays} <span className="text-sm font-bold">{isRtl ? 'يوم' : 'Days'}</span></p>
                       </div>
                       <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                          <Scale className="h-8 w-8" />
                       </div>
                    </div>

                    {/* Timeline Actions (Hidden on Print) */}
                    <div className="pt-8 border-t space-y-6 print:hidden">
                       <h3 className="font-black text-lg flex items-center gap-2 text-slate-800">
                          <History className="h-5 w-5 text-primary" /> {isRtl ? 'إجراءات المسار الزمني' : 'Timeline Actions'}
                       </h3>

                       <div className="grid grid-cols-1 gap-4">
                          {leave.status === 'approved' && (
                            <div className="p-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-between animate-in zoom-in-95">
                               <div className="text-start">
                                  <h4 className="font-black text-blue-900">{isRtl ? 'تأكيد المغادرة في إجازة' : 'Confirm Departure'}</h4>
                                  <p className="text-xs font-bold text-blue-700 opacity-70">{isRtl ? 'يتم الضغط هنا عند بدء الموظف لإجازته فعلياً.' : 'Click when the employee actually starts the leave.'}</p>
                               </div>
                               <Button onClick={() => handleAction('on-leave')} disabled={processing} className="bg-blue-600 text-white font-black rounded-xl h-12 px-8">
                                  <PlaneTakeoff className="me-2 h-5 w-5" /> {isRtl ? 'تأكيد المغادرة' : 'Confirm'}
                               </Button>
                            </div>
                          )}

                          {leave.status === 'on-leave' && (
                            <div className="p-6 rounded-3xl bg-purple-50 border-2 border-purple-100 space-y-4 animate-in zoom-in-95">
                               <div className="text-start">
                                  <h4 className="font-black text-purple-900">{isRtl ? 'تسجيل العودة من الإجازة' : 'Record Return'}</h4>
                                  <p className="text-xs font-bold text-purple-700 opacity-70">{isRtl ? 'أدخل تاريخ العودة الفعلي للموظف للمنشأة.' : 'Enter the actual date the employee returned.'}</p>
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="flex-1">
                                     <SmartDateInput value={actualReturnDate} onChange={setActualReturnDate} />
                                  </div>
                                  <Button onClick={() => handleAction('returned')} disabled={processing} className="bg-purple-600 text-white font-black rounded-xl h-12 px-8">
                                     <PlaneLanding className="me-2 h-5 w-5" /> {isRtl ? 'تسجيل العودة' : 'Record'}
                                  </Button>
                               </div>
                            </div>
                          )}

                          {leave.status === 'returned' && isAdmin && (
                            <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-between animate-in zoom-in-95">
                               <div className="text-start">
                                  <h4 className="font-black text-emerald-900">{isRtl ? 'اعتماد مباشرة العمل' : 'Confirm Work Commencement'}</h4>
                                  <p className="text-xs font-bold text-emerald-700 opacity-70">{isRtl ? 'إقرار رسمي بأن الموظف استلم مهامه الميدانية.' : 'Official confirmation that the employee is back on duty.'}</p>
                               </div>
                               <Button onClick={() => handleAction('commenced')} disabled={processing} className="bg-emerald-600 text-white font-black rounded-xl h-12 px-8">
                                  <Briefcase className="me-2 h-5 w-5" /> {isRtl ? 'مباشرة عمل' : 'Commence'}
                               </Button>
                            </div>
                          )}
                          
                          {leave.status === 'pending' && !isAdmin && (
                             <div className="p-10 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-amber-200">
                                <Timer className="h-12 w-12 text-amber-500 mx-auto mb-2" />
                                <h4 className="font-black text-amber-900">{isRtl ? 'الطلب قيد المراجعة' : 'Pending Review'}</h4>
                                <p className="text-xs font-bold text-slate-400 mt-1">{isRtl ? 'بانتظار قرار الإدارة لاعتماد التواريخ وأيام الخصم.' : 'Waiting for admin decision on dates and deduction days.'}</p>
                             </div>
                          )}
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>

           <div className="space-y-6">
              {/* Audit Log - Styled for Print Receipt */}
              <Card className="border-0 shadow-lg rounded-[2.5rem] bg-slate-900 text-white p-8 text-start space-y-6">
                 <h3 className="font-black text-sm uppercase tracking-widest text-primary">{isRtl ? 'سجل التدقيق الزمني' : 'Audit Trail'}</h3>
                 <div className="space-y-6">
                    <div className="flex gap-4 items-start">
                       <div className="h-2 w-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                       <div className="text-start">
                          <p className="text-xs font-black">{isRtl ? 'تقديم الطلب' : 'Submitted'}</p>
                          <p className="text-[10px] text-slate-400">{new Date(leave.createdAt.toDate()).toLocaleString()}</p>
                       </div>
                    </div>
                    {leave.approvedAt && (
                      <div className="flex gap-4 items-start border-t border-white/5 pt-4">
                         <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                         <div className="text-start">
                            <p className="text-xs font-black">{isRtl ? 'تم الاعتماد' : 'Approved'}</p>
                            <p className="text-[10px] text-slate-400">{new Date(leave.approvedAt.toDate()).toLocaleString()}</p>
                         </div>
                      </div>
                    )}
                 </div>
                 
                 {/* Signature area for print only */}
                 <div className="hidden print:block pt-10 border-t border-white/10 space-y-8">
                    <div className="space-y-1">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'توقيع الموظف' : 'Employee Sign'}</p>
                       <div className="h-10 w-full border-b border-white/10" />
                    </div>
                    <div className="space-y-1">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'ختم الإدارة' : 'Official Stamp'}</p>
                       <div className="h-16 w-16 border-2 border-white/10 rounded-full mx-auto" />
                    </div>
                 </div>
              </Card>

              <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white p-8 text-start space-y-4">
                 <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                    <Info className="h-4 w-4" /> {isRtl ? 'ملاحظات الإدارة' : 'Admin Notes'}
                 </div>
                 <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                    {leave.comment || (isRtl ? 'لا يوجد ملاحظات مسجلة بعد.' : 'No notes recorded yet.')}
                 </p>
              </Card>
           </div>
        </div>
      </PrintWrapper>
    </div>
  );
}
