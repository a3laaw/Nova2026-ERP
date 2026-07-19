
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Calendar, Clock, User, 
  MessageSquare, ShieldCheck, 
  Loader2, Workflow, CheckCircle2,
  AlertTriangle, Timer, Hammer,
  Check, Layers, Info, Pencil, FileText
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { Transaction, StageInstance, TransactionComment } from '@/types/transaction';
import { BOQItemExecutionEntry } from '@/types/documents';
import { CommentSection } from '@/components/transactions/comment-section';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { AppointmentService } from '@/services/appointment-service';

export default function AppointmentDetailPage() {
  const apptId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const apptRef = useMemo(() => 
    companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, 
  [db, companyId, apptId]);

  const { data: appt, loading: apptLoading } = useDoc<Appointment>(apptRef);

  // جلب بيانات المشروع المربوط
  const transRef = useMemo(() => 
    companyId && db && appt?.transactionId ? doc(db, paths.transactions(companyId), appt.transactionId) : null,
  [db, companyId, appt?.transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  // تحديد طبيعة النشاط (مقاولات أم استشارات)
  const isConsulting = useMemo(() => {
    const name = transaction?.activityTypeName || '';
    return name.includes('استشارات') || name.includes('Consulting') || name.includes('تصميم') || name.includes('Design');
  }, [transaction]);

  // جلب مراحل المشروع (المسار الفني)
  const stagesQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null,
  [db, companyId, appt?.transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

  // جلب سجلات التنفيذ (للمقاولات)
  const execsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', appt.transactionId)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: executions } = useCollection<BOQItemExecutionEntry>(execsQuery);

  // جلب سجلات التعليقات (للاستشارات)
  const commentsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionComments(companyId, appt.transactionId)), where('stageInstanceId', '==', appt.stageId || '')) : null,
  [db, companyId, appt?.transactionId, appt?.stageId]);
  const { data: comments } = useCollection<TransactionComment>(commentsQuery);

  // فحص شرط الإغلاق بناءً على نوع النشاط
  const hasAchievement = useMemo(() => {
    if (!appt?.transactionId) return true; // موعد عام بدون مشروع

    if (isConsulting) {
      // للاستشارات: يجب وجود تعليق واحد على الأقل (محضر اجتماع) في هذه المرحلة
      return (comments || []).length > 0;
    } else {
      // للمقاولات: يجب وجود سجل إنجاز كميات (Execution Log)
      if (!executions || !appt?.stageId) return false;
      const linkedStage = stages?.find(s => s.id === appt.stageId);
      if (!linkedStage) return false;
      return executions.some(ex => ex.technicalStageId === linkedStage.technicalStageId && !ex.isArchived);
    }
  }, [isConsulting, comments, executions, appt?.stageId, appt?.transactionId, stages]);

  const handleComplete = async () => {
    if (!db || !companyId || !user) return;
    if (!hasAchievement && appt?.transactionId) {
       toast({ 
         variant: "destructive", 
         title: isRtl ? "قفل الإنجاز مفعل" : "Execution Lock Active",
         description: isConsulting 
           ? (isRtl ? "لا يمكن إغلاق موعد استشاري بدون تدوين محضر اجتماع أو ملاحظات فنية في غرفة العمليات." : "Cannot close consulting appt without logging meeting minutes in the War Room.")
           : (isRtl ? "لا يمكن إغلاق موعد مقاولات بدون تسجيل إنجاز ميداني للكميات في المشروع." : "Cannot close contracting appt without logging site quantity progress.")
       });
       return;
    }

    try {
      const service = new AppointmentService(db, companyId);
      await service.updateStatus(apptId, 'completed', user.uid);
      toast({ title: isRtl ? "تم إنجاز الموعد" : "Appointment Completed" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    }
  };

  if (apptLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!appt) return <div className="p-20 text-center font-black">{isRtl ? 'الموعد غير موجود' : 'Appointment not found'}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50 transition-all">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900">{appt.title}</h1>
             <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-[0.2em] opacity-60">
               {appt.clientName} | {isConsulting ? (isRtl ? 'مسار استشاري' : 'Consulting Path') : (isRtl ? 'مسار مقاولات' : 'Contracting Path')}
             </p>
           </div>
        </div>
        
        {appt.status !== 'completed' && (
           <Button 
             onClick={handleComplete} 
             className={cn(
               "h-14 px-10 rounded-2xl font-black text-lg transition-all gap-3 border-b-8 shadow-xl hover:scale-105",
               hasAchievement
                 ? (isConsulting ? "bg-blue-600 text-white border-blue-800 shadow-blue-100" : "bg-emerald-600 text-white border-emerald-800 shadow-emerald-100") 
                 : "bg-slate-200 text-slate-400 border-slate-300 shadow-none cursor-not-allowed"
             )}
           >
              {hasAchievement ? (isConsulting ? <CheckCircle2 className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />) : <AlertTriangle className="h-6 w-6" />}
              {isRtl ? 'إغلاق وإنجاز الموعد' : 'Complete Appointment'}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className="lg:col-span-8 space-y-8">
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-primary/5 p-8 border-b">
                 <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                       <ShieldCheck className="h-6 w-6 text-primary" />
                       {isRtl ? 'تفاصيل الارتباط الفني' : 'Technical Link Details'}
                    </CardTitle>
                    <Badge className={cn(
                      "font-black px-4 py-1.5 rounded-xl uppercase text-[10px] shadow-sm",
                      appt.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                    )}>{appt.status}</Badge>
                 </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border"><Calendar className="h-5 w-5" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'التاريخ المجدول' : 'Scheduled Date'}</p>
                             <p className="font-black text-slate-800 text-lg">{new Date(appt.start).toLocaleDateString(isRtl ? 'ar-KW' : 'en-US', { dateStyle: 'full' })}</p>
                          </div>
                       </div>
                       <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border"><Clock className="h-5 w-5" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الوقت' : 'Time'}</p>
                             <p className="font-black text-slate-800 text-lg">{new Date(appt.start).toLocaleTimeString(isRtl ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20"><User className="h-5 w-5" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المهندس المسؤول' : 'Assigned Engineer'}</p>
                             <p className="font-black text-slate-800 text-lg">{appt.engineerName}</p>
                          </div>
                       </div>
                       {appt.transactionId && (
                         <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-50/50 border-2 border-blue-100 animate-in slide-in-from-top-2">
                            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner"><Workflow className="h-5 w-5" /></div>
                            <div className="text-start">
                               <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{isRtl ? 'المشروع المربوط' : 'Linked Project'}</p>
                               <p className="font-black text-slate-800 text-sm">{appt.transactionNumber}</p>
                               <div className="mt-2">
                                  <Badge className="bg-blue-600 text-white border-0 font-black text-[9px] px-3 h-5 rounded-lg shadow-sm">
                                     {appt.stageName || 'Linked Stage'}
                                  </Badge>
                               </div>
                            </div>
                         </div>
                       )}
                    </div>
                 </div>

                 {appt.notes && (
                   <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner text-start space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest">
                         <MessageSquare className="h-3 w-3 text-primary" /> {isRtl ? 'ملاحظات الحجز المسبقة' : 'Booking Notes'}
                      </p>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed italic">"{appt.notes}"</p>
                   </div>
                 )}
              </CardContent>
           </Card>

           <div className="pt-4">
              <div className="bg-white rounded-[3rem] shadow-2xl border border-primary/10 overflow-hidden min-h-[500px]">
                 <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg border border-primary/20">
                          <Timer className="h-6 w-6 animate-pulse" />
                       </div>
                       <div className="text-start">
                          <h3 className="text-xl font-black font-headline">{isRtl ? 'غرفة عمليات الموعد' : 'Appointment War Room'}</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Real-time meeting logs</p>
                       </div>
                    </div>
                    <Badge className="bg-primary text-white border-0 font-black px-4 h-7 rounded-full text-[10px] shadow-lg shadow-orange-500/20">LIVE SYNC</Badge>
                 </div>
                 <div className="p-2 h-[600px]">
                    <CommentSection 
                       transactionId={appt.transactionId || apptId} 
                       path={`companies/${companyId}/appointments/${apptId}/comments`} 
                       title={isRtl ? 'سجل نقاش الموعد' : 'Meeting Interaction Log'}
                    />
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6 text-start">
           {/* رادار المسار الفني للمشروع */}
           {appt.transactionId && stages && (
              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-900 p-6 text-white text-start">
                    <div className="flex items-center gap-3">
                       <Layers className="h-5 w-5 text-primary" />
                       <CardTitle className="text-sm font-black uppercase tracking-widest">{isRtl ? 'رادار المسار الفني' : 'Project Pipeline'}</CardTitle>
                    </div>
                 </CardHeader>
                 <CardContent className="p-4 space-y-2">
                    {stages.map((stage, idx) => {
                       const isTarget = stage.id === appt.stageId;
                       return (
                          <div 
                            key={stage.id} 
                            onClick={() => router.push(`/dashboard/clients/${appt.clientId}/transactions/${appt.transactionId}`)}
                            className={cn(
                              "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group",
                              isTarget ? "bg-primary/5 border-primary shadow-lg scale-105" : "bg-white border-slate-50 hover:border-slate-200"
                            )}
                          >
                             <div className="flex items-center gap-3">
                                <div className={cn(
                                   "h-7 w-7 rounded-lg flex items-center justify-center font-black text-[10px] border shadow-inner",
                                   stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-white"
                                )}>
                                   {stage.status === 'completed' ? <Check className="h-3 w-3" /> : (idx + 1)}
                                </div>
                                <div className="text-start">
                                   <p className={cn("text-[11px] font-black leading-tight", isTarget ? "text-primary" : "text-slate-800")}>{stage.name}</p>
                                   <p className="text-[8px] font-bold text-slate-400 uppercase">{stage.status}</p>
                                </div>
                             </div>
                             {isTarget && (
                                <Badge className="bg-primary text-white border-0 text-[7px] font-black h-4">CURRENT APPT</Badge>
                             )}
                          </div>
                       );
                    })}
                 </CardContent>
              </Card>
           )}

           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isRtl ? 'عن العميل' : 'Client Snapshot'}</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg border-2 border-white">{appt.clientName.charAt(0)}</div>
                    <div className="text-start">
                       <h4 className="font-black text-slate-900 leading-tight">{appt.clientName}</h4>
                       <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Sovereign Client</p>
                    </div>
                 </div>
                 <Button onClick={() => router.push(`/dashboard/clients/${appt.clientId}`)} variant="outline" className="w-full rounded-xl font-black text-[10px] h-11 gap-2 border-2 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                    {isRtl ? 'عرض ملف العميل الكامل' : 'View Full Client File'}
                    <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                 </Button>
              </CardContent>
           </Card>

           <div className={cn(
             "p-8 rounded-[2.5rem] border-2 border-dashed flex items-start gap-4",
             isConsulting ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-amber-50 border-amber-200 text-amber-800"
           )}>
              {isConsulting ? <Pencil className="h-6 w-6 shrink-0 mt-1" /> : <AlertTriangle className="h-6 w-6 shrink-0 mt-1" />}
              <p className="text-xs font-bold leading-relaxed">
                 {isConsulting 
                   ? (isRtl ? 'بروتوكول الاستشارات: لإكمال الموعد يجب تسجيل محضر اجتماع أو ملاحظات فنية في غرفة العمليات (War Room) أدناه.' : 'Consulting Protocol: To complete, you must log meeting minutes or technical notes in the War Room below.')
                   : (isRtl ? 'بروتوكول المقاولات: لا يمكنك إغلاق هذا الموعد إلا بعد تسجيل إنجاز فني (Hammer Log) في المشروع المربوط.' : 'Contracting Protocol: You cannot complete this appt without logging technical progress (Hammer Log) in the linked project.')
                 }
              </p>
           </div>
           
           {!hasAchievement && appt.transactionId && !isConsulting && (
              <Button 
                onClick={() => router.push(`/dashboard/clients/${appt.clientId}/transactions/${appt.transactionId}`)}
                className="w-full h-16 rounded-2xl bg-slate-900 text-white font-black text-sm shadow-2xl hover:scale-105 transition-all gap-3"
              >
                 <Hammer className="h-5 w-5 text-primary" />
                 {isRtl ? 'الذهاب لتسجيل إنجاز فني الآن' : 'Go Log Progress Now'}
              </Button>
           )}
        </div>

      </div>
    </div>
  );
}
