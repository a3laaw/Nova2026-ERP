'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, CheckCircle2, XCircle,
  User, History, Printer, PlaneTakeoff, PlaneLanding, Scale,
  Clock, ShieldAlert, AlertTriangle, Info, CalendarDays
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
  const { isAdmin, check, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const [processing, setProcessing] = useState(false);
  const [actualDepartureDate, setActualDepartureDate] = useState('');
  const [actualReturnDate, setActualReturnDate] = useState('');
  
  const [conflictData, setConflictData] = useState<{ count: number; peers: any[] } | null>(null);
  const [loadingConflict, setLoadingConflict] = useState(false);

  const [editForm, setEditForm] = useState({
    comment: '',
    startDate: '',
    endDate: '',
    workingDays: 0
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
      setEditForm({
        comment: leave.comment || '',
        startDate: leave.startDate,
        endDate: leave.endDate,
        workingDays: leave.workingDays
      });
      setActualDepartureDate(leave.actualDepartureDate || leave.startDate);
      setActualReturnDate(leave.actualReturnDate || leave.endDate);

      // فحص تداخل القسم عند تحميل الطلب
      if (leaveService && (leave as any).departmentId) {
        setLoadingConflict(true);
        leaveService.getDepartmentLeaveDensity(
          (leave as any).departmentId,
          leave.startDate,
          leave.endDate,
          leave.id
        ).then(res => {
          setConflictData(res);
        }).finally(() => setLoadingConflict(false));
      }
    }
  }, [leave, leaveService]);

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
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!leave) return <div className="p-20 text-center text-slate-400 font-bold">{isRtl ? 'الطلب غير موجود' : 'Request not found'}</div>;

  const canPrint = check('hr', 'print').can;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
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
        <div className="flex gap-3">
           {canPrint && (
              <Button onClick={() => window.print()} className="h-12 px-6 rounded-xl bg-white border-2 text-slate-900 font-black gap-2 hover:bg-slate-50 shadow-sm">
                 <Printer className="h-5 w-5 text-primary" /> {isRtl ? 'طباعة المستند' : 'Print'}
              </Button>
           )}
        </div>
      </div>

      <PrintWrapper title={isRtl ? "إقرار إجازة رسمية" : "Official Leave Authorization"}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           
           <div className="lg:col-span-8 space-y-8">
              {/* قسم تحذير التداخل السيادي - يظهر للمدير فقط */}
              {isAdmin && leave.status === 'pending' && (
                <div className="space-y-6">
                   {loadingConflict ? (
                      <div className="p-6 bg-slate-50 rounded-3xl animate-pulse flex items-center gap-3">
                         <Loader2 className="h-5 w-5 animate-spin text-primary/30" />
                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Analyzing Team Availability...</span>
                      </div>
                   ) : conflictData && conflictData.count > 0 && (
                      <div className="p-8 bg-rose-50 border-4 border-rose-100 rounded-[2.5rem] space-y-4 animate-in shake-in duration-500 shadow-xl shadow-rose-200/20">
                         <div className="flex items-center gap-4 text-rose-600">
                            <ShieldAlert className="h-10 w-10" />
                            <div className="text-start">
                               <h3 className="font-black text-xl uppercase tracking-tighter">{isRtl ? 'تنبيه: تداخل تخصصي حرج' : 'Operational Conflict Warning'}</h3>
                               <p className="text-sm font-bold opacity-80">{isRtl ? 'يوجد موظفون آخرون من نفس القسم لديهم إجازات في نفس الفترة.' : 'Other department staff are away during this period.'}</p>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                            {conflictData.peers.map((p, i) => (
                              <div key={i} className="bg-white/80 p-4 rounded-2xl border border-rose-100 flex items-center justify-between">
                                 <div className="text-start">
                                    <p className="font-black text-xs text-slate-800">{p.name}</p>
                                    <p className="text-[9px] font-bold text-rose-400">{p.period}</p>
                                 </div>
                                 <Badge className={cn("text-[8px] font-black uppercase border-0", p.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                                    {p.status}
                                 </Badge>
                              </div>
                            ))}
                         </div>
                         <div className="p-4 bg-rose-600 text-white rounded-2xl flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5" />
                            <p className="text-xs font-black">{isRtl ? 'يرجى مراجعة الجدول الزمني للقسم قبل اتمام الموافقة لتجنب توقف العمل.' : 'Review department schedule before approval to prevent downtime.'}</p>
                         </div>
                      </div>
                   )}
                </div>
              )}

              {isAdmin && leave.status === 'pending' && (
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-2 ring-primary/10 print:hidden">
                   <div className="bg-slate-900 p-8 text-white text-start">
                      <h3 className="text-2xl font-black font-headline flex items-center gap-3"><Clock className="h-7 w-7 text-primary" /> {isRtl ? 'قرار الإدارة وتصحيح البيانات' : 'Admin Decision'}</h3>
                   </div>
                   <CardContent className="p-8 space-y-8 text-start">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-primary/10">
                         <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ البدء المعتمد' : 'Approve Start'}</Label><SmartDateInput value={editForm.startDate} onChange={v => setEditForm({...editForm, startDate: v})} /></div>
                         <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ العودة المعتمد' : 'Approve Return'}</Label><SmartDateInput value={editForm.endDate} onChange={v => setEditForm({...editForm, endDate: v})} /></div>
                         <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'أيام الخصم الفعلي (للمحاسبة)' : 'Deduction Days'}</Label><Input type="number" value={editForm.workingDays} onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-primary text-xl" /></div>
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'ملاحظات الإدارة' : 'Internal Notes'}</Label>
                         <Textarea value={editForm.comment} onChange={e => setEditForm({...editForm, comment: e.target.value})} className="min-h-[100px] rounded-2xl border-2" />
                      </div>
                      <div className="flex gap-4">
                         <Button onClick={() => handleAction('rejected')} disabled={processing} variant="outline" className="flex-1 h-16 rounded-2xl border-2 text-rose-600 font-black">{isRtl ? 'رفض الطلب' : 'Reject'}</Button>
                         <Button onClick={() => handleAction('approved')} disabled={processing} className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-100">{isRtl ? 'اعتماد وصرف' : 'Approve'}</Button>
                      </div>
                   </CardContent>
                </Card>
              )}

              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-50/50 border-b p-8">
                    <CardTitle className="text-xl font-black">{isRtl ? 'بيانات طلب الإجازة' : 'Request Details'}</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-10 text-start">
                    <div className="flex items-center gap-6">
                       <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/10">
                          <User className="h-8 w-8" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'اسم الموظف صاحب الطلب' : 'Employee'}</p>
                          <h4 className="text-2xl font-black text-slate-900">{leave.userName}</h4>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="p-6 rounded-2xl bg-slate-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'نوع الإجازة' : 'Type'}</p>
                          <p className="text-lg font-black text-primary uppercase">{leave.type}</p>
                       </div>
                       <div className="p-6 rounded-2xl bg-slate-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'المدة التقويمية' : 'Calendar Days'}</p>
                          <p className="text-lg font-black text-slate-900">{leave.days} {isRtl ? 'يوم' : 'Days'}</p>
                       </div>
                       <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{isRtl ? 'الخصم الفعلي' : 'Net Deduction'}</p>
                          <p className="text-lg font-black text-emerald-700">{leave.workingDays} {isRtl ? 'يوم عمل' : 'Work Days'}</p>
                       </div>
                    </div>

                    <div className="p-8 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5"><CalendarDays className="h-20 w-20" /></div>
                       <div className="text-center md:text-start space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ البداية' : 'Start Date'}</p>
                          <p className="text-2xl font-black text-slate-900">{leave.startDate}</p>
                       </div>
                       <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                          <ArrowRight className={cn("h-6 w-6", isRtl && "rotate-180")} />
                       </div>
                       <div className="text-center md:text-end space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'تاريخ العودة' : 'Return Date'}</p>
                          <p className="text-2xl font-black text-slate-900">{leave.endDate}</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Info className="h-3 w-3" /> {isRtl ? 'المبررات والأسباب' : 'Reason / Justification'}
                       </p>
                       <p className="p-6 bg-slate-50/50 rounded-2xl border-2 border-white shadow-inner text-sm font-bold text-slate-700 leading-relaxed italic">
                          {leave.reason}
                       </p>
                    </div>
                 </CardContent>
              </Card>
           </div>

           <div className="lg:col-span-4 space-y-6 print:hidden">
              <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-50 border-b p-6">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                       <History className="h-5 w-5 text-primary" />
                       {isRtl ? 'سجل الحركات (Audit)' : 'Audit Trail'}
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                    <div className="space-y-6">
                       <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                          <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary border-4 border-white shadow-sm" />
                          <p className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'تقديم الطلب' : 'Request Created'}</p>
                          <p className="text-xs font-bold text-slate-700 mt-1">{leave.createdAt?.toDate().toLocaleString()}</p>
                       </div>
                       {leave.approvedAt && (
                          <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                             <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                             <p className="text-[9px] font-black text-emerald-600 uppercase">{isRtl ? 'تم الاعتماد' : 'Approved'}</p>
                             <p className="text-xs font-bold text-slate-700 mt-1">{leave.approvedAt?.toDate().toLocaleString()}</p>
                          </div>
                       )}
                       {leave.rejectedAt && (
                          <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                             <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-rose-500 border-4 border-white shadow-sm" />
                             <p className="text-[9px] font-black text-rose-600 uppercase">{isRtl ? 'تم الرفض' : 'Rejected'}</p>
                             <p className="text-xs font-bold text-slate-700 mt-1">{leave.rejectedAt?.toDate().toLocaleString()}</p>
                          </div>
                       )}
                    </div>
                 </CardContent>
              </Card>

              <div className="p-8 rounded-[2rem] bg-amber-50 border-2 border-dashed border-amber-200 flex items-start gap-4">
                 <Scale className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                 <p className="text-[10px] text-amber-800 font-bold leading-relaxed text-start">
                    {isRtl ? 'بناءً على مادة 70: لا يحق للموظف القيام بالإجازة إلا بموافقة الإدارة. يحق للمدير تعديل تواريخ الإجازة بما يتناسب مع مصلحة العمل وضمان استمرارية القسم.' : 'Art 70: Leave requires admin approval. Manager can adjust dates to suit operational needs and department continuity.'}
                 </p>
              </div>
           </div>

        </div>
      </PrintWrapper>
    </div>
  );
}