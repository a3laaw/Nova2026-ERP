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
  
  // تواريخ مرنة للعمليات
  const [actualDepartureDate, setActualDepartureDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualReturnDate, setActualReturnDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [editForm, setEditForm] = useState({
    comment: '',
    startDate: '',
    endDate: '',
    workingDays: 0
  });

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
      // تهيئة تواريخ العمليات بتاريخ اليوم كافتراضي
      const today = new Date().toISOString().split('T')[0];
      setActualDepartureDate(today);
      setActualReturnDate(today);
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
        actualReturnDate: actualReturnDate,
        actualDepartureDate: actualDepartureDate
      });
      toast({ title: t('saved') });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "فشل التحديث، يرجى مراجعة الصلاحيات." : "Update failed, check permissions." });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!leave) return <div className="p-20 text-center text-slate-400 font-bold">{isRtl ? 'الطلب غير موجود' : 'Request not found'}</div>;

  const isOwner = user?.uid === leave.userId || user?.uid === (leave as any).createdBy;
  const canPrint = check('hr', 'print').can;

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

        {canPrint && (
           <Button 
             onClick={() => window.print()}
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
              
              {/* واجهة قرار الإدارة (للأدمن فقط) */}
              {isAdmin && leave.status === 'pending' && (
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-2 ring-primary/20 print:hidden">
                   <div className="bg-slate-900 p-8 text-white text-start">
                      <h3 className="text-2xl font-black font-headline flex items-center gap-3">
                         <Clock className="h-7 w-7 text-primary" />
                         {isRtl ? 'قرار الإدارة وتصحيح البيانات' : 'Admin Decision & Correction'}
                      </h3>
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
                            <MessageSquare className="h-3.5 w-3.5" /> {isRtl ? 'ملاحظات الإدارة' : 'Internal Notes'}
                         </Label>
                         <Textarea 
                           value={editForm.comment} 
                           onChange={(e) => setEditForm({...editForm, comment: e.target.value})}
                           className="min-h-[100px] rounded-2xl border-2 p-6"
                         />
                      </div>
                      <div className="flex gap-4">
                         <Button onClick={() => handleAction('rejected')} disabled={processing} variant="outline" className="flex-1 h-16 rounded-2xl border-2 text-rose-600 font-black">
                            {isRtl ? 'رفض الطلب' : 'Reject'}
                         </Button>
                         <Button onClick={() => handleAction('approved')} disabled={processing} className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black">
                            {isRtl ? 'اعتماد وصرف' : 'Approve'}
                         </Button>
                      </div>
                   </CardContent>
                </Card>
              )}

              {/* تفاصيل الإجازة العامة */}
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
                       <Scale className="h-8 w-8 text-emerald-600" />
                    </div>

                    {/* إجراءات المسار الزمني (خدمة ذاتية ورقابة) */}
                    <div className="pt-8 border-t space-y-6 print:hidden">
                       <h3 className="font-black text-lg flex items-center gap-2 text-slate-800">
                          <History className="h-5 w-5 text-primary" /> {isRtl ? 'إجراءات المسار الزمني (التتبع الفعلي)' : 'Timeline Actions'}
                       </h3>

                       <div className="grid grid-cols-1 gap-6">
                          {/* 1. تأكيد المغادرة: مع مرونة التاريخ */}
                          {leave.status === 'approved' && (isOwner || isAdmin) && (
                            <div className="p-8 rounded-[2.5rem] bg-blue-50 border-2 border-blue-100 space-y-6 animate-in zoom-in-95">
                               <div className="text-start">
                                  <h4 className="font-black text-xl text-blue-900 flex items-center gap-2">
                                     <PlaneTakeoff className="h-6 w-6" /> {isRtl ? 'تأكيد المغادرة في إجازة' : 'Confirm Departure'}
                                  </h4>
                                  <p className="text-sm font-bold text-blue-700/60 mt-1">{isRtl ? 'سجل تاريخ خروج الموظف الفعلي لبدء تتبع الحالة.' : 'Record actual departure date to start tracking.'}</p>
                               </div>
                               <div className="flex flex-col md:flex-row items-end gap-4 bg-white/50 p-6 rounded-3xl border border-blue-100">
                                  <div className="flex-1 space-y-2 w-full">
                                     <Label className="text-[10px] font-black text-blue-400 uppercase">{isRtl ? 'تاريخ الخروج الفعلي' : 'Actual Departure Date'}</Label>
                                     <SmartDateInput value={actualDepartureDate} onChange={setActualDepartureDate} />
                                  </div>
                                  <Button onClick={() => handleAction('on-leave')} disabled={processing} className="w-full md:w-48 h-12 rounded-xl bg-blue-600 text-white font-black shadow-lg">
                                     {processing ? <Loader2 className="animate-spin h-5 w-5" /> : isRtl ? 'تأكيد الخروج' : 'Confirm'}
                                  </Button>
                               </div>
                            </div>
                          )}

                          {/* 2. تسجيل العودة: مع مرونة التاريخ (الحالة الأهم في النسيان) */}
                          {leave.status === 'on-leave' && (isOwner || isAdmin) && (
                            <div className="p-8 rounded-[2.5rem] bg-purple-50 border-2 border-purple-100 space-y-6 animate-in zoom-in-95">
                               <div className="text-start">
                                  <h4 className="font-black text-xl text-purple-900 flex items-center gap-2">
                                     <PlaneLanding className="h-6 w-6" /> {isRtl ? 'تسجيل العودة من الإجازة' : 'Record Return'}
                                  </h4>
                                  <p className="text-sm font-bold text-purple-700/60 mt-1">{isRtl ? 'في حال نسيان التسجيل فوراً، يرجى اختيار التاريخ الصحيح لعودتك.' : 'If you forgot to register, please select your actual return date.'}</p>
                               </div>
                               <div className="flex flex-col md:flex-row items-end gap-4 bg-white/50 p-6 rounded-3xl border border-purple-100">
                                  <div className="flex-1 space-y-2 w-full">
                                     <Label className="text-[10px] font-black text-purple-400 uppercase">{isRtl ? 'تاريخ الوصول الفعلي' : 'Actual Return Date'}</Label>
                                     <SmartDateInput value={actualReturnDate} onChange={setActualReturnDate} />
                                  </div>
                                  <Button onClick={() => handleAction('returned')} disabled={processing} className="w-full md:w-48 h-12 rounded-xl bg-purple-600 text-white font-black shadow-lg">
                                     {processing ? <Loader2 className="animate-spin h-5 w-5" /> : isRtl ? 'تسجيل العودة' : 'Record'}
                                  </Button>
                               </div>
                            </div>
                          )}

                          {/* 3. اعتماد المباشرة: متاح للمسؤول/HR فقط (رقابة) */}
                          {leave.status === 'returned' && isAdmin && (
                            <div className="p-8 rounded-[2.5rem] bg-emerald-50 border-2 border-emerald-100 flex items-center justify-between animate-in zoom-in-95">
                               <div className="text-start">
                                  <h4 className="font-black text-emerald-900 flex items-center gap-2">
                                     <Briefcase className="h-6 w-6" /> {isRtl ? 'اعتماد مباشرة العمل' : 'Confirm Work Commencement'}
                                  </h4>
                                  <p className="text-xs font-bold text-emerald-700 opacity-70">{isRtl ? 'إقرار إداري بأن الموظف استلم مهامه ميدانياً بناءً على تاريخ العودة المسجل.' : 'Admin confirmation that the employee is on duty.'}</p>
                                  {leave.actualReturnDate && (
                                     <Badge className="mt-3 bg-white text-emerald-600 border-emerald-100 font-mono">
                                        {isRtl ? 'تاريخ العودة المسجل:' : 'Return Date:'} {leave.actualReturnDate}
                                     </Badge>
                                  )}
                               </div>
                               <Button onClick={() => handleAction('commenced')} disabled={processing} className="bg-emerald-600 text-white font-black rounded-xl h-14 px-10 shadow-xl shadow-emerald-100">
                                  {processing ? <Loader2 className="animate-spin h-5 w-5" /> : isRtl ? 'اعتماد المباشرة' : 'Commence'}
                               </Button>
                            </div>
                          )}
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>

           <div className="space-y-6">
              <Card className="border-0 shadow-lg rounded-[2.5rem] bg-slate-900 text-white p-8 text-start space-y-6">
                 <h3 className="font-black text-sm uppercase tracking-widest text-primary">{isRtl ? 'سجل التدقيق الزمني' : 'Audit Trail'}</h3>
                 <div className="space-y-6">
                    <div className="flex gap-4 items-start">
                       <div className="h-2 w-2 rounded-full bg-slate-400 mt-1.5" />
                       <div className="text-start">
                          <p className="text-xs font-black">{isRtl ? 'تقديم الطلب' : 'Submitted'}</p>
                          <p className="text-[10px] text-slate-400">{leave.createdAt ? new Date(leave.createdAt.toDate()).toLocaleString() : '...'}</p>
                       </div>
                    </div>
                    {leave.approvedAt && (
                      <div className="flex gap-4 items-start border-t border-white/5 pt-4">
                         <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                         <div className="text-start">
                            <p className="text-xs font-black">{isRtl ? 'تم الاعتماد' : 'Approved'}</p>
                            <p className="text-[10px] text-slate-400">{new Date(leave.approvedAt.toDate()).toLocaleString()}</p>
                         </div>
                      </div>
                    )}
                    {leave.actualReturnDate && (
                      <div className="flex gap-4 items-start border-t border-white/5 pt-4">
                         <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5" />
                         <div className="text-start">
                            <p className="text-xs font-black">{isRtl ? 'تاريخ العودة الفعلي' : 'Actual Return'}</p>
                            <p className="text-[10px] text-purple-400 font-black">{leave.actualReturnDate}</p>
                         </div>
                      </div>
                    )}
                 </div>
              </Card>

              <div className="p-6 rounded-[2rem] bg-amber-50 border-2 border-dashed border-amber-200 space-y-2">
                 <div className="flex items-center gap-2 text-amber-600">
                    <Info className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase">{isRtl ? 'تنبيه التدقيق' : 'Audit Note'}</span>
                 </div>
                 <p className="text-[10px] text-slate-600 font-bold leading-relaxed text-start">
                    {isRtl ? 'يتم حفظ "وقت ضغطة الزر" و "التاريخ الفعلي المختار" بشكل منفصل لضمان أعلى مستويات التدقيق الإداري ومنع التلاعب.' : 'System saves both button-click time and actual selected date for audit integrity.'}
                 </p>
              </div>
           </div>
        </div>
      </PrintWrapper>
    </div>
  );
}