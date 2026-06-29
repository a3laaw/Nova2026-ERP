'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, Clock, Loader2, 
  CheckCircle2,
  Lock, Play, Check,
  FileSpreadsheet, TrendingUp, MessageSquare,
  Hammer, Save,
  AlertTriangle,
  RotateCcw,
  RotateCw,
  DatabaseZap,
  Target,
  Zap
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
import { BOQ, BOQItem, BOQItemExecutionEntry } from '@/types/documents';
import { CommentSection } from '@/components/transactions/comment-section';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TransactionDetailsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const transactionId = params.tId as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // States
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [filterStageId, setFilterStageId] = useState<string | null>(null);
  
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isComplementary, setIsComplementary] = useState(false);
  const [targetStage, setTargetStage] = useState<StageInstance | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number>(0);
  const [progressNotes, setProgressNotes] = useState("");

  const [undoStage, setUndoStage] = useState<StageInstance | null>(null);
  const [clearLogsOnUndo, setClearLogsOnUndo] = useState(false);

  const editAccess = check('projects', 'edit');

  // Data Fetching
  const transRef = useMemo(() => 
    companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, 
  [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order')) : null, 
  [db, companyId, transactionId]);
  const { data: rawStages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId), limit(1)) : null, 
  [db, companyId, transactionId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => 
    companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, 
  [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const executionsQuery = useMemo(() => 
    companyId && db 
      ? query(
          collection(db, paths.executions(companyId)), 
          where('transactionId', '==', transactionId)
        ) 
      : null, 
  [db, companyId, transactionId]);
  const { data: allExecutions } = useCollection<BOQItemExecutionEntry>(executionsQuery);

  const stages = useMemo(() => {
    return [...(rawStages || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawStages]);

  const progressPercent = useMemo(() => {
    if (!stages || stages.length === 0) return 0;
    const completedCount = stages.filter(s => s.status === 'completed').length;
    return Math.round((completedCount / stages.length) * 100);
  }, [stages]);

  const executionService = useMemo(() => db && companyId ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    let active = true;
    async function fetchAllProgress() {
      if (!executionService || !stages || stages.length === 0) return;
      try {
        const results: Record<string, StageProgressResult> = {};
        const promises = stages.map(async (s) => {
          const res = await executionService.getTechnicalStageProgress(transactionId, s.technicalStageId);
          return { id: s.technicalStageId, res };
        });
        const resolved = await Promise.all(promises);
        resolved.forEach(item => { results[item.id] = item.res; });
        if (active) setStageProgressMap(results);
      } catch (e) { console.error(e); }
    }
    fetchAllProgress();
    return () => { active = false; };
  }, [executionService, stages, transactionId, allExecutions]);

  const transactionService = useMemo(() => 
    db && companyId ? new TransactionService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const filteredItemsForStage = useMemo(() => {
    if (!boqItems || !targetStage) return [];
    const sId = targetStage.technicalStageId;
    return boqItems.filter(item => {
      const allowedIds = item.technicalStageIds || [];
      const primaryId = item.technicalStageId;
      return allowedIds.includes(sId) || primaryId === sId;
    });
  }, [boqItems, targetStage]);

  // Actions
  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try {
      await transactionService.startStage(transactionId, stageId, user.uid, user.displayName || 'User');
      toast({ title: isRtl ? "تم بدء العمل" : "Stage Started" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteStage = async (stage: StageInstance) => {
    if (!transactionService || !user || !stage.id) return;
    setProcessingId(stage.id);
    try {
      await transactionService.completeStage(transactionId, stage.id, user.uid, user.displayName || 'User');
      toast({ title: isRtl ? "تم إنجاز المرحلة بنجاح" : "Stage Completed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: isRtl ? "تعذر إغلاق المرحلة" : "Cannot Close Stage", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmedUndo = async () => {
    if (!transactionService || !user || !undoStage?.id) return;
    setProcessingId(undoStage.id);
    try {
      await transactionService.reopenStage(transactionId, undoStage.id, user.uid, user.displayName || 'User', clearLogsOnUndo);
      toast({ title: isRtl ? "تم التراجع وإغلاق المسار اللاحق" : "Undo Success & Future stages locked" });
      setUndoStage(null);
      setClearLogsOnUndo(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRecordProgress = async () => {
    if (!executionService || !activeBoq || !user || !selectedItemId || !targetStage) return;
    setProcessingId('recording');
    try {
      await executionService.recordBOQItemExecution(
        activeBoq.id,
        selectedItemId,
        targetStage.technicalStageId,
        isComplementary ? 0 : progressQty,
        user.uid,
        user.displayName || 'User',
        progressNotes
      );
      toast({ title: isRtl ? "تم تسجيل الإنجاز" : "Progress Recorded" });
      setIsRecordOpen(false);
      setIsComplementary(false);
      setSelectedItemId("");
      setProgressQty(0);
      setProgressNotes("");
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!transaction) return <div className="p-20 text-center font-black text-slate-400">{isRtl ? 'المعاملة غير موجودة' : 'Transaction not found'}</div>;

  const currentFilteredStage = stages.find(s => s.id === filterStageId);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4 text-start">
           <div className="h-12 px-5 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg border-2 border-primary/20 shadow-inner">
              {transaction.transactionNumber}
           </div>
           <div>
              <h1 className="text-2xl font-black font-headline text-slate-900 tracking-tight leading-tight">{transaction.subServiceName}</h1>
              <div className="flex items-center gap-3 mt-1">
                 <Badge className={cn("font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]", transaction.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>
                     {transaction.status}
                 </Badge>
                 <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                     <Activity className="h-3 w-3 text-primary" /> {transaction.activityTypeName}
                 </span>
              </div>
           </div>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="h-11 px-6 rounded-xl bg-white border-2 font-black text-xs gap-2 text-primary border-primary/20 shadow-sm">
              <FileSpreadsheet className="h-4 w-4" /> {isRtl ? 'تتبع إنجاز المقايسة' : 'BOQ Progress'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Stages View */}
        <div className="lg:col-span-8 space-y-8">
           <div className="space-y-6">
              <div className="flex justify-between items-end px-2">
                 <div className="text-start">
                    <h3 className="text-xl font-black font-headline text-slate-800 flex items-center gap-2">
                       <TrendingUp className="h-6 w-6 text-primary" />
                       {isRtl ? 'مسار التنفيذ الميداني المعتمد' : 'Execution Pipeline'}
                    </h3>
                 </div>
                 <div className="text-end"><span className="text-4xl font-black font-headline text-primary">{progressPercent}%</span></div>
              </div>
              
              <div className="space-y-4">
                 {stages.map((stage, idx) => {
                    const boqProgress = stageProgressMap[stage.technicalStageId];
                    const isPreviousCompleted = idx === 0 || stages[idx - 1].status === 'completed';
                    const isSelected = filterStageId === stage.id;

                    return (
                      <Card 
                        key={stage.id} 
                        onClick={() => setFilterStageId(isSelected ? null : stage.id!)}
                        className={cn(
                          "border-0 shadow-lg rounded-[2.5rem] bg-white transition-all overflow-hidden border-s-8 cursor-pointer relative group",
                          stage.status === 'completed' ? 'border-s-emerald-500' : 
                          stage.status === 'in-progress' ? 'border-s-blue-500 ring-4 ring-blue-500/5' : 
                          isPreviousCompleted ? 'border-s-orange-300' : 'border-s-slate-100 opacity-50',
                          isSelected && "ring-4 ring-primary shadow-2xl scale-[1.01]"
                        )}
                      >
                        <CardContent className="p-0">
                           <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                              <div className="flex items-center gap-6 flex-1 text-start">
                                 <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border transition-all", stage.status === 'completed' ? "bg-emerald-500 text-white" : !isPreviousCompleted ? "bg-slate-50 text-slate-300" : "bg-white group-hover:bg-primary/5")}>
                                    {stage.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : (idx + 1)}
                                 </div>
                                 <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                       <h4 className="font-black text-lg text-slate-900 tracking-tight">{stage.name}</h4>
                                       {!isPreviousCompleted && stage.status !== 'completed' && <Lock className="h-3 w-3 text-slate-300" />}
                                       {isSelected && <Target className="h-3.5 w-3.5 text-primary animate-pulse" />}
                                    </div>
                                    {boqProgress && boqProgress.linkedItemsCount > 0 && (
                                      <div className="mt-2 space-y-1.5">
                                         <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                                            <span className="flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" /> {isRtl ? 'إنجاز البنود المخططة' : 'Linked BOQ Items'}</span>
                                            <span>{boqProgress.progressPercent}%</span>
                                         </div>
                                         <Progress value={boqProgress.progressPercent} className="h-1.5" />
                                      </div>
                                    )}
                                 </div>
                              </div>

                              <div className="flex gap-2 shrink-0 z-10" onClick={e => e.stopPropagation()}>
                                 {stage.status === 'completed' && editAccess.can && (
                                    <Button 
                                      onClick={() => setUndoStage(stage)} 
                                      disabled={processingId === stage.id}
                                      variant="ghost" 
                                      className="h-11 px-4 rounded-xl text-slate-400 hover:text-rose-600 font-black text-[10px] gap-2"
                                    >
                                       {processingId === stage.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                       {isRtl ? 'تراجع عن الإكمال' : 'Undo'}
                                    </Button>
                                 )}

                                 {stage.status === 'in-progress' && editAccess.can && (
                                    <Button onClick={() => { setTargetStage(stage); setIsRecordOpen(true); }} variant="outline" className="h-11 px-4 rounded-xl border-2 border-primary/20 text-primary font-black text-xs gap-2 hover:bg-primary/5">
                                       <Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز' : 'Log Progress'}
                                    </Button>
                                 )}
                                 
                                 {stage.status === 'pending' && isPreviousCompleted && (
                                    <Button onClick={() => handleStartStage(stage.id!)} disabled={processingId === stage.id} className="h-11 px-6 rounded-xl bg-blue-600 text-white font-black text-xs gap-2">
                                       {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />} {isRtl ? 'بدء العمل' : 'Start'}
                                    </Button>
                                 )}
                                 {stage.status === 'pending' && !isPreviousCompleted && (
                                    <Badge variant="outline" className="h-11 px-4 rounded-xl border-2 border-slate-100 text-slate-300 font-bold text-[10px] gap-2"><Clock className="h-3 w-3" />{isRtl ? 'بانتظار المرحلة السابقة' : 'Waiting'}</Badge>
                                 )}
                                 {stage.status === 'in-progress' && (
                                    <Button onClick={() => handleCompleteStage(stage)} disabled={processingId === stage.id} className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-black text-xs gap-2">
                                       {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />} {isRtl ? 'إكمال المرحلة' : 'Complete'}
                                    </Button>
                                 )}
                              </div>
                           </div>
                        </CardContent>
                      </Card>
                    );
                 })}
              </div>
           </div>
        </div>

        {/* Unified War Room Sidebar */}
        <div className="lg:col-span-4">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 flex flex-col h-full min-h-[700px]">
              <CardContent className="p-6 flex-1">
                 <CommentSection 
                    transactionId={transactionId} 
                    path={paths.transactionComments(companyId!, transactionId)} 
                    externalLogs={allExecutions || []}
                    boqItems={boqItems || []}
                    filterStageId={filterStageId}
                    selectedStageName={currentFilteredStage?.name}
                    onClearFilter={() => setFilterStageId(null)}
                 />
              </CardContent>
           </Card>
        </div>
      </div>

      {/* Popups (Dialogs) */}
      <Dialog open={isRecordOpen} onOpenChange={(open) => { if(!open) { setIsRecordOpen(false); setIsComplementary(false); } }}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
            <div className="bg-primary/5 p-8 text-slate-900 text-start border-b flex justify-between items-center">
               <div><DialogTitle className="text-2xl font-black font-headline flex items-center gap-3"><Hammer className="h-7 w-7 text-primary" />{isRtl ? 'تسجيل إنجاز ميداني' : 'Record Progress'}</DialogTitle><p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">{targetStage?.name}</p></div>
            </div>
            <div className="p-8 space-y-6 text-start">
               {!activeBoq ? (
                  <div className="p-10 text-center border-2 border-dashed rounded-3xl bg-slate-50"><AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-4" /><p className="font-black text-slate-600">{isRtl ? "لا توجد مقايسة مرتبطة" : "No BOQ linked"}</p></div>
               ) : (
                 <>
                    <div className="p-4 rounded-2xl bg-blue-50/50 border-2 border-blue-100 flex items-center justify-between group transition-all">
                       <div className="flex items-center gap-3"><div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-all", isComplementary ? "bg-blue-600 text-white shadow-lg" : "bg-white text-blue-400 border border-blue-100")}><Zap className="h-5 w-5" /></div><div className="text-start"><Label className="font-black text-xs text-blue-900">{isRtl ? "اعتباره إجراءً مكملاً" : "Complementary Step"}</Label><p className="text-[9px] font-bold text-blue-600/70 uppercase">{isRtl ? "تأكيد فني بدون كمية مادية" : "Technical Check (0 Qty)"}</p></div></div>
                       <Switch checked={isComplementary} onCheckedChange={(v) => { setIsComplementary(v); if(v) setProgressQty(0); }} />
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? "بند المقايسة" : "BOQ Item"}</Label><Select value={selectedItemId} onValueChange={setSelectedItemId}><SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/30"><SelectValue placeholder="..." /></SelectTrigger><SelectContent className="rounded-2xl border-2 shadow-2xl">{filteredItemsForStage.map(item => (<SelectItem key={item.id} value={item.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50"><div className="flex flex-col text-start"><span>{item.referenceTitle}</span><span className="text-[8px] text-slate-400 font-black uppercase">{item.referenceCode} | Qty: {item.plannedQuantity} {item.unitSymbol}</span></div></SelectItem>))}</SelectContent></Select></div>
                    {!isComplementary && (
                      <div className="space-y-2 animate-in slide-in-from-top-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? "الكمية المنفذة" : "Executed Qty"}</Label><div className="relative"><input type="number" value={progressQty || ''} onChange={e => setProgressQty(Number(e.target.value))} className="h-14 w-full rounded-2xl border-2 font-black text-xl text-primary text-center outline-none focus:border-primary/50 transition-all" placeholder="0" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">QTY</div></div></div>
                    )}
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? "ملاحظات التنفيذ" : "Field Notes"}</Label><Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-2xl border-2 bg-slate-50/30 p-4 text-xs font-bold" placeholder={isRtl ? "اكتب هنا تفاصيل التنفيذ أو حالة الموقع..." : "Enter field details or site status..."} /></div>
                 </>
               )}
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">إلغاء</Button>
               <Button onClick={handleRecordProgress} disabled={!activeBoq || !selectedItemId || (progressQty <= 0 && !isComplementary) || processingId === 'recording'} className={cn("flex-[2] h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 gap-2 border-b-4 transition-all", isComplementary ? "bg-blue-600 text-white border-blue-800" : "bg-primary text-white border-orange-700")}>{processingId === 'recording' ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}{isComplementary ? (isRtl ? "تأكيد فني" : "Confirm Check") : (isRtl ? "تأكيد التسجيل" : "Confirm Record")}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!undoStage} onOpenChange={(open) => !open && setUndoStage(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
          <div className="bg-rose-50 p-8 text-rose-900 text-start border-b flex justify-between items-center">
             <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shadow-inner">
                   <RotateCcw className="h-6 w-6" />
                </div>
                <div>
                   <AlertDialogTitle className="text-xl font-black font-headline">{isRtl ? 'التراجع عن إكمال المرحلة' : 'Undo Stage Completion'}</AlertDialogTitle>
                   <p className="text-[10px] font-bold text-rose-600/70 uppercase tracking-widest">{undoStage?.name}</p>
                </div>
             </div>
          </div>

          <div className="p-8 space-y-8 text-start">
             <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-100 flex items-start gap-4">
                   <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                   <div className="space-y-1">
                      <h5 className="font-black text-xs text-amber-900">{isRtl ? 'تنبيه التسلسل الهندسي' : 'Sequential Warning'}</h5>
                      <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                         {isRtl 
                           ? 'سيتم إعادة قفل المرحلة التالية (إذا بدأت) لضمان سلامة مسار العمل. سيتم نقل تعليقات المرحلة الحالية للأرشيف.' 
                           : 'Next stage will be locked. Current stage comments will be moved to Archive.'}
                      </p>
                   </div>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 border-2 border-white shadow-inner space-y-5">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-all", clearLogsOnUndo ? "bg-rose-600 text-white shadow-lg" : "bg-white text-slate-300 border")}>
                            <DatabaseZap className="h-5 w-5" />
                         </div>
                         <div className="text-start">
                            <Label className="font-black text-xs text-slate-900">{isRtl ? 'تصفير سجلات الإنجاز' : 'Reset Execution Logs'}</Label>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{isRtl ? 'حذف كافة الكميات المسجلة في هذه المرحلة' : 'Delete all quantities recorded in this stage'}</p>
                         </div>
                      </div>
                      <Switch checked={clearLogsOnUndo} onCheckedChange={setClearLogsOnUndo} />
                   </div>
                </div>
             </div>
          </div>

          <AlertDialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3">
             <AlertDialogCancel className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">{isRtl ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
             <AlertDialogAction 
               onClick={handleConfirmedUndo}
               disabled={processingId === undoStage?.id}
               className="flex-[2] h-14 rounded-2xl bg-rose-600 text-white font-black text-lg shadow-xl shadow-rose-200 border-b-8 border-rose-800 hover:bg-rose-700"
             >
                {processingId === undoStage?.id ? <Loader2 className="animate-spin h-5 w-5" /> : <RotateCw className="h-5 w-5 gap-2" />}
                {isRtl ? 'تأكيد التراجع' : 'Confirm Undo'}
             </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
