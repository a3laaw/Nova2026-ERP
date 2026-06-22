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
  Timer, Pencil, Save, Clock, Printer, ShieldAlert
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
  const [actualDepartureDate, setActualDepartureDate] = useState('');
  const [actualReturnDate, setActualReturnDate] = useState('');
  
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
      setActualDepartureDate(leave.actualDepartureDate || leave.startDate);
      setActualReturnDate(leave.actualReturnDate || leave.endDate);
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
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "فشل التحديث، يرجى مراجعة الصلاحيات." : "Update failed." });
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
           <Button onClick={() => window.print()} className="h-12 px-6 rounded-xl bg-white border-2 text-slate-900 font-black gap-2 hover:bg-slate-50 shadow-sm">
              <Printer className="h-5 w-5 text-primary" /> {isRtl ? 'طباعة المستند' : 'Print'}
           </Button>
        )}
      </div>

      <PrintWrapper title={isRtl ? "إقرار إجازة رسمية" : "Official Leave Authorization"}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              
              {/* 1. قرار الإدارة وتصحيح البيانات (بداية الإجازة) */}
              {isAdmin && leave.status === 'pending' && (
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-2 ring-primary/20 print:hidden">
                   <div className="bg-slate-900 p-8 text-white text-start">
                      <h3 className="text-2xl font-black font-headline flex items-center gap-3"><Clock className="h-7 w-7 text-primary" /> {isRtl ? 'قرار الإدارة وتصحيح البيانات' : 'Admin Decision'}</h3>
                   </div>
                   <CardContent className="p-8 space-y-8 text-start">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-primary/10">
                         <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ البدء المعتمد' : 'Approve Start'}</Label><SmartDateInput value={editForm.startDate} onChange={v => setEditForm({...editForm, startDate: v})} /></div>
                         <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ العودة المعتمد' : 'Approve Return'}</Label><SmartDateInput value={editForm.endDate} onChange={v => setEditForm({...editForm, endDate: v})} /></div>
                         <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'أيام الخصم الفعلي (للمحاسبة)' : 'Deduction Days'}</Label><Input type="number" value={editForm.workingDays} onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-primary text-xl" /></div>
                      </div>
                      <div className="space-y-3"><Label className="font-black text-xs uppercase text-slate-500">{isRtl ? 'ملاحظات الإدارة' : 'Internal Notes'}</Label><Textarea value={editForm.comment} onChange={(e) => setEditForm({...editForm, comment: e.target.value})} className="min-h-[100px] rounded-2xl border-2 p-6" /></div>
                      <div className="flex gap-4">
                         <Button onClick={() => handleAction('rejected')} disabled={processing} variant="outline" className="flex-1 h-16 rounded-2xl border-2 text-rose-600 font-black">{isRtl ? 'رفض الطلب' : 'Reject'}</Button>
                         <Button onClick={() => handleAction('approved')} disabled={processing} className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black">{isRtl ? 'اعتماد وصرف' : 'Approve'}</Button>
                      </div>
                   </CardContent>
                </Card>
              )}

              {/* 2. منطقة الاعتماد النهائي (عند العودة من الإجازة) - الحماية من تلاعب التواريخ */}
              {isAdmin && leave.status === 'returned' && (
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-emerald-600 text-white overflow-hidden animate-in zoom-in-95 print:hidden">
                   <div className="p-8 space-y-6 text-start">
                      <div className="flex items-center gap-4">
                         <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center"><ShieldAlert className="h-8 w-8 text-white" /></div>
                         <div>
                            <h3 className="text-2xl font-black font-headline">{isRtl ? 'مراجعة وتأكيد العودة الفعلية' : 'Final Audit & Return Confirmation'}</h3>
                            <p className="text-emerald-100 font-bold text-sm">{isRtl ? 'قم بمراجعة تواريخ خروج وعودة الموظف وتصحيحها إذا خالف الواقع.' : 'Review and correct actual dates before final activation.'}</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/10 p-8 rounded-[2rem] border border-white/20">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-emerald-200">{isRtl ? 'تاريخ الخروج الفعلي (المدقق)' : 'Verified Departure Date'}</Label>
                            <SmartDateInput value={actualDepartureDate} onChange={setActualDepartureDate} className="bg-white text-black" />
                            <p className="text-[9px] font-bold text-emerald-100 italic">{isRtl ? `سجل الموظف: ${leave.actualDepartureDate}` : `Emp claim: ${leave.actualDepartureDate}`}</p>
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-emerald-200">{isRtl ? 'تاريخ العودة الفعلي (المدقق)' : 'Verified Return Date'}</Label>
                            <SmartDateInput value={actualReturnDate} onChange={setActualReturnDate} className="bg-white text-black" />
                            <p className="text-[9px] font-bold text-emerald-100 italic">{isRtl ? `سجل الموظف: ${leave.actualReturnDate}` : `Emp claim: ${leave.actualReturnDate}`}</p>
                         </div>
                         <div className="md:col-span-2 space-y-2 pt-4 border-t border-white/10">
                            <Label className="text-[10px] font-black uppercase text-emerald-200">{isRtl ? 'أيام الخصم النهائية (بعد التدقيق الميداني)' : 'Final Deduction Days'}</Label>
                            <div className="flex items-center gap-4">
                               <Input 
                                 type="number" 
                                 value={editForm.workingDays} 
                                 onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})}
                                 className="h-14 rounded-2xl bg-white text-emerald-700 font-black text-2xl w-32 text-center"
                               />
                               <div className="text-[10px] font-bold text-emerald-100 flex flex-col">
                                  <span>{isRtl ? '• تأكد من استبعاد الجمعة والعطلات.' : '• Exclude weekends/holidays.'}</span>
                                  <span>{isRtl ? '• أي تعديل سيغير رصيد الموظف آلياً.' : '• This update affects employee balance.'}</span>
                                </div>
                            </div>
                         </div>
                      </div>

                      <Button onClick={() => handleAction('commenced')} disabled={processing} className="w-full h-20 rounded-[2rem] bg-white text-emerald-700 font-black text-2xl shadow-2xl hover:scale-105 transition-all gap-3">
                         {processing ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="h-8 w-8" />}
                         {isRtl ? 'اعتماد البيانات وتنشيط الموظف' : 'Final Approve & Reactivate'}
                      </Button>
                   </div>
                </Card>
              )}

              {/* تفاصيل الإجازة العامة */}
              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden text-start">
                 <CardHeader className="bg-slate-50/50 border-b p-8"><CardTitle className="text-xl font-black flex items-center gap-3"><User className="h-6 w-6 text-primary" /> {leave.userName}</CardTitle></CardHeader>
                 <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                       <div className="p-6 rounded-3xl bg-slate-50 border space-y-1"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'بداية الإجازة المعتمدة' : 'Approved Start'}</Label><p className="text-2xl font-black text-slate-800">{leave.startDate}</p></div>
                       <div className="p-6 rounded-3xl bg-slate-50 border space-y-1"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ العودة للعمل' : 'Approved Return'}</Label><p className="text-2xl font-black text-slate-800">{leave.endDate}</p></div>
                    </div>
                    <div className="p-8 rounded-[2rem] bg-emerald-50/30 border-2 border-emerald-100 flex justify-between items-center text-start">
                       <div>
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{isRtl ? 'صافي أيام الخصم من الرصيد' : 'Net Deduction Days'}</p>
                          <p className="text-4xl font-black text-emerald-700 mt-1">{leave.workingDays} <span className="text-sm font-bold">{isRtl ? 'يوم' : 'Days'}</span></p>
                       </div>
                       <Scale className="h-8 w-8 text-emerald-600" />
                    </div>

                    <div className="pt-8 border-t space-y-6 print:hidden">
                       <h3 className="font-black text-lg flex items-center gap-2 text-slate-800"><History className="h-5 w-5 text-primary" /> {isRtl ? 'إجراءات المسار الزمني (التتبع الميداني)' : 'Timeline Tracking'}</h3>
                       <div className="grid grid-cols-1 gap-6">
                          {leave.status === 'approved' && (isOwner || isAdmin) && (
                            <div className="p-8 rounded-[2.5rem] bg-blue-50 border-2 border-blue-100 space-y-6 animate-in zoom-in-95">
                               <div className="text-start">
                                  <h4 className="font-black text-xl text-blue-900 flex items-center gap-2"><PlaneTakeoff className="h-6 w-6" /> {isRtl ? 'تأكيد المغادرة في إجازة' : 'Confirm Departure'}</h4>
                               </div>
                               <div className="flex flex-col md:flex-row items-end gap-4 bg-white/50 p-6 rounded-3xl border border-blue-100">
                                  <div className="flex-1 space-y-2 w-full"><Label className="text-[10px] font-black text-blue-400 uppercase">{isRtl ? 'تاريخ الخروج الفعلي' : 'Actual Departure'}</Label><SmartDateInput value={actualDepartureDate} onChange={setActualDepartureDate} /></div>
                                  <Button onClick={() => handleAction('on-leave')} disabled={processing} className="w-full md:w-48 h-12 rounded-xl bg-blue-600 text-white font-black">{isRtl ? 'تأكيد الخروج' : 'Confirm'}</Button>
                               </div>
                            </div>
                          )}

                          {leave.status === 'on-leave' && (isOwner || isAdmin) && (
                            <div className="p-8 rounded-[2.5rem] bg-purple-50 border-2 border-purple-100 space-y-6 animate-in zoom-in-95">
                               <div className="text-start">
                                  <h4 className="font-black text-xl text-purple-900 flex items-center gap-2"><PlaneLanding className="h-6 w-6" /> {isRtl ? 'تسجيل العودة من الإجازة' : 'Record Return'}</h4>
                               </div>
                               <div className="flex flex-col md:flex-row items-end gap-4 bg-white/50 p-6 rounded-3xl border border-purple-100">
                                  <div className="flex-1 space-y-2 w-full"><Label className="text-[10px] font-black text-purple-400 uppercase">{isRtl ? 'تاريخ الوصول الفعلي' : 'Actual Return'}</Label><SmartDateInput value={actualReturnDate} onChange={setActualReturnDate} /></div>
                                  <Button onClick={() => handleAction('returned')} disabled={processing} className="w-full md:w-48 h-12 rounded-xl bg-purple-600 text-white font-black">{isRtl ? 'تسجيل العودة' : 'Record'}</Button>
                               </div>
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
                    <div className="flex gap-4 items-start"><div className="h-2 w-2 rounded-full bg-slate-400 mt-1.5" /><div className="text-start"><p className="text-xs font-black">{isRtl ? 'تقديم الطلب' : 'Submitted'}</p><p className="text-[10px] text-slate-400">{leave.createdAt?.toDate().toLocaleString()}</p></div></div>
                    {leave.approvedAt && <div className="flex gap-4 items-start border-t border-white/5 pt-4"><div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" /><div className="text-start"><p className="text-xs font-black">{isRtl ? 'تم الاعتماد' : 'Approved'}</p><p className="text-[10px] text-slate-400">{leave.approvedAt.toDate().toLocaleString()}</p></div></div>}
                    {leave.actualReturnDate && <div className="flex gap-4 items-start border-t border-white/5 pt-4"><div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5" /><div className="text-start"><p className="text-xs font-black">{isRtl ? 'إفادة عودة الموظف' : 'Emp Return Claim'}</p><p className="text-[10px] text-purple-400 font-black">{leave.actualReturnDate}</p></div></div>}
                 </div>
              </Card>

              <div className="p-6 rounded-[2rem] bg-amber-50 border-2 border-dashed border-amber-200 space-y-2 text-start">
                 <div className="flex items-center gap-2 text-amber-600"><ShieldAlert className="h-4 w-4" /><span className="text-[10px] font-black uppercase">{isRtl ? 'رقابة إدارية' : 'Audit Lock'}</span></div>
                 <p className="text-[10px] text-slate-600 font-bold leading-relaxed">{isRtl ? 'لا يتم إغلاق ملف الإجازة وتنشيط الموظف إلا بعد مراجعة المسؤول للتواريخ الفعلية وتطابقها مع سجل البصمة.' : 'Leave file closes only after Admin verifies claim vs biometric logs.'}</p>
              </div>
           </div>
        </div>
      </PrintWrapper>
    </div>
  );
}