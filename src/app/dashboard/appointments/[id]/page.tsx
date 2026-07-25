'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowRight, Calendar, Clock, User, 
  MessageSquare, ShieldCheck, 
  Loader2, Workflow, CheckCircle2,
  AlertTriangle, Hammer,
  Check, Layers, Info, Save,
  Target, Zap, Play, X, RotateCcw,
  ListChecks,
  AlertCircle
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

export default function AppointmentDetailPage() {
  const apptId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { permissions, isAdmin, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // الحالات والتحكم
  const [activeTab, setActiveTab] = useState('pipeline');
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number | "">(""); 
  const [progressNotes, setProgressNotes] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});

  // حالات تسجيل المراجعة (Revision) - موحدة مع المعاملة
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

  // جلب المراحل - نفس المسار المرجعي للمعاملة لضمان التزامن السيادي
  const stagesQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null,
  [db, companyId, appt?.transactionId]);
  const { data: rawStages } = useCollection<StageInstance>(stagesQuery);
  const stages = useMemo(() => (rawStages || []).sort((a,b) => (a.order || 0) - (b.order || 0)), [rawStages]);

  // تعيين أول مرحلة غير مكتملة كاختيار افتراضي لتبسيط العمل
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      const nextStage = stages.find(s => s.status !== 'completed');
      if (nextStage) setSelectedStageId(nextStage.id!);
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

  // جلب التعليقات لفحص شرط الإغلاق
  const commentsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionComments(companyId, appt.transactionId))) : null,
  [db, companyId, appt?.transactionId]);
  const { data: comments } = useCollection<any>(commentsQuery);

  const isConsulting = useMemo(() => {
    const name = transaction?.activityTypeName || '';
    return name.includes('استشارات') || name.includes('Consulting') || name.includes('تصميم') || name.includes('Design');
  }, [transaction]);

  const executionService = useMemo(() => (db && companyId) ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);
  const transactionService = useMemo(() => (db && companyId) ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    let active = true;
    async function fetchAllProgress() {
      if (!executionService || !stages || stages.length === 0 || isConsulting || !appt?.transactionId) return;
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
  }, [executionService, stages, appt?.transactionId, allExecutions, isConsulting]);

  // --- محرك فحص جاهزية الإغلاق (The Closure Readiness Engine) ---
  const checkResults = useMemo(() => {
    if (!appt?.transactionId) return { hasAchievement: true, hasComment: true, ready: true };
    
    // 1. فحص الإنجاز الفني (سجلات إنجاز أو مراجعات)
    const hasProgressLogs = (allExecutions || []).length > 0;
    const hasRevisions = stages.some(s => (s.revisionCount || 0) > 0);
    const hasAchievement = hasProgressLogs || hasRevisions;

    // 2. فحص التعليق (يجب أن يكون المهندس قد كتب تعليقاً واحداً على الأقل في هذه المعاملة)
    const hasComment = (comments || []).some((c: any) => c.createdBy === user?.uid);

    return {
      hasAchievement,
      hasComment,
      ready: hasAchievement && hasComment
    };
  }, [allExecutions, comments, stages, appt?.transactionId, user?.uid]);

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user || !appt?.transactionId) return;
    setProcessingId(stageId);
    try {
      await transactionService.startStage(appt.transactionId, stageId, user.uid, globalUser?.username || 'User');
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
      await transactionService.completeStage(appt.transactionId, stage.id, user.uid, globalUser?.username || 'User', force);
      toast({ title: isRtl ? "تم إنجاز المرحلة" : "Stage Completed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRevisionDialog = (stage: StageInstance) => {
    setRevisionStage(stage);
    setRevisionComment("");
    setIsRevisionOpen(true);
  };

  const handleConfirmRevision = async () => {
    if (!transactionService || !user || !revisionStage || !revisionComment.trim() || !appt?.transactionId) return;
    
    setProcessingId(`rev_${revisionStage.id}`);
    setIsRevisionOpen(false);
    try {
      await transactionService.incrementStageRevision(
        appt.transactionId, 
        revisionStage.id!, 
        user.uid, 
        globalUser?.username || 'User', 
        revisionComment
      );
      toast({ title: isRtl ? "تم تسجيل دورة مراجعة جديدة بنجاح" : "Revision Cycle Logged" });
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
      const currentUserName = globalUser?.username || user.displayName || 'Engineer';
      
      const stage = stages?.find(s => s.id === selectedStageId);
      if (!stage) throw new Error("Stage not found");

      await service.recordBOQItemExecution(
        activeBoq.id, 
        selectedItemId, 
        stage.technicalStageId, 
        qtyInput, 
        user.uid, 
        currentUserName, 
        progressNotes, 
        selectedStageId
      );

      toast({ title: isRtl ? "تم تسجيل الإنجاز في الميدان" : "Field Progress Logged" });
      setIsRecordOpen(false);
      setProgressQty("");
      setProgressNotes("");
      setSelectedItemId("");
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
      toast({ title: isRtl ? "تم إنجاز الموعد" : "Appt Completed" });
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
  if (!appt) return <div className="p-20 text-center font-black">{isRtl ? 'الموعد غير موجود' : 'Not found'}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="h-12 w-12 border-2 rounded-2xl bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900">{appt.title}</h1>
             <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-[0.2em] opacity-60">
               {appt.clientName} | {transaction?.transactionNumber || (isRtl ? 'موعد منفصل' : 'External')}
             </p>
           </div>
        </div>
        
        {appt.status !== 'completed' && (
           <div className="flex flex-col items-end gap-2">
              <Button 
                onClick={handleCompleteAppt} 
                disabled={!checkResults.ready}
                className={cn(
                  "h-14 px-10 rounded-2xl font-black text-lg transition-all gap-3 border-b-8 shadow-xl hover:scale-105",
                  checkResults.ready ? "bg-emerald-600 text-white border-emerald-800 shadow-emerald-100" : "bg-slate-200 text-slate-400 border-slate-400"
                )}
              >
                  <CheckCircle2 className="h-6 w-6" />
                  {isRtl ? 'إغلاق وإنجاز الموعد' : 'Complete Appointment'}
              </Button>
              {!checkResults.ready && (
                <div className="flex items-center gap-2 text-rose-500 font-black text-[9px] uppercase bg-rose-50 px-3 py-1 rounded-lg animate-pulse">
                   <AlertCircle className="h-3 w-3" />
                   {isRtl ? 'بانتظار تسجيل إنجاز وتعليق' : 'Awaiting achievement & comment'}
                </div>
              )}
           </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-8">
           <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-white border-2 border-slate-100 p-1 rounded-xl h-14 w-full md:w-fit gap-2 shadow-sm mb-6">
                 <TabsTrigger value="pipeline" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                    <Workflow className="h-4 w-4" /> {isRtl ? 'رادار الزيارة' : 'Field Mission'}
                 </TabsTrigger>
                 <TabsTrigger value="warroom" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                    <MessageSquare className="h-4 w-4" /> {isRtl ? 'غرفة العمليات' : 'War Room'}
                 </TabsTrigger>
              </TabsList>

              <TabsContent value="pipeline" className="space-y-8 animate-in fade-in">
                 <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                    <CardHeader className="bg-slate-900 p-8 text-white flex flex-row justify-between items-center text-start">
                       <div className="text-start">
                          <CardTitle className="text-xl font-black flex items-center gap-3">
                             <Target className="h-6 w-6 text-primary" />
                             {isRtl ? 'مهمة الزيارة الميدانية' : 'Site Mission'}
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{transaction?.subServiceName || 'General Project Visit'}</p>
                       </div>
                       {appt.status !== 'completed' && !isConsulting && (
                          <Button onClick={() => setIsRecordOpen(true)} className="btn-gradient h-12 px-8 rounded-xl gap-2 shadow-lg">
                             <Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز فني' : 'Log Progress'}
                          </Button>
                       )}
                    </CardHeader>
                    <CardContent className="p-10 space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-start">
                          <div className="flex items-start gap-4 text-start">
                             <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border"><Calendar className="h-5 w-5" /></div>
                             <div className="text-start">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                                <p className="font-black text-slate-800 text-lg">
                                  {new Date(appt.start).toLocaleDateString(isRtl ? 'ar-KW' : 'en-US', { dateStyle: 'full', numberingSystem: 'latn' })}
                                </p>
                             </div>
                          </div>
                          <div className="flex items-start gap-4 text-start">
                             <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border"><Clock className="h-5 w-5" /></div>
                             <div className="text-start">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</p>
                                <p className="font-black text-slate-800 text-lg">
                                  {new Date(appt.start).toLocaleTimeString(isRtl ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' })}
                                </p>
                             </div>
                          </div>
                       </div>

                       <div className="p-8 rounded-[2rem] bg-slate-50/50 border-2 border-slate-100 flex items-start gap-4 text-start">
                          <Info className="h-6 w-6 text-primary mt-1" />
                          <div className="space-y-1 text-start">
                             <h5 className="font-black text-xs uppercase">{isRtl ? 'توجيهات العمل' : 'Work Instructions'}</h5>
                             <p className="text-sm font-bold text-slate-600 italic">"{appt.notes || (isRtl ? 'لا يوجد ملاحظات.' : 'No notes.')}"</p>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
              </TabsContent>

              <TabsContent value="warroom" className="h-[700px] animate-in fade-in">
                 <div className="bg-white rounded-[3rem] shadow-2xl border border-primary/10 overflow-hidden h-full">
                    <CommentSection 
                       transactionId={appt.transactionId || apptId} 
                       path={appt.transactionId ? paths.transactionComments(companyId!, appt.transactionId) : `companies/${companyId}/appointments/${apptId}/comments`} 
                       title={isRtl ? 'غرفة عمليات المشروع' : 'War Room'}
                    />
                 </div>
              </TabsContent>
           </Tabs>
        </div>

        <div className="lg:col-span-4 space-y-6">
           {appt.transactionId && (
              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-900 p-6 text-white text-start">
                    <div className="flex items-center gap-3">
                       <Layers className="h-5 w-5 text-primary" />
                       <CardTitle className="text-sm font-black uppercase tracking-widest">{isRtl ? 'رادار المسار الفني' : 'Pipeline'}</CardTitle>
                    </div>
                 </CardHeader>
                 <CardContent className="p-4 space-y-2">
                    {stages.map((stage, idx) => {
                       const isSelected = stage.id === selectedStageId;
                       const isPreviousCompleted = idx === 0 || stages[idx-1].status === 'completed';
                       // تعريف "الجبهة التشغيلية" (Frontier): المرحلة التي يمكن البدء فيها أو إنجازها
                       const isFrontier = stage.status === 'in-progress' || (stage.status === 'pending' && isPreviousCompleted);
                       
                       return (
                          <div 
                            key={stage.id} 
                            onClick={() => { setSelectedStageId(stage.id!); }}
                            className={cn(
                              "p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-3 group",
                              isSelected ? "bg-primary/5 border-primary shadow-lg scale-105" : "bg-white border-slate-100 hover:border-slate-200"
                            )}
                          >
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                   <div className={cn(
                                      "h-8 w-8 rounded-lg flex items-center justify-center font-black text-[11px] border",
                                      stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-white"
                                   )}>
                                      {stage.status === 'completed' ? <Check className="h-4 w-4" /> : (idx + 1)}
                                   </div>
                                   <div className="text-start">
                                      <div className="flex items-center gap-2">
                                         <p className={cn("text-[11px] font-black leading-tight", isSelected ? "text-primary" : "text-slate-800")}>{stage.name}</p>
                                         {isConsulting && (stage.revisionCount || 0) > 0 && (
                                            <Badge className="bg-orange-100 text-orange-700 border-0 font-black text-[7px] h-4 px-1.5">
                                               #{stage.revisionCount}
                                            </Badge>
                                         )}
                                      </div>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase">{stage.status}</p>
                                   </div>
                                </div>
                                {isSelected && <Badge className="bg-primary text-white text-[7px] font-black h-4 px-2">SELECTED</Badge>}
                             </div>

                             {/* أزرار الإجراءات - تظهر عند تحديد المرحلة إذا كانت في الجبهة التشغيلية */}
                             {isSelected && isFrontier && (
                                <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                                   {stage.status === 'pending' && (
                                      <Button onClick={() => handleStartStage(stage.id!)} disabled={!!processingId} className="flex-1 h-9 rounded-xl bg-blue-600 text-white font-black text-[9px] gap-2 shadow-lg">
                                         {processingId === stage.id ? <Loader2 className="animate-spin h-3 w-3" /> : <Play className="h-3 w-3" />}
                                         {isRtl ? 'بدء العمل' : 'Start'}
                                      </Button>
                                   )}
                                   {stage.status === 'in-progress' && (
                                      <>
                                        <Button onClick={() => handleCompleteStage(stage)} disabled={!!processingId} className="flex-1 h-9 rounded-xl bg-emerald-600 text-white font-black text-[9px] gap-2 shadow-lg">
                                           {processingId === stage.id ? <Loader2 className="animate-spin h-3 w-3" /> : <Check className="h-3 w-3" />}
                                           {isRtl ? 'إنجاز' : 'Done'}
                                        </Button>
                                        {isConsulting && (
                                           <Button onClick={() => handleOpenRevisionDialog(stage)} disabled={!!processingId} variant="outline" className="flex-1 h-9 rounded-xl border-orange-200 text-orange-600 font-black text-[9px] gap-2 hover:bg-orange-50">
                                              <RotateCcw className="h-3 w-3" />
                                              {isRtl ? 'دورة تعديل' : 'Revision'}
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
           )}
        </div>

      </div>

      {/* مودال تسجيل المراجعة (Revision) */}
      <Dialog open={isRevisionOpen} onOpenChange={(v) => { if(!v) setIsRevisionOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 max-w-lg border-0 shadow-3xl bg-white z-[150]" dir={dir}>
            <div className="bg-orange-50 p-6 border-b text-orange-900 text-start">
               <DialogTitle className="text-xl font-black flex items-center gap-3">
                  <RotateCcw className="h-6 w-6" /> {isRtl ? 'توثيق مراجعة وتعديل التصميم' : 'Log Design Revision'}
               </DialogTitle>
               <p className="text-xs font-bold mt-1 opacity-70">{revisionStage?.name}</p>
            </div>
            <div className="p-8 space-y-4 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'أسباب أو تفاصيل التعديل' : 'Revision Notes / Reason'}</Label>
               <Textarea 
                 value={revisionComment} 
                 onChange={e => setRevisionComment(e.target.value)}
                 placeholder={isRtl ? "ما هي التعديلات التي طلبها العميل في هذه الزيارة؟" : "What changes did the client request?"}
                 className="min-h-[120px] rounded-2xl border-2 p-5 text-sm font-bold bg-slate-50 focus:bg-white transition-all shadow-inner"
               />
               <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                     {isRtl ? 'سيتم توثيق هذا التعديل في المعاملة وغرفة العمليات لفتح دورة عمل جديدة.' : 'This revision will be logged in the transaction and War Room to open a new cycle.'}
                  </p>
               </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRevisionOpen(false)} className="flex-1 h-12 rounded-xl font-bold">إلغاء</Button>
               <Button 
                 onClick={handleConfirmRevision} 
                 disabled={!revisionComment.trim()} 
                 className="flex-[2] h-12 rounded-xl bg-orange-600 text-white font-black text-lg shadow-xl shadow-orange-200"
               >
                  <Save className="h-5 w-5" /> {isRtl ? 'اعتماد التعديل' : 'Confirm Revision'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* مودال تسجيل الإنجاز (BOQ Progress) */}
      <Dialog open={isRecordOpen} onOpenChange={(v) => { if(!v) setIsRecordOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-md z-[150]" dir={dir}>
            <div className="bg-slate-900 p-6 text-white text-start"><DialogTitle className="text-lg font-black flex items-center gap-3"><Hammer className="h-5 w-5 text-primary" />{isRtl ? 'تسجيل إنجاز فني (ميداني)' : 'Log Progress'}</DialogTitle></div>
            <div className="p-6 space-y-6 text-start">
               <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase text-slate-400">{isRtl ? 'تحديد المرحلة التنفيذية' : 'Execution Stage'}</Label>
                  <Select value={selectedStageId} onValueChange={v => { setSelectedStageId(v); setSelectedItemId(""); }}>
                     <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border shadow-2xl">
                        {stages?.filter(s => s.status === 'in-progress').map(s => (<SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">{s.name}</SelectItem>))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase text-slate-400">{isRtl ? 'بند العمل المستهدف' : 'Target Item'}</Label>
                  <Select disabled={!selectedStageId} value={selectedItemId} onValueChange={setSelectedItemId}>
                     <SelectTrigger className="h-10 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border shadow-2xl">
                        {boqItems?.filter(i => {
                           const stage = stages?.find(s => s.id === selectedStageId);
                           return (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(stage?.technicalStageId!) || i.technicalStageId === stage?.technicalStageId);
                        }).map(i => (<SelectItem key={i.id} value={i.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                             <div className="flex flex-col text-start">
                                <span className="font-black text-slate-800">{i.referenceTitle}</span>
                                <span className="text-[8px] text-slate-400 font-mono">#{i.referenceCode}</span>
                             </div>
                        </SelectItem>))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-4 pt-2">
                  <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-slate-400">Quantity Executed</Label><Input type="number" step="0.01" value={progressQty} onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} className="h-12 rounded-lg border-2 font-black text-2xl text-center shadow-inner" /></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-black uppercase text-slate-400">Engineer Notes</Label><Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-lg bg-slate-50/50 border-2 text-xs font-bold" /></div>
               </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-12 rounded-xl font-bold">إلغاء</Button>
               <Button onClick={handleRecordProgress} disabled={!!loadingAction || !selectedItemId || !selectedStageId} className="flex-[2] btn-gradient h-12 rounded-xl text-lg gap-2 shadow-xl shadow-orange-500/20">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isRtl ? 'حفظ وإرسال التقرير' : 'Confirm & Save'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
