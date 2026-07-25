'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, Workflow, CheckCircle2,
  AlertTriangle, Hammer, Check, Layers, Save,
  Target, X, RotateCcw, Lock, Info, AlertCircle, Play
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { Transaction, StageInstance } from '@/types/transaction';
import { BOQ, BOQItem, BOQItemExecutionEntry } from '@/types/documents';
import { CommentSection } from '@/components/transactions/comment-section';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
import { AppointmentService } from '@/services/appointment-service';
import { TransactionService } from '@/services/transaction-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * @fileOverview صفحة الزيارة الميدانية المبسطة (Sovereign Task Radar).
 * تم حذف نظام التبويبات والمهمة المكررة للتركيز على الرادار الفني وغرفة العمليات.
 * فرض قفل البدء في مراحل جديدة إذا تم تسجيل إنجاز في الزيارة الحالية.
 */
export default function AppointmentDetailPage() {
  const apptId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { permissions, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // الحالات
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number | "">(""); 
  const [progressNotes, setProgressNotes] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionStage, setRevisionStage] = useState<StageInstance | null>(null);
  const [revisionComment, setRevisionComment] = useState("");

  const apptRef = useMemo(() => 
    companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, 
  [db, companyId, apptId]);
  const { data: appt, loading: apptLoading } = useDoc<Appointment>(apptRef);

  const transRef = useMemo(() => 
    companyId && db && appt?.transactionId ? doc(db, paths.transactions(companyId), appt.transactionId) : null,
  [db, companyId, appt?.transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null,
  [db, companyId, appt?.transactionId]);
  const { data: rawStages } = useCollection<StageInstance>(stagesQuery);
  const stages = useMemo(() => (rawStages || []).sort((a,b) => (a.order || 0) - (b.order || 0)), [rawStages]);

  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      const active = stages.find(s => s.status === 'in-progress');
      if (active) setSelectedStageId(active.id!);
      else {
        const next = stages.find(s => s.status === 'pending');
        if (next) setSelectedStageId(next.id!);
      }
    }
  }, [stages, selectedStageId]);

  const boqQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', appt.transactionId), limit(1)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => 
    companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null,
  [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const execsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', appt.transactionId)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: allExecutions } = useCollection<BOQItemExecutionEntry>(execsQuery);

  const commentsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionComments(companyId, appt.transactionId))) : null,
  [db, companyId, appt?.transactionId]);
  const { data: comments } = useCollection<any>(commentsQuery);

  const executionService = useMemo(() => (db && companyId) ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);
  const transactionService = useMemo(() => (db && companyId) ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    let active = true;
    async function fetchAllProgress() {
      if (!executionService || !stages || stages.length === 0 || !appt?.transactionId) return;
      const results: Record<string, StageProgressResult> = {};
      const promises = stages.map(async (s) => {
        const res = await executionService.getTechnicalStageProgress(appt.transactionId!, s.technicalStageId);
        return { id: s.technicalStageId, res };
      });
      const resolved = await Promise.all(promises);
      resolved.forEach(item => { results[item.id] = item.res; });
      if (active) setStageProgressMap(results);
    }
    fetchAllProgress();
    return () => { active = false; };
  }, [executionService, stages, appt?.transactionId, allExecutions]);

  const isConsulting = useMemo(() => {
    const name = transaction?.activityTypeName || '';
    return name.includes('استشارات') || name.includes('Consulting') || name.includes('تصميم') || name.includes('Design');
  }, [transaction]);

  // --- محرك فحص الإنجاز والتعليق السيادي ---
  const checkResults = useMemo(() => {
    if (!appt?.transactionId) return { hasAchievement: true, hasComment: true, ready: true };
    const hasProgressLogs = (allExecutions || []).some(e => e.appointmentId === apptId);
    const hasRevisionsInWarRoom = (comments || []).some((c: any) => c.appointmentId === apptId && c.commentType === 'note');
    const hasStageCompletion = (rawStages || []).some(s => s.completedByApptId === apptId);
    
    const hasAchievement = hasProgressLogs || hasRevisionsInWarRoom || hasStageCompletion;
    const hasComment = (comments || []).some((c: any) => c.appointmentId === apptId && c.createdBy === user?.uid);

    return {
      hasAchievement,
      hasComment,
      ready: hasAchievement && hasComment
    };
  }, [allExecutions, comments, apptId, appt?.transactionId, user?.uid, rawStages]);

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user || !appt?.transactionId) return;
    setProcessingId(stageId);
    try {
      await transactionService.startStage(appt.transactionId, stageId, user.uid, globalUser?.username || 'User', apptId);
      toast({ title: isRtl ? "تم بدء العمل" : "Stage Started" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteStage = async (stage: StageInstance, force: boolean = false) => {
    if (!transactionService || !user || !stage.id || !appt?.transactionId) return;
    
    if (!isConsulting && !force) {
      const progress = stageProgressMap[stage.technicalStageId];
      if (progress && !progress.canComplete) {
         toast({ variant: "destructive", title: isRtl ? "المرحلة غير مكتملة فنيًا" : "Incomplete", description: progress.reason });
         return;
      }
    }

    setProcessingId(stage.id);
    try {
      await transactionService.completeStage(appt.transactionId, stage.id, user.uid, globalUser?.username || 'User', force, apptId);
      toast({ title: isRtl ? "تم إنجاز المرحلة" : "Stage Completed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmRevision = async () => {
    if (!transactionService || !user || !revisionStage || !revisionComment.trim() || !appt?.transactionId) return;
    setProcessingId(`rev_${revisionStage.id}`);
    setIsRevisionOpen(false);
    try {
      await transactionService.incrementStageRevision(appt.transactionId, revisionStage.id!, user.uid, globalUser?.username || 'User', revisionComment, apptId);
      toast({ title: isRtl ? "تم تسجيل دورة مراجعة جديدة" : "Revision Logged" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
      setRevisionStage(null);
    }
  };

  const handleRecordProgress = async () => {
    if (!db || !companyId || !user || !activeBoq || !selectedItemId || !selectedStageId) return;
    const qtyInput = progressQty === "" ? 0 : Number(progressQty);
    setLoadingAction('recording');
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      const stage = stages?.find(s => s.id === selectedStageId);
      if (!stage) throw new Error("Stage not found");

      await service.recordBOQItemExecution(activeBoq.id, selectedItemId, stage.technicalStageId, qtyInput, user.uid, globalUser?.username || 'User', progressNotes, selectedStageId, false, apptId);
      toast({ title: isRtl ? "تم تسجيل الإنجاز الميداني" : "Progress Logged" });
      setIsRecordOpen(false);
      setProgressQty(""); setProgressNotes(""); setSelectedItemId("");
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCompleteAppt = async () => {
    if (!db || !companyId || !user) return;
    try {
      const service = new AppointmentService(db, companyId);
      await service.updateStatus(apptId, 'completed', user.uid);
      toast({ title: isRtl ? "تم إنجاز الموعد وإغلاق الملف" : "Appt Completed" });
      router.push('/dashboard/appointments');
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    }
  };

  const forceThaw = useCallback(() => {
    if (typeof document !== 'undefined') {
       document.body.style.pointerEvents = 'auto';
       document.body.style.overflow = 'auto';
       document.body.removeAttribute('data-scroll-locked');
    }
  }, []);

  if (apptLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!appt) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start" dir={dir}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="h-12 w-12 border-2 rounded-2xl bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900">{appt.title}</h1>
             <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-[0.2em] opacity-60">
               {appt.clientName} | {transaction?.transactionNumber || 'External'}
             </p>
           </div>
        </div>
        
        {appt.status !== 'completed' && (
           <div className="flex flex-col items-end gap-2">
              <Button 
                onClick={handleCompleteAppt} 
                disabled={!checkResults.ready}
                className={cn(
                  "h-14 px-10 rounded-2xl font-black text-lg transition-all gap-3 border-b-8 shadow-xl",
                  checkResults.ready ? "bg-emerald-600 text-white border-emerald-800 shadow-emerald-100" : "bg-slate-200 text-slate-400 border-slate-400"
                )}
              >
                  <CheckCircle2 className="h-6 w-6" />
                  {isRtl ? 'إغلاق وإنجاز الموعد' : 'Complete Appointment'}
              </Button>
              {!checkResults.ready && (
                <div className="flex items-center gap-2 text-rose-500 font-black text-[9px] uppercase bg-rose-50 px-3 py-1 rounded-lg animate-pulse">
                   <AlertCircle className="h-3 w-3" />
                   {isRtl ? 'بانتظار تسجيل إنجاز وتعليق لهذه الزيارة' : 'Awaiting achievement & comment for this visit'}
                </div>
              )}
           </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Technical Radar */}
        <div className="lg:col-span-7 space-y-6">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 p-8 text-slate-900 border-b flex flex-row justify-between items-center text-start">
                 <div className="text-start">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                       <Target className="h-6 w-6 text-primary" />
                       {isRtl ? 'رادار المسار الفني' : 'Technical Radar'}
                    </CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{transaction?.subServiceName}</p>
                 </div>
                 {appt.status !== 'completed' && !isConsulting && (
                    <Button onClick={() => setIsRecordOpen(true)} className="btn-gradient h-12 px-8 rounded-xl gap-2 shadow-lg">
                       <Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز فني' : 'Log Progress'}
                    </Button>
                 )}
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                 {stages.map((stage, idx) => {
                    const isSelected = stage.id === selectedStageId;
                    const isPreviousCompleted = idx === 0 || stages[idx-1].status === 'completed';
                    
                    // منطق القفل السيادي: لا نفتح المرحلة التالية للبدء إذا كان هناك إنجاز في نفس الموعد
                    const isBlockedInThisVisit = checkResults.hasAchievement && stage.status === 'pending' && isPreviousCompleted;
                    const isFrontier = stage.status === 'in-progress' || (stage.status === 'pending' && isPreviousCompleted && !checkResults.hasAchievement);
                    
                    return (
                       <div 
                         key={stage.id} 
                         onClick={() => setSelectedStageId(stage.id!)}
                         className={cn(
                           "p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col gap-4 group",
                           isSelected ? "bg-primary/5 border-primary shadow-lg scale-[1.01]" : "bg-white border-slate-100 hover:border-slate-200"
                         )}
                       >
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className={cn(
                                   "h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs border shadow-inner",
                                   stage.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white text-slate-400"
                                )}>
                                   {stage.status === 'completed' ? <Check className="h-5 w-5" /> : (idx + 1)}
                                </div>
                                <div className="text-start">
                                   <div className="flex items-center gap-3">
                                      <p className={cn("text-base font-black leading-tight", isSelected ? "text-primary" : "text-slate-800")}>{stage.name}</p>
                                      {isConsulting && (stage.revisionCount || 0) > 0 && (
                                         <Badge className="bg-orange-100 text-orange-700 border-0 font-black text-[9px] h-5 px-2">
                                            {isRtl ? `مراجعة #${stage.revisionCount}` : `Rev #${stage.revisionCount}`}
                                         </Badge>
                                      )}
                                   </div>
                                   <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{stage.status}</p>
                                      {isBlockedInThisVisit && (
                                         <Badge className="bg-rose-50 text-rose-500 border-0 text-[7px] font-black uppercase flex items-center gap-1">
                                            <Lock className="h-2 w-2" /> {isRtl ? 'مغلق مؤقتاً (بانتظار موعد جديد)' : 'Locked: Next Visit Required'}
                                         </Badge>
                                      )}
                                   </div>
                                </div>
                             </div>
                             {isSelected && <Badge className="bg-primary text-white text-[8px] font-black h-5 px-3 rounded-lg shadow-sm">SELECTED</Badge>}
                          </div>

                          {isSelected && isFrontier && (
                             <div className="flex flex-wrap gap-3 animate-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                                {stage.status === 'pending' && (
                                   <Button onClick={() => handleStartStage(stage.id!)} disabled={!!processingId} className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-black text-xs gap-2 shadow-xl shadow-blue-200">
                                      {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />}
                                      {isRtl ? 'بدء العمل في هذه المرحلة' : 'Start Working'}
                                   </Button>
                                )}
                                {stage.status === 'in-progress' && (
                                   <>
                                     <Button onClick={() => handleCompleteStage(stage)} disabled={!!processingId} className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xs gap-2 shadow-xl shadow-emerald-200">
                                        {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                        {isRtl ? 'إنجاز المرحلة نهائياً' : 'Done'}
                                     </Button>
                                     {isConsulting && (
                                        <Button onClick={() => { setRevisionStage(stage); setRevisionComment(""); setIsRevisionOpen(true); }} disabled={!!processingId} variant="outline" className="flex-1 h-12 rounded-2xl border-orange-200 text-orange-600 font-black text-xs gap-2 hover:bg-orange-50 bg-white">
                                           <RotateCcw className="h-4 w-4" />
                                           {isRtl ? 'دورة تعديل مخططات' : 'Log Revision'}
                                        </Button>
                                     )}
                                   </>
                                )}
                             </div>
                          )}
                       </div>
                    );
                 })}
              </CardContent>
           </Card>
        </div>

        {/* Right Side: War Room (Comments Only) */}
        <div className="lg:col-span-5 flex flex-col h-[700px]">
           <div className="bg-white rounded-[3rem] shadow-2xl border border-primary/10 overflow-hidden flex-1 flex flex-col">
              <CommentSection 
                 transactionId={appt.transactionId || apptId} 
                 appointmentId={apptId}
                 path={appt.transactionId ? paths.transactionComments(companyId!, appt.transactionId) : `companies/${companyId}/appointments/${apptId}/comments`} 
                 title={isRtl ? 'غرفة عمليات الزيارة' : 'Visit War Room'}
                 onlyComments={true} 
              />
           </div>
           
           <div className="mt-6 p-6 rounded-[2rem] bg-blue-50/50 border-2 border-dashed border-blue-200 flex items-start gap-4">
              <Info className="h-5 w-5 text-blue-500 shrink-0 mt-1" />
              <div className="text-start space-y-1">
                 <h5 className="font-black text-xs text-blue-900 uppercase">قاعدة وحدة المرجع</h5>
                 <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                   {isRtl ? 'يتم ربط كافة الملاحظات والإنجازات المسجلة هنا برقم الزيارة الحالية لضمان جودة التقارير المالية والإدارية لاحقاً.' : 'All notes and progress recorded here are linked to this visit ID for auditing.'}
                 </p>
              </div>
           </div>
        </div>

      </div>

      {/* Modals */}
      <Dialog open={isRevisionOpen} onOpenChange={(v) => { if(!v) setIsRevisionOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 max-w-lg border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-orange-50 p-8 border-b text-orange-900 text-start">
               <DialogTitle className="text-2xl font-black flex items-center gap-3">
                  <RotateCcw className="h-7 w-7" /> {isRtl ? 'توثيق تعديل التصميم' : 'Design Revision'}
               </DialogTitle>
            </div>
            <div className="p-10 space-y-4 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تفاصيل التعديل' : 'Revision Details'}</Label>
               <Textarea 
                 value={revisionComment} 
                 onChange={e => setRevisionComment(e.target.value)}
                 className="min-h-[150px] rounded-2xl border-2 p-6 text-sm font-bold bg-slate-50 shadow-inner"
                 placeholder="..."
               />
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
               <Button variant="outline" onClick={() => setIsRevisionOpen(false)} className="flex-1 h-14 rounded-2xl font-bold">إلغاء</Button>
               <Button onClick={handleConfirmRevision} disabled={!revisionComment.trim()} className="flex-[2] h-14 rounded-2xl bg-orange-600 text-white font-black text-xl shadow-xl shadow-orange-200">
                  <Save className="h-6 w-6" /> {isRtl ? 'اعتماد التعديل' : 'Commit'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isRecordOpen} onOpenChange={(v) => { if(!v) setIsRecordOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-md" dir={dir}>
            <div className="bg-slate-50 p-8 text-slate-900 border-b text-start"><DialogTitle className="text-xl font-black flex items-center gap-3"><Hammer className="h-6 w-6 text-primary" />{isRtl ? 'تسجيل إنجاز فني' : 'Log Progress'}</DialogTitle></div>
            <div className="p-10 space-y-6 text-start">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المرحلة الحالية' : 'Stage'}</Label>
                  <Select value={selectedStageId} onValueChange={v => { setSelectedStageId(v); setSelectedItemId(""); }}>
                     <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border shadow-2xl">
                        {stages?.filter(s => s.status === 'in-progress').map(s => (<SelectItem key={s.id} value={s.id!} className="font-bold py-3">{s.name}</SelectItem>))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'بند العمل' : 'Item'}</Label>
                  <Select disabled={!selectedStageId} value={selectedItemId} onValueChange={setSelectedItemId}>
                     <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border shadow-2xl">
                        {boqItems?.filter(i => {
                           const stage = stages?.find(s => s.id === selectedStageId);
                           return (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(stage?.technicalStageId!) || i.technicalStageId === stage?.technicalStageId);
                        }).map(i => (<SelectItem key={i.id} value={i.id!} className="font-bold py-3"><div className="text-start flex flex-col"><span className="font-black text-slate-800">{i.referenceTitle}</span><span className="text-[9px] text-slate-400 uppercase">#{i.referenceCode}</span></div></SelectItem>))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-4 pt-2">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Qty Executed</Label><Input type="number" step="0.01" value={progressQty} onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} className="h-14 rounded-xl border-2 font-black text-3xl text-center shadow-inner" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Site Notes</Label><Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-xl bg-slate-50/50 border-2 font-bold" /></div>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-14 rounded-2xl font-bold">إلغاء</Button>
               <Button onClick={handleRecordProgress} disabled={!!loadingAction || !selectedItemId || !selectedStageId} className="flex-[2] btn-gradient h-14 rounded-2xl text-xl gap-2 shadow-xl shadow-orange-500/20">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  {isRtl ? 'حفظ السجل' : 'Confirm'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
