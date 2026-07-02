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
  Play, Check,
  FileSpreadsheet, Calculator,
  Hammer, Save,
  AlertTriangle,
  RotateCcw,
  Zap,
  Workflow,
  PlusCircle,
  ArrowRight,
  Trash2,
  Pencil
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, orderBy, where, limit, doc, addDoc, updateDoc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
import { DocumentService } from '@/services/document-service';
import { BOQ, BOQItem, BOQItemExecutionEntry } from '@/types/documents';
import { BOQTemplate } from '@/types/templates';
import { CommentSection } from '@/components/transactions/comment-section';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { VOManagerDialog } from '@/components/transactions/vo-manager-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [filterStageId, setFilterStageId] = useState<string | null>(null);
  const [activeTabOverride, setActiveTabOverride] = useState<'active' | 'timeline' | 'chat_archive' | 'time_archive' | undefined>(undefined);
  
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isComplementary, setIsComplementary] = useState(false);
  const [targetStage, setTargetStage] = useState<StageInstance | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number | "">(""); 
  const [progressNotes, setProgressNotes] = useState("");

  const [undoStage, setUndoStage] = useState<StageInstance | null>(null);
  const [clearLogsOnUndo, setClearLogsOnUndo] = useState(false);

  const [incompleteStage, setIncompleteStage] = useState<{ stage: StageInstance, progress: StageProgressResult } | null>(null);
  const [isVOOpen, setIsVOOpen] = useState(false);
  const [namingTemplate, setNamingTemplate] = useState<BOQTemplate | null>(null);
  const [customBOQName, setCustomBOQName] = useState("");
  const [isDeletingBOQ, setIsDeletingBOQ] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isOverExecutionOpen, setIsOverExecutionOpen] = useState(false);

  // Sovereign UI Guard: تحرير قسري للمتصفح عند إغلاق النوافذ لمنع التجمد
  useEffect(() => {
    const isAnyModalOpen = isRecordOpen || isOverExecutionOpen || !!undoStage || !!incompleteStage || !!namingTemplate || showDeleteConfirm || isVOOpen;
    if (!isAnyModalOpen && typeof document !== 'undefined') {
       document.body.style.pointerEvents = 'auto';
       document.body.style.overflow = 'auto';
    }
  }, [isRecordOpen, isOverExecutionOpen, undoStage, incompleteStage, namingTemplate, showDeleteConfirm, isVOOpen]);

  const editAccess = check('projects', 'edit');
  const currentUserName = useMemo(() => globalUser?.username || user?.displayName || 'Admin', [globalUser, user]);

  const transRef = useMemo(() => (companyId && db) ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => 
    (companyId && db) ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order', 'asc')) : null, 
  [db, companyId, transactionId]);

  const { data: rawStages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId), limit(1)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs && boqs.length > 0 ? boqs[0] : null;

  const templatesQuery = useMemo(() => 
    (companyId && db && transaction) ? query(collection(db, paths.boqTemplates(companyId)), where('subServiceId', '==', transaction.subServiceId), where('isActive', '==', true)) : null, 
  [db, companyId, transaction]);
  const { data: availableTemplates } = useCollection<BOQTemplate>(templatesQuery);

  const itemsQuery = useMemo(() => (companyId && db && activeBoq?.id) ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const executionsQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: allExecutions } = useCollection<BOQItemExecutionEntry>(executionsQuery);

  const stages = useMemo(() => {
    if (!rawStages) return [];
    return [...rawStages]
      .filter(s => {
        if (!s.isTemporary) return true;
        if (s.status !== 'pending') return true;
        const hasWork = (boqItems || []).some(i => (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(s.technicalStageId) || i.technicalStageId === s.technicalStageId));
        return hasWork;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawStages, boqItems]);

  const progressPercent = useMemo(() => {
    if (!stages || stages.length === 0) return 0;
    const completedCount = stages.filter(s => s.status === 'completed').length;
    return Math.round((completedCount / stages.length) * 100);
  }, [stages]);

  const maxCompletedOrder = useMemo(() => {
    if (!stages || stages.length === 0) return -1;
    const completedOrders = stages.filter(s => s.status === 'completed' && !s.isComplementary).map(s => s.order || 0);
    return completedOrders.length > 0 ? Math.max(...completedOrders) : -1;
  }, [stages]);

  const executionService = useMemo(() => (db && companyId) ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    let active = true;
    async function fetchAllProgress() {
      if (!executionService || !stages || stages.length === 0) return;
      const results: Record<string, StageProgressResult> = {};
      const promises = stages.map(async (s) => {
        const res = await executionService.getTechnicalStageProgress(transactionId, s.technicalStageId);
        return { id: s.technicalStageId, res };
      });
      const resolved = await Promise.all(promises);
      resolved.forEach(item => { results[item.id] = item.res; });
      if (active) setStageProgressMap(results);
    }
    fetchAllProgress();
    return () => { active = false; };
  }, [executionService, stages, transactionId, allExecutions]);

  const transactionService = useMemo(() => (db && companyId) ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  const handleRecordProgress = (force: boolean = false) => {
    if (!executionService || !user || !targetStage || !selectedItemId) return;
    const qtyInput = isComplementary ? 0 : Number(progressQty);

    if (!isComplementary && (progressQty === "" || qtyInput <= 0)) {
        toast({ variant: "destructive", title: isRtl ? "يرجى إدخال كمية صحيحة" : "Enter valid quantity" });
        return;
    }

    if (!force && !isComplementary && selectedBOQItemMetrics && qtyInput > selectedBOQItemMetrics.remaining) {
        setIsOverExecutionOpen(true);
        return;
    }

    setIsOverExecutionOpen(false);
    setIsRecordOpen(false);

    setTimeout(async () => {
        setLoadingAction('recording');
        try {
            await executionService.recordBOQItemExecution(
              activeBoq!.id, 
              selectedItemId, 
              targetStage.technicalStageId, 
              qtyInput, 
              user.uid, 
              currentUserName, 
              progressNotes, 
              targetStage.id!,
              force 
            );
            toast({ title: isRtl ? "تم تسجيل الإنجاز" : "Progress Logged" });
            setProgressQty(""); 
            setProgressNotes("");
            setSelectedItemId("");
            setIsComplementary(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: t('error'), description: e.message });
        } finally {
            setLoadingAction(null);
        }
    }, 100);
  };

  const selectedBOQItemMetrics = useMemo(() => {
    if (!selectedItemId || !boqItems) return null;
    const item = boqItems.find(i => i.id === selectedItemId);
    if (!item) return null;
    const executed = (allExecutions || []).filter(e => e.boqItemId === selectedItemId && e.isArchived !== true).reduce((sum, e) => sum + (e.quantity || 0), 0);
    return { planned: item.plannedQuantity || 0, executed, remaining: Math.max(0, (item.plannedQuantity || 0) - executed), unit: item.unitSymbol || item.unitName, isExceeded: executed >= (item.plannedQuantity || 0) };
  }, [selectedItemId, boqItems, allExecutions]);

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try { await transactionService.startStage(transactionId, stageId, user.uid, currentUserName); toast({ title: isRtl ? "تم بدء العمل" : "Stage Started" }); }
    catch (e: any) { toast({ variant: "destructive", title: t('error'), description: e.message }); }
    finally { setProcessingId(null); }
  };

  const handleCompleteStage = async (stage: StageInstance, force: boolean = false) => {
    if (!transactionService || !user || !stage.id) return;
    const progress = stageProgressMap[stage.technicalStageId];
    if (!force && progress && !progress.canComplete) { setIncompleteStage({ stage, progress }); return; }
    setProcessingId(stage.id);
    try { await transactionService.completeStage(transactionId, stage.id, user.uid, currentUserName, force); toast({ title: isRtl ? "تم إنجاز المرحلة" : "Stage Completed" }); setIncompleteStage(null); }
    catch (e: any) { toast({ variant: "destructive", title: isRtl ? "تعذر إغلاق المرحلة" : "Cannot Close", description: e.message }); }
    finally { setProcessingId(null); }
  };

  const handleReopenStage = async () => {
    if (!transactionService || !user || !undoStage) return;
    const sId = undoStage.id!;
    setUndoStage(null);
    setTimeout(async () => {
        setProcessingId(sId);
        try {
          await transactionService.reopenStage(transactionId, sId, user.uid, currentUserName, clearLogsOnUndo);
          toast({ title: isRtl ? "تمت إعادة فتح المرحلة وتجميد اللاحقة" : "Stage Reopened" });
          setActiveTabOverride('time_archive');
        } catch (e: any) {
          toast({ variant: "destructive", title: t('error'), description: e.message });
        } finally {
          setProcessingId(null);
        }
    }, 100);
  };

  const handleDeleteBOQ = async () => {
    if (!db || !companyId || !activeBoq) return;
    setIsDeletingBOQ(true);
    try {
      const docService = new DocumentService(db, companyId, permissions);
      await docService.deleteBOQ(activeBoq.id, transactionId, user?.uid, currentUserName);
      toast({ title: isRtl ? "تم حذف المقايسة وتطهير المسار" : "BOQ & Path Purged" });
      setShowDeleteConfirm(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setIsDeletingBOQ(false);
    }
  };

  const handleConfirmLinkBOQ = async () => {
    if (!db || !companyId || !user || !namingTemplate || !transaction) return;
    setProcessingId('linking_boq');
    try {
      const docService = new DocumentService(db, companyId, permissions);
      const boqId = await docService.instantiateBoqFromTemplate(namingTemplate.id!, {
        transactionId, clientId: transaction.clientId, clientName: transaction.clientName,
        activityTypeId: transaction.activityTypeId, serviceId: transaction.serviceId,
        subServiceId: transaction.subServiceId, name: customBOQName
      }, user.uid, currentUserName);
      toast({ title: isRtl ? "تم إنشاء المقايسة" : "BOQ Created" });
      setNamingTemplate(null);
      router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4 text-start">
           <div className="h-11 px-4 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border-2 border-primary/20 shadow-inner">{transaction?.transactionNumber}</div>
           <div>
              <h1 className="text-xl font-black font-headline text-slate-900 leading-tight">{transaction?.subServiceName}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                 <Badge className={cn("font-black px-2 py-0.5 rounded-lg border-0 shadow-sm uppercase text-[8px]", transaction?.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{transaction?.status}</Badge>
                 <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Activity className="h-2.5 w-2.5 text-primary" /> {transaction?.activityTypeName}</span>
              </div>
           </div>
        </div>
        <div className="flex gap-2">
           {activeBoq && (
             <>
                <Button onClick={() => setIsVOOpen(true)} className="btn-gradient h-10 px-6 rounded-xl gap-2">
                  <Calculator className="h-4 w-4" /> {isRtl ? 'أمر تغييري' : 'Variation Order'}
                </Button>
                <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="btn-gradient h-10 px-6 rounded-xl gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> {isRtl ? 'عرض المقايسة' : 'View BOQ'}
                </Button>
                {isAdmin && <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)} className="h-10 w-10 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all"><Trash2 className="h-5 w-5" /></Button>}
             </>
           )}
        </div>
      </div>

      {!activeBoq ? (
         <Card className="border-4 border-dashed border-primary/20 rounded-[2.5rem] bg-white shadow-2xl p-12 text-center animate-in zoom-in-95">
            <div className="max-w-2xl mx-auto space-y-8">
               <div className="mx-auto w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner"><FileSpreadsheet className="h-10 w-10" /></div>
               <div className="space-y-2">
                  <h2 className="text-2xl font-black font-headline">{isRtl ? 'المرحلة الأولى: هندسة الميزانية' : 'Step 1: Budget Engineering'}</h2>
                  <p className="text-slate-500 font-bold text-sm leading-relaxed">{isRtl ? 'اختر قالب المقايسة المناسب للمشروع لتخصيص الكميات والأسعار قبل بدء التنفيذ الميداني.' : 'Choose the appropriate BOQ template to customize quantities and rates before site execution starts.'}</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableTemplates?.map(temp => (
                    <Card key={temp.id} className="border-2 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer rounded-2xl p-6 text-start group" onClick={() => {
                        setNamingTemplate(temp);
                        setCustomBOQName(`${temp.name} - ${transaction?.transactionNumber || ''}`);
                    }}>
                       <div className="flex items-center justify-between mb-4"><Badge variant="outline" className="font-black text-[8px] px-2">{temp.code}</Badge><PlusCircle className="h-4 w-4 text-primary" /></div>
                       <h4 className="font-black text-slate-800 text-sm">{temp.name}</h4>
                       <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">EST. VALUE: {temp.baseAmount?.toLocaleString()} KWD</p>
                    </Card>
                  ))}
               </div>
            </div>
         </Card>
      ) : activeBoq.status === 'draft' ? (
         <Card className="border-4 border-dashed border-primary/10 rounded-[2.5rem] bg-white p-12 text-center animate-in zoom-in-95">
            <div className="max-w-2xl mx-auto space-y-8">
               <div className="mx-auto w-20 h-20 bg-primary/5 text-primary rounded-2xl flex items-center justify-center shadow-inner"><Calculator className="h-10 w-10" /></div>
               <div className="space-y-2"><h2 className="text-2xl font-black font-headline text-slate-900">{isRtl ? 'الميزانية قيد التخصيص' : 'Budget Under Customization'}</h2><p className="text-slate-500 font-bold text-sm leading-relaxed">{isRtl ? 'يجب الانتهاء من ضبط الكميات والبنود في صفحة المقايسة والضغط على "اعتماد" لتفعيل المسار الفني وبدء العمل.' : 'Finalize quantities and items in the BOQ page and click "Approve" to activate the technical path and start site work.'}</p></div>
               <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="btn-gradient h-16 px-12 rounded-2xl text-xl gap-3">
                 <Pencil className="h-6 w-6" /> {isRtl ? 'تخصيص بنود المقايسة الآن' : 'Customize BOQ Now'}
               </Button>
            </div>
         </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
             <div className="space-y-6">
                <div className="flex justify-between items-end px-2"><h3 className="text-lg font-black font-headline text-slate-800 flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" /> {isRtl ? 'رادار المسار الميداني' : 'Field Pipeline'}</h3><span className="text-3xl font-black font-headline text-primary">{progressPercent}%</span></div>
                <div className="space-y-4">
                   {stages.map((stage, idx) => {
                      const boqProgress = stageProgressMap[stage.technicalStageId];
                      
                      const isPreviousCompleted = (() => {
                        if (idx === 0) return true;
                        let prevIdx = idx - 1;
                        while (prevIdx >= 0 && stages[prevIdx].isComplementary) prevIdx--;
                        if (prevIdx < 0) return true;
                        return stages[prevIdx].status === 'completed';
                      })();

                      const isAnchorStarted = idx === 0 || stages[idx - 1].status !== 'pending';
                      
                      const isOperationalFrontier = stage.isComplementary 
                        ? (stage.status === 'in-progress' || (stage.status === 'pending' && isAnchorStarted))
                        : (stage.status === 'in-progress' || (stage.status === 'pending' && isPreviousCompleted));

                      return (
                        <Card key={stage.id} onClick={() => setFilterStageId(filterStageId === stage.id ? null : stage.id!)} className={cn("border-0 shadow-lg rounded-2xl bg-white transition-all overflow-hidden border-s-8 cursor-pointer relative", stage.status === 'completed' ? 'border-s-emerald-500' : stage.status === 'in-progress' ? 'border-s-blue-500 ring-4 ring-blue-500/5' : isOperationalFrontier ? 'border-s-orange-300' : 'border-s-slate-100 opacity-50')}>
                          <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                             <div className="flex items-center gap-5 flex-1 text-start">
                                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black text-base shadow-sm border", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-white")}>{stage.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : (idx + 1)}</div>
                                <div className="space-y-0.5 flex-1">
                                   <div className="flex items-center gap-2">
                                      <h4 className="font-black text-base text-slate-900 tracking-tight">{stage.name}</h4>
                                      {stage.isTemporary && <Badge className="bg-primary/5 text-primary border-0 text-[7px] font-black uppercase h-4 px-1.5">{stage.isComplementary ? 'PARALLEL' : 'MANUAL'}</Badge>}
                                   </div>
                                   {boqProgress && boqProgress.linkedItemsCount > 0 && (<div className="mt-2 space-y-1.5"><div className="flex justify-between text-[8px] font-black uppercase text-slate-400"><span>{isRtl ? 'الإنجاز' : 'Progress'}</span><span>{boqProgress.progressPercent}%</span></div><Progress value={boqProgress.progressPercent} className="h-1" /></div>)}
                                </div>
                             </div>
                             
                             {isOperationalFrontier && (
                                <div className="flex gap-2 shrink-0 z-10 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                   {stage.status === 'in-progress' && editAccess.can && (
                                     <Button onClick={() => { setTargetStage(stage); setIsRecordOpen(true); }} className="btn-gradient h-9 px-4 rounded-xl text-[10px] gap-2">
                                       <Hammer className="h-3.5 w-3.5" /> {isRtl ? 'تسجيل إنجاز' : 'Log'}
                                     </Button>
                                   )}
                                   {stage.status === 'pending' && <Button onClick={() => handleStartStage(stage.id!)} disabled={!!processingId} className="h-9 px-5 rounded-lg bg-blue-600 text-white font-black text-[10px] gap-1.5">{processingId === stage.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {isRtl ? 'بدء' : 'Start'}</Button>}
                                   {stage.status === 'in-progress' && <Button onClick={() => handleCompleteStage(stage)} disabled={!!processingId} className="h-9 px-5 rounded-lg bg-emerald-600 text-white font-black text-[10px] gap-1.5">{processingId === stage.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} {isRtl ? 'إكمال' : 'Done'}</Button>}
                                </div>
                             )}

                             {stage.status === 'completed' && isAdmin && (stage.order === maxCompletedOrder || stage.isComplementary) && (
                                <div className="z-10" onClick={e => e.stopPropagation()}>
                                   <Button variant="ghost" onClick={() => setUndoStage(stage)} className="h-9 w-9 p-0 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"><RotateCcw className="h-4 w-4" /></Button>
                                </div>
                             )}
                          </CardContent>
                        </Card>
                      );
                   })}
                </div>
             </div>
          </div>
          <div className="lg:col-span-4"><CommentSection transactionId={transactionId} path={paths.transactionComments(companyId!, transactionId)} externalLogs={allExecutions || []} boqItems={boqItems || []} stages={stages} filterStageId={filterStageId} technicalStageId={stages.find(s=>s.id===filterStageId)?.technicalStageId} selectedStageName={stages.find(s=>s.id===filterStageId)?.name} onClearFilter={() => setFilterStageId(null)} activeTabOverride={activeTabOverride} /></div>
        </div>
      )}

      {/* مودال تسجيل الإنجاز */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-md ring-1 ring-black/5" dir={dir}>
            <div className="bg-[#1e1b4b] p-6 text-white text-start">
               <DialogTitle className="text-lg font-black font-headline flex items-center gap-3"><Hammer className="h-5 w-5 text-primary" />{isRtl ? 'تسجيل إنجاز فني' : 'Log Technical Progress'}</DialogTitle>
               <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{targetStage?.name}</p>
            </div>
            <div className="p-6 space-y-6 text-start">
               <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'بند العمل الميداني' : 'Target Work Item'}</Label>
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                     <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border-0 shadow-2xl">
                        {boqItems?.filter(i => (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(targetStage?.technicalStageId!) || i.technicalStageId === targetStage?.technicalStageId))
                          .map(i => (
                            <SelectItem key={i.id} value={i.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                               <div className="flex flex-col text-start">
                                  <span className="font-black text-slate-800">{i.referenceTitle}</span>
                                  <span className="text-[8px] text-slate-400 font-mono">#{i.referenceCode}</span>
                               </div>
                            </SelectItem>
                          ))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-5 pt-2">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border"><div className="space-y-0.5"><Label className="font-black text-[12px] text-slate-900 uppercase tracking-tighter">{isRtl ? 'إنجاز تكميلي' : 'Complementary Log'}</Label></div><Switch checked={isComplementary} onCheckedChange={setIsComplementary} /></div>
                  {!isComplementary && (
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الكمية المنفذة حالياً' : 'Quantity Executed'}</Label>
                          <div className="relative">
                            <Input 
                              type="number" 
                              step="0.01" 
                              value={progressQty} 
                              onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} 
                              className={cn(
                                "h-12 rounded-lg border-2 font-black text-xl text-center shadow-inner", 
                                selectedBOQItemMetrics && Number(progressQty) > selectedBOQItemMetrics.remaining ? "border-rose-500 text-rose-600 bg-rose-50" : "border-slate-200"
                              )} 
                              placeholder="..." 
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">{selectedBOQItemMetrics?.unit}</div>
                          </div>
                       </div>
                       {selectedBOQItemMetrics && Number(progressQty) > selectedBOQItemMetrics.remaining && (
                         <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-100 flex items-start gap-3 animate-in shake-1 duration-500">
                           <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                           <p className="text-[10px] font-bold text-rose-600 leading-relaxed text-start">
                              {isRtl ? 'تنبيه: الكمية المدخلة تتجاوز الميزانية المعتمدة في بنود الكميات. يرجى التوجه لإصدار أمر تغييري (VO) لهذا البند.' : 'The input quantity exceeds the budget approved in the Bill of Quantities. Please issue a Variation Order (VO) for this item.'}
                           </p>
                         </div>
                       )}
                    </div>
                  )}
                  <div className="space-y-1.5"><Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تقرير ميداني مصغر' : 'Field Notes'}</Label><Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-lg bg-slate-50/50 border-2 resize-none p-3 text-xs font-bold" placeholder="..." /></div>
               </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-12 rounded-xl font-bold">إلغاء</Button>
               <Button onClick={() => handleRecordProgress()} disabled={loadingAction === 'recording' || (!isComplementary && (progressQty === "" || Number(progressQty) <= 0)) || !selectedItemId} className="flex-[2] btn-gradient h-12 rounded-xl text-lg gap-2">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  {isRtl ? 'حفظ السجل الميداني' : 'Commit Log'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={isOverExecutionOpen} onOpenChange={setIsOverExecutionOpen}>
        <AlertDialogContent className="rounded-xl p-8 border-0 shadow-3xl bg-white" dir={dir}>
           <AlertDialogHeader><div className="mx-auto w-20 h-20 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-4 ring-rose-50/50"><AlertTriangle className="h-8 w-8" /></div><AlertDialogTitle className="text-start font-black text-2xl font-headline text-slate-900">تحذير: تجاوز الكمية المخططة</AlertDialogTitle><AlertDialogDescription className="text-start font-bold text-slate-400 mt-2 text-base leading-relaxed">{isRtl ? `أنت تحاول تسجيل كمية تتجاوز المخطط. هل ترغب في الاستمرار؟ سيتم توثيق إقرارك بالموافقة باسمك في سجل التايم لاين.` : `You are recording an over-execution. Continue? Your approval will be logged.`}</AlertDialogDescription></AlertDialogHeader>
           <AlertDialogFooter className="mt-8 gap-3 flex flex-row"><AlertDialogCancel className="flex-1 h-12 rounded-lg font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => handleRecordProgress(true)} className="flex-[2] h-12 rounded-lg font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200">{isRtl ? 'نعم، أقر بالتجاوز' : 'Confirm & Log'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!undoStage} onOpenChange={(open) => !open && setUndoStage(null)}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-md ring-1 ring-black/5" dir={dir}>
            <div className="bg-rose-600 p-6 text-white text-start"><DialogTitle className="text-xl font-black font-headline flex items-center gap-3"><RotateCcw className="h-5 w-5" />{isRtl ? 'بروتوكول التراجع عن الإنجاز' : 'Stage Reversal Protocol'}</DialogTitle></div>
            <div className="p-6 space-y-5 text-start bg-white">
               <div className="p-4 rounded-xl bg-rose-50/50 border-2 border-dashed border-rose-100 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-rose-700 font-bold leading-relaxed">
                     {isRtl 
                       ? 'إعادة فتح المرحلة سيؤدي لإعادتها لحالة "قيد التنفيذ" وتجميد أي مراحل لاحقة (إعادتها لانتظار) لضمان سلامة المسار الفني.' 
                       : 'Reopening will reset subsequent stages to pending to maintain path integrity.'}
                  </p>
               </div>
               <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border-2">
                  <Label className="font-black text-xs uppercase tracking-tighter text-rose-600">{isRtl ? 'تطهير سجلات الإنجاز' : 'Purge Logs'}</Label>
                  <Switch checked={clearLogsOnUndo} onCheckedChange={setClearLogsOnUndo} />
               </div>
               <Button onClick={handleReopenStage} className="w-full h-14 rounded-lg bg-rose-600 text-white font-black text-lg shadow-xl shadow-rose-200 border-b-4 border-rose-800 hover:bg-rose-700">
                  {isRtl ? 'تأكيد إعادة الفتح والتجميد' : 'Confirm Reopen'}
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-xl p-8 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader><div className="mx-auto w-20 h-20 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-4 ring-rose-50/50"><Trash2 className="h-8 w-8" /></div><AlertDialogTitle className="text-start font-black text-2xl font-headline text-slate-900">{isRtl ? 'حذف المقايسة تماماً؟' : 'Permanent Delete?'}</AlertDialogTitle><AlertDialogDescription className="text-start font-bold text-slate-400 mt-2 text-base">{isRtl ? 'سيتم حذف كافة البنود وسجلات التنفيذ وتطهير المسار الفني للبدء من جديد.' : 'All items, execution logs and path will be cleared.'}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3 flex flex-row"><AlertDialogCancel className="flex-1 h-12 rounded-lg font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleDeleteBOQ} disabled={isDeletingBOQ} className="flex-[2] h-12 rounded-lg font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200">{isDeletingBOQ ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف' : 'Delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeBoq && <VOManagerDialog isOpen={isVOOpen} onClose={() => setIsVOOpen(false)} boqId={activeBoq.id} transactionId={transactionId} boqNumber={activeBoq.boqNumber} boqItems={boqItems || []} />}
    </div>
  );
}
