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
  ArrowRight, Landmark, Zap, ShieldCheck
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
  const { t, lang, dir, tSafe } = useLanguage();
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
      toast({ title: t('common.saved') });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!leave) return <div className="p-20 text-center text-slate-400 font-bold">{t('hr.requestNotFound')}</div>;

  const canPrint = check('hr', 'print').can;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4 text-start">
           <Button variant="ghost" onClick={() => router.back()} className="h-10 w-10 p-0 rounded-xl border-2 bg-white shadow-sm hover:text-primary transition-all">
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
        <div className="flex gap-3">
           {canPrint && (
              <Button onClick={() => window.print()} className="h-12 px-6 rounded-xl bg-white border-2 text-slate-900 font-black gap-2 hover:bg-slate-50 shadow-sm transition-all">
                 <Printer className="h-5 w-5 text-primary" /> {t('common.print')}
              </Button>
           )}
        </div>
      </div>

      <PrintWrapper title={t('hr.officialAuthorization')}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           
           <div className="lg:col-span-8 space-y-8">
              
              {/* قسم التنفيذ الإداري اليدوي (Manual Departure / Return Flow) */}
              {isAdmin && ['approved', 'on-leave', 'returned'].includes(leave.status) && (
                <Card className="border-4 border-dashed border-primary/20 rounded-[2.5rem] bg-white overflow-hidden shadow-2xl print:hidden">
                   <div className="bg-primary/5 p-8 border-b text-start">
                      <h3 className="text-xl font-black font-headline flex items-center gap-3">
                         <Zap className="h-6 w-6 text-primary" />
                         {isRtl ? 'لوحة تحكم تنفيذ الإجازة' : 'Leave Execution Panel'}
                      </h3>
                   </div>
                   <CardContent className="p-8 space-y-8 text-start">
                      
                      {/* الحالة 1: الموظف سيغادر (يدوي) */}
                      {leave.status === 'approved' && (
                        <div className="space-y-6 animate-in zoom-in-95">
                           <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-white space-y-6">
                              <div className="space-y-2">
                                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تاريخ المغادرة الفعلي' : 'Actual Departure Date'}</Label>
                                 <SmartDateInput value={actualDepartureDate} onChange={setActualDepartureDate} />
                              </div>
                              <div className="p-4 bg-amber-50 rounded-2xl flex items-start gap-3 border border-amber-100">
                                 <Info className="h-4 w-4 text-amber-600 mt-1 shrink-0" />
                                 <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                                    {isRtl ? 'يرجى تسجيل التاريخ الحقيقي لخروج الموظف، سيقوم النظام بتحديث حالة الموظف لـ (في إجازة) فوراً.' : 'Register the actual day the employee left office.'}
                                 </p>
                              </div>
                           </div>
                           <Button onClick={() => handleAction('on-leave')} disabled={processing} className="w-full h-16 rounded-2xl bg-[#FFB000] text-white font-black text-lg shadow-xl border-b-4 border-[#FF5722] gap-3">
                              <PlaneTakeoff className="h-6 w-6" /> {isRtl ? 'تسجيل مغادرة الموظف' : 'Confirm Departure'}
                           </Button>
                        </div>
                      )}

                      {/* الحالة 2: الموظف عاد (يدوي) */}
                      {leave.status === 'on-leave' && (
                        <div className="space-y-6 animate-in zoom-in-95">
                           <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-white space-y-6">
                              <div className="space-y-2">
                                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تاريخ العودة الفعلي' : 'Actual Return Date'}</Label>
                                 <SmartDateInput value={actualReturnDate} onChange={setActualReturnDate} />
                              </div>
                              <div className="p-4 bg-blue-50 rounded-2xl flex items-start gap-3 border border-blue-100">
                                 <Info className="h-4 w-4 text-blue-600 mt-1 shrink-0" />
                                 <p className="text-[10px] font-bold text-blue-800 leading-relaxed">
                                    {isRtl ? 'سجل التاريخ الفعلي لرجوع الموظف. في الخطوة القادمة ستتمكن من مراجعة رصيد الإجازات المخصوم.' : 'Register the actual day the employee returned.'}
                                 </p>
                              </div>
                           </div>
                           <Button onClick={() => handleAction('returned')} disabled={processing} className="w-full h-16 rounded-2xl bg-purple-600 text-white font-black text-lg shadow-xl border-b-4 border-purple-800 gap-3">
                              <PlaneLanding className="h-6 w-6" /> {isRtl ? 'تسجيل عودة الموظف' : 'Register Return'}
                           </Button>
                        </div>
                      )}

                      {/* الحالة 3: اعتماد المباشرة النهائية (مع مراجعة الأيام) */}
                      {leave.status === 'returned' && (
                        <div className="space-y-6 animate-in zoom-in-95">
                           <div className="p-8 bg-emerald-50 rounded-[2rem] border-2 border-emerald-100 space-y-8">
                              <div className="flex items-center gap-3 text-emerald-700">
                                 <ShieldCheck className="h-7 w-7" />
                                 <h4 className="font-black text-xl">{isRtl ? 'اعتماد مباشرة العمل النهائية' : 'Final Commencement'}</h4>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl shadow-inner border border-emerald-100">
                                 <div className="space-y-2 text-start">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'أيام العمل النهائية المخصومة' : 'Final Work Days Deduction'}</Label>
                                    <Input 
                                      type="number" 
                                      value={editForm.workingDays} 
                                      onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} 
                                      className="h-14 rounded-xl border-2 font-black text-2xl text-emerald-600 text-center" 
                                    />
                                    <p className="text-[9px] text-slate-400 font-bold italic">{isRtl ? 'يمكنك تعديل الأيام بناءً على التواريخ الفعلية.' : 'You can adjust days based on actual dates.'}</p>
                                 </div>
                                 <div className="p-4 bg-emerald-50/50 rounded-xl flex items-center justify-center text-center">
                                    <div className="space-y-1">
                                       <p className="text-[8px] font-black text-emerald-600 uppercase">المغادرة / العودة الفعلية</p>
                                       <p className="text-xs font-mono font-bold text-emerald-700">{leave.actualDepartureDate} → {leave.actualReturnDate}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                           <Button onClick={() => handleAction('commenced')} disabled={processing} className="w-full h-20 rounded-[2.5rem] bg-emerald-600 text-white font-black text-2xl shadow-xl shadow-emerald-100 border-b-8 border-emerald-800 gap-4">
                              <Zap className="h-8 w-8" /> {isRtl ? 'اعتماد المباشرة وتفعيل الموظف' : 'Approve & Activate'}
                           </Button>
                        </div>
                      )}

                   </CardContent>
                </Card>
              )}

              {isAdmin && leave.status === 'pending' && (
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-2 ring-primary/10 print:hidden">
                   <div className="bg-primary/5 p-8 text-slate-900 text-start border-b">
                      <h3 className="text-2xl font-black font-headline flex items-center gap-3"><Clock className="h-7 w-7 text-primary" /> {t('hr.adminDecision')}</h3>
                   </div>
                   <CardContent className="p-8 space-y-8 text-start bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-primary/10">
                         <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{t('hr.approveStart')}</Label><SmartDateInput value={editForm.startDate} onChange={v => setEditForm({...editForm, startDate: v})} /></div>
                         <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{t('hr.approveReturn')}</Label><SmartDateInput value={editForm.endDate} onChange={v => setEditForm({...editForm, endDate: v})} /></div>
                         <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{t('hr.deductionDays')}</Label><Input type="number" value={editForm.workingDays} onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-primary text-xl shadow-inner" /></div>
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase text-slate-400">{t('hr.internalNotes')}</Label>
                         <Textarea value={editForm.comment} onChange={e => setEditForm({...editForm, comment: e.target.value})} className="min-h-[100px] rounded-2xl border-2 shadow-sm" />
                      </div>
                      <div className="flex gap-4">
                         <Button onClick={() => handleAction('rejected')} disabled={processing} variant="outline" className="flex-1 h-16 rounded-2xl border-2 text-rose-600 font-black text-lg hover:bg-rose-50">{t('status.rejected')}</Button>
                         <Button onClick={() => handleAction('approved')} disabled={processing} className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-100 text-lg border-b-4 border-emerald-800">{t('common.confirm')}</Button>
                      </div>
                   </CardContent>
                </Card>
              )}

              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-50/50 border-b p-8">
                    <CardTitle className="text-xl font-black">{t('hr.requestDetails')}</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-10 text-start">
                    <div className="flex items-center gap-6">
                       <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/10">
                          <User className="h-8 w-8" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.name')}</p>
                          <h4 className="text-2xl font-black text-slate-900">{leave.userName}</h4>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="p-6 rounded-2xl bg-slate-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.type') || 'Type'}</p>
                          <p className="text-lg font-black text-primary uppercase">{leave.type}</p>
                       </div>
                       <div className="p-6 rounded-2xl bg-slate-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('hr.calendarDays') || 'Calendar Days'}</p>
                          <p className="text-lg font-black text-slate-900">{leave.days} {t('common.days') || 'Days'}</p>
                       </div>
                       <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-white shadow-sm text-start">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{t('hr.netDeduction')}</p>
                          <p className="text-lg font-black text-emerald-700">{leave.workingDays} {t('hr.workDays')}</p>
                       </div>
                    </div>

                    <div className="p-8 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5"><CalendarDays className="h-20 w-20" /></div>
                       <div className="text-center md:text-start space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('hr.startDate') || 'Start Date'}</p>
                          <p className="text-2xl font-black text-slate-900">{leave.startDate}</p>
                       </div>
                       <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                          <ArrowRight className={cn("h-6 w-6", isRtl && "rotate-180")} />
                       </div>
                       <div className="text-center md:text-end space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('hr.returnDate')}</p>
                          <p className="text-2xl font-black text-slate-900">{leave.endDate}</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Info className="h-3 w-3" /> {t('hr.justification')}
                       </p>
                       <p className="p-6 bg-slate-50/50 rounded-2xl border-2 border-white shadow-inner text-sm font-bold text-slate-700 leading-relaxed italic">
                          {leave.reason}
                       </p>
                    </div>
                 </CardContent>
              </Card>
           </div>

           <div className="lg:col-span-4 space-y-6 print:hidden">
              <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
                 <CardHeader className="bg-slate-50 border-b p-6">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                       <History className="h-5 w-5 text-primary" />
                       {t('hr.auditTrail')}
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                    <div className="space-y-6">
                       <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                          <div className="absolute -start-[9px] top-0 h-4 w-4 rounded-full bg-primary border-4 border-white shadow-sm" />
                          <p className="text-[9px] font-black text-slate-400 uppercase">{t('hr.requestCreated')}</p>
                          <p className="text-xs font-bold text-slate-700 mt-1">{leave.createdAt?.toDate().toLocaleString()}</p>
                       </div>
                       {leave.approvedAt && (
                          <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                             <div className="absolute -start-[9px] top-0 h-4 w-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                             <p className="text-[9px] font-black text-emerald-600 uppercase">{t('status.approved')}</p>
                             <p className="text-xs font-bold text-slate-700 mt-1">{leave.approvedAt?.toDate().toLocaleString()}</p>
                          </div>
                       )}
                       {leave.actualDepartureDate && (
                          <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                             <div className="absolute -start-[9px] top-0 h-4 w-4 rounded-full bg-amber-500 border-4 border-white shadow-sm" />
                             <p className="text-[9px] font-black text-amber-600 uppercase">{isRtl ? 'المغادرة الفعلية' : 'Actual Departure'}</p>
                             <p className="text-xs font-bold text-slate-700 mt-1">{leave.actualDepartureDate}</p>
                          </div>
                       )}
                       {leave.actualReturnDate && (
                          <div className="relative ps-6 border-s-2 border-slate-100 pb-2">
                             <div className="absolute -start-[9px] top-0 h-4 w-4 rounded-full bg-purple-500 border-4 border-white shadow-sm" />
                             <p className="text-[9px] font-black text-purple-600 uppercase">{isRtl ? 'العودة الفعلية' : 'Actual Return'}</p>
                             <p className="text-xs font-bold text-slate-700 mt-1">{leave.actualReturnDate}</p>
                          </div>
                       )}
                    </div>
                 </CardContent>
              </Card>

              <div className="p-8 rounded-[2rem] bg-amber-50 border-2 border-dashed border-amber-200 flex items-start gap-4">
                 <Scale className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                 <p className="text-[10px] text-amber-800 font-bold leading-relaxed text-start">
                    {t('hr.art70Notice')}
                 </p>
              </div>
           </div>

        </div>
      </PrintWrapper>
    </div>
  );
}
