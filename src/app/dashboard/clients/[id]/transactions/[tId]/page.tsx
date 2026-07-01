
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
  Zap,
  Plus,
  Workflow,
  PlusCircle,
  ArrowRight,
  Trash2,
  Pencil,
  Info,
  Calculator,
  ShieldAlert,
  Sparkles,
  XCircle,
  LayoutGrid,
  ShieldX
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, orderBy, where, limit, doc, addDoc } from 'firebase/firestore';
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
  const { check, permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // States
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

  const editAccess = check('projects', 'edit');
  const currentUserName = useMemo(() => globalUser?.username || user?.displayName || 'Admin', [globalUser, user]);

  // Data Fetching
  const transRef = useMemo(() => companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order')) : null, [db, companyId, transactionId]);
  const { data: rawStages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId), limit(1)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs && boqs.length > 0 ? boqs[0] : null;

  const templatesQuery = useMemo(() => 
    companyId && db && transaction ? query(collection(db, paths.boqTemplates(companyId)), where('subServiceId', '==', transaction.subServiceId), where('isActive', '==', true)) : null, 
  [db, companyId, transaction]);
  const { data: availableTemplates } = useCollection<BOQTemplate>(templatesQuery);

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const executionsQuery = useMemo(() => companyId && db ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
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

  const executionService = useMemo(() => db && companyId ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

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

  const transactionService = useMemo(() => db && companyId ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  const handleRecordProgress = async (force: boolean = false) => {
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

    // Sovereing Fix: Close dialogs immediately to release the UI before async work
    if (force) setIsOverExecutionOpen(false);
    setIsRecordOpen(false);

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
        targetStage.id!
      );
      toast({ title: isRtl ? "تم تسجيل الإنجاز" : "Progress Logged" });
      
      // Clear form states only on success
      setProgressQty(""); 
      setProgressNotes("");
      setSelectedItemId("");
      setIsComplementary(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
      // If error, maybe keep form for retry? (already handled by not clearing)
    } finally {
      setLoadingAction(null);
    }
  };

  const selectedBOQItemMetrics = useMemo(() => {
    if (!selectedItemId || !boqItems) return null;
    const item = boqItems.find(i => i.id === selectedItemId);
    if (!item) return null;
    
    const executed = (allExecutions || [])
      .filter(e => e.boqItemId === selectedItemId && e.isArchived !== true)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);

    return {
      planned: item.plannedQuantity || 0,
      executed,
      remaining: Math.max(0, (item.plannedQuantity || 0) - executed),
      unit: item.unitSymbol || item.unitName,
      isExceeded: executed >= (item.plannedQuantity || 0)
    };
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
    setProcessingId(undoStage.id!);
    try {
      await transactionService.reopenStage(transactionId, undoStage.id!, user.uid, currentUserName, clearLogsOnUndo);
      toast({ title: isRtl ? "تمت إعادة فتح المرحلة" : "Stage Reopened" });
      setUndoStage(null);
      setActiveTabOverride('time_archive');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
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
      await docService.instantiateBoqFromTemplate(namingTemplate.id!, {
        transactionId,
        clientId: transaction.clientId,
        clientName: transaction.clientName,
        activityTypeId: transaction.activityTypeId,
        serviceId: transaction.serviceId,
        subServiceId: transaction.subServiceId,
        name: customBOQName
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
           <div className="h-12 px-5 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg border-2 border-primary/20 shadow-inner">{transaction?.transactionNumber}</div>
           <div>
              <h1 className="text-2xl font-black font-headline text-slate-900 leading-tight">{transaction?.subServiceName}</h1>
              <div className="flex items-center gap-3 mt-1">
                 <Badge className={cn("font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]", transaction?.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{transaction?.status}</Badge>
                 <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1"><Activity className="h-3 w-3 text-primary" /> {transaction?.activityTypeName}</span>
              </div>
           </div>
        </div>
        <div className="flex gap-3">
           {activeBoq && (
             <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsVOOpen(true)} className="h-11 px-5 rounded-xl bg-white border-2 font-black text-xs gap-2 text-blue-600 border-blue-100 shadow-sm hover:bg-blue-50"><Calculator className="h-4 w-4" /> {isRtl ? 'أمر تغييري' : 'VO'}</Button>
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="h-11 px-6 rounded-xl bg-white border-2 font-black text-xs gap-2 text-primary border-primary/20 shadow-sm"><FileSpreadsheet className="h-4 w-4" /> {isRtl ? 'إدارة المقايسة' : 'Manage BOQ'}</Button>
                {isAdmin && <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)} className="h-11 w-11 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 border-2 border-transparent hover:border-rose-100"><Trash2 className="h-5 w-5" /></Button>}
             </div>
           )}
        </div>
      </div>

      {!activeBoq ? (
         <Card className="border-4 border-dashed border-primary/20 rounded-[3rem] bg-white shadow-2xl p-12 text-center animate-in zoom-in-95">
            <div className="max-w-2xl mx-auto space-y-8">
               <div className="mx-auto w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center shadow-inner"><FileSpreadsheet className="h-12 w-12" /></div>
               <div className="space-y-2">
                  <h2 className="text-3xl font-black font-headline">{isRtl ? 'المرحلة الأولى: هندسة الميزانية' : 'Step 1: Budget Engineering'}</h2>
                  <p className="text-slate-500 font-bold leading-relaxed">{isRtl ? 'اختر قالب المقايسة المناسب للمشروع لتخصيص الكميات والأسعار قبل بدء التنفيذ الميداني.' : 'Choose the appropriate BOQ template to customize quantities and rates before site execution starts.'}</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableTemplates?.map(temp => (
                    <Card key={temp.id} className="border-2 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer rounded-3xl p-6 text-start group" onClick={() => {
                        setNamingTemplate(temp);
                        setCustomBOQName(`${temp.name} - ${transaction?.transactionNumber || ''}`);
                    }}>
                       <div className="flex items-center justify-between mb-4">
                          <Badge variant="outline" className="font-black text-[9px] px-3">{temp.code}</Badge>
                          <PlusCircle className="h-5 w-5 text-primary" />
                       </div>
                       <h4 className="font-black text-slate-800">{temp.name}</h4>
                       <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">EST. VALUE: {temp.baseAmount?.toLocaleString()} KWD</p>
                    </Card>
                  ))}
               </div>
            </div>
         </Card>
      ) : activeBoq.status === 'draft' ? (
         <Card className="border-4 border-dashed border-blue-200 rounded-[3rem] bg-blue-50/20 p-12 text-center animate-in zoom-in-95">
            <div className="max-w-2xl mx-auto space-y-8">
               <div className="mx-auto w-24 h-24 bg-blue-100 text-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-inner"><Calculator className="h-12 w-12" /></div>
               <div className="space-y-2">
                  <h2 className="text-3xl font-black font-headline text-blue-900">{isRtl ? 'الميزانية قيد التخصيص' : 'Budget Under Customization'}</h2>
                  <p className="text-blue-700/60 font-bold leading-relaxed">{isRtl ? 'يجب الانتهاء من ضبط الكميات والبنود في صفحة المقايسة والضغط على "اعتماد" لتفعيل المسار الفني وبدء العمل.' : 'Finalize quantities and items in the BOQ page and click "Approve" to activate the technical path and start site work.'}</p>
               </div>
               <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="h-16 px-12 rounded-2xl bg-blue-600 text-white font-black text-xl gap-3 shadow-xl">
                  <Pencil className="h-6 w-6" /> {isRtl ? 'تخصيص بنود المقايسة الآن' : 'Customize BOQ Items Now'}
               </Button>
            </div>
         </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
             <div className="space-y-6">
                <div className="flex justify-between items-end px-2">
                   <h3 className="text-xl font-black font-headline text-slate-800 flex items-center gap-2"><Workflow className="h-6 w-6 text-primary" /> {isRtl ? 'رادار المسار الميداني' : 'Field Pipeline'}</h3>
                   <span className="text-4xl font-black font-headline text-primary">{progressPercent}%</span>
                </div>
                <div className="space-y-4">
                   {stages.map((stage, idx) => {
                      const boqProgress = stageProgressMap[stage.technicalStageId];
                      const isPreviousCompleted = idx === 0 || stages[idx - 1].status === 'completed';
                      return (
                        <Card key={stage.id} onClick={() => setFilterStageId(filterStageId === stage.id ? null : stage.id!)} className={cn("border-0 shadow-lg rounded-[2.5rem] bg-white transition-all overflow-hidden border-s-8 cursor-pointer relative", stage.status === 'completed' ? 'border-s-emerald-500' : stage.status === 'in-progress' ? 'border-s-blue-500 ring-4 ring-blue-500/5' : isPreviousCompleted ? 'border-s-orange-300' : 'border-s-slate-100 opacity-50')}>
                          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                             <div className="flex items-center gap-6 flex-1 text-start">
                                <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-white")}>{stage.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : (idx + 1)}</div>
                                <div className="space-y-1 flex-1">
                                   <div className="flex items-center gap-2">
                                      <h4 className="font-black text-lg text-slate-900 tracking-tight">{stage.name}</h4>
                                      {stage.isTemporary && <Badge className="bg-blue-100 text-blue-600 border-0 text-[7px] font-black uppercase h-4 px-1.5">MANUAL STAGE</Badge>}
                                   </div>
                                   {boqProgress && boqProgress.linkedItemsCount > 0 && (
                                     <div className="mt-2 space-y-1.5"><div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>{isRtl ? 'إنجاز بنود المقايسة' : 'BOQ Items Progress'}</span><span>{boqProgress.progressPercent}%</span></div><Progress value={boqProgress.progressPercent} className="h-1.5" /></div>
                                   )}
                                </div>
                             </div>
                             <div className="flex gap-2 shrink-0 z-10" onClick={e => e.stopPropagation()}>
                                {stage.status === 'in-progress' && editAccess.can && <Button onClick={() => { setTargetStage(stage); setIsRecordOpen(true); }} variant="outline" className="h-11 px-4 rounded-xl border-2 border-primary/20 text-primary font-black text-xs gap-2"><Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز' : 'Log Progress'}</Button>}
                                {stage.status === 'pending' && isPreviousCompleted && <Button onClick={() => handleStartStage(stage.id!)} disabled={!!processingId} className="h-11 px-6 rounded-xl bg-blue-600 text-white font-black text-xs gap-2">{processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />} {isRtl ? 'بدء' : 'Start'}</Button>}
                                {stage.status === 'in-progress' && <Button onClick={() => handleCompleteStage(stage)} disabled={!!processingId} className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-black text-xs gap-2">{processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />} {isRtl ? 'إكمال' : 'Complete'}</Button>}
                                {stage.status === 'completed' && isAdmin && <Button variant="ghost" onClick={() => setUndoStage(stage)} className="h-11 w-11 p-0 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50"><RotateCcw className="h-5 w-5" /></Button>}
                             </div>
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

      {/* Record Progress Dialog */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
         <DialogContent className="rounded-2xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-md ring-1 ring-black/5" dir={dir}>
            <div className="bg-slate-900 p-6 text-white text-start">
               <DialogTitle className="text-xl font-black font-headline flex items-center gap-3">
                  <Hammer className="h-6 w-6 text-primary" />
                  {isRtl ? 'تسجيل إنجاز فني' : 'Log Technical Progress'}
               </DialogTitle>
               <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{targetStage?.name}</p>
            </div>

            <div className="p-6 space-y-6 text-start">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'بند العمل الميداني' : 'Target Work Item'}</Label>
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                     <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-slate-50/50">
                        <SelectValue placeholder={isRtl ? "اختر البند المنجز..." : "Select work item..."} />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl border-0 shadow-2xl">
                        {boqItems?.filter(i => (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(targetStage?.technicalStageId!) || i.technicalStageId === targetStage?.technicalStageId))
                          .map(i => <SelectItem key={i.id} value={i.id!} className="font-bold py-3 text-xs border-b last:border-0 border-slate-50">{i.referenceTitle}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>

               {selectedBOQItemMetrics && (
                  <div className="grid grid-cols-3 gap-3 animate-in zoom-in-95">
                     <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <span className="text-[8px] font-black text-slate-400 block uppercase">Planned</span>
                        <span className="text-sm font-black text-slate-800">{selectedBOQItemMetrics.planned}</span>
                     </div>
                     <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-center">
                        <span className="text-[8px] font-black text-emerald-600 block uppercase">Done</span>
                        <span className="text-sm font-black text-emerald-600">{selectedBOQItemMetrics.executed}</span>
                     </div>
                     <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 text-center">
                        <span className="text-[8px] font-black text-orange-600 block uppercase">Balance</span>
                        <span className="text-sm font-black text-orange-600">{selectedBOQItemMetrics.remaining}</span>
                     </div>
                  </div>
               )}

               {selectedBOQItemMetrics?.isExceeded && (
                  <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-xl flex items-start gap-3 text-rose-800 animate-pulse">
                     <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                     <div className="text-[10px] font-black uppercase leading-relaxed">
                        {isRtl 
                          ? 'تنبيه: لقد تم إنجاز الكمية المخططة لهذا البند بالكامل (100%). أي تسجيل إضافي سيخلق انحرافاً في الميزانية.' 
                          : 'Warning: Planned quantity for this item is fully executed (100%). Further logs will create a budget variance.'}
                     </div>
                  </div>
               )}

               <div className="space-y-5 pt-2">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                     <div className="space-y-0.5">
                        <Label className="font-black text-xs uppercase tracking-tighter">{isRtl ? 'إنجاز تكميلي' : 'Complementary Log'}</Label>
                        <p className="text-[8px] text-slate-400 font-bold">تسجيل ملاحظة بدون كمية</p>
                     </div>
                     <Switch checked={isComplementary} onCheckedChange={setIsComplementary} />
                  </div>

                  {!isComplementary && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الكمية المنفذة حالياً' : 'Quantity Executed'}</Label>
                       <div className="relative">
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={progressQty} 
                            onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} 
                            className={cn(
                                "h-14 rounded-xl border-2 font-black text-2xl text-center shadow-inner",
                                selectedBOQItemMetrics && Number(progressQty) > selectedBOQItemMetrics.remaining ? "border-rose-500 text-rose-600 bg-rose-50" : "border-slate-200"
                            )} 
                            placeholder="..."
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">{selectedBOQItemMetrics?.unit}</div>
                       </div>
                       {selectedBOQItemMetrics && Number(progressQty) > selectedBOQItemMetrics.remaining && (
                          <p className="text-[9px] font-black text-rose-600 uppercase text-center mt-1">Sovereign Warning: Over-Execution Detected</p>
                       )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تقرير ميداني مصغر' : 'Field Notes'}</Label>
                     <Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-xl bg-slate-50/50 border-2 resize-none p-4 text-xs font-bold" placeholder="..." />
                  </div>
               </div>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-12 rounded-xl font-bold">إلغاء</Button>
               <Button 
                onClick={() => handleRecordProgress()} 
                disabled={loadingAction === 'recording' || (!isComplementary && (progressQty === "" || Number(progressQty) <= 0)) || !selectedItemId} 
                className="flex-[2] h-12 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 transition-all gap-2 border-b-4 border-orange-700"
               >
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isRtl ? 'حفظ السجل' : 'Log Now'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Exceptional Over-Execution Sovereign Guard */}
      <AlertDialog open={isOverExecutionOpen} onOpenChange={setIsOverExecutionOpen}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
           <AlertDialogHeader>
              <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                 <ShieldX className="h-10 w-10" />
              </div>
              <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">تحذير: تجاوز الكمية المخططة</AlertDialogTitle>
              <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                 {isRtl 
                   ? `أنت تحاول تسجيل كمية (${progressQty}) تتجاوز الكمية المتبقية المخططة لهذا البند. هذا الإجراء سيؤدي لانحراف مالي في الميزانية (Positive Variance). هل ترغب في الاستمرار كتجاوز استثنائي؟` 
                   : `You are recording a quantity (${progressQty}) that exceeds the remaining planned amount. This will create a positive financial variance. Do you want to proceed as an exceptional over-execution?`}
              </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
              <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.preventDefault(); // Prevents Radix from closing before we are ready
                  handleRecordProgress(true);
                }}
                className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
              >
                 {isRtl ? 'نعم، أقر بالتجاوز واحفظ' : 'Confirm Over-Execution'}
              </AlertDialogAction>
           </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen Stage Dialog (Reversal Protocol) */}
      <Dialog open={!!undoStage} onOpenChange={(open) => !open && setUndoStage(null)}>
         <DialogContent className="rounded-2xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-md ring-1 ring-black/5" dir={dir}>
            <div className="bg-rose-600 p-8 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <RotateCcw className="h-7 w-7" />
                  {isRtl ? 'بروتوكول التراجع عن الإنجاز' : 'Stage Reversal Protocol'}
               </DialogTitle>
               <p className="text-white/70 font-bold mt-2">{isRtl ? `إعادة فتح: ${undoStage?.name}` : `Reopening: ${undoStage?.name}`}</p>
            </div>
            
            <div className="p-8 space-y-6 text-start bg-white">
               <div className="p-6 rounded-[2rem] bg-rose-50 border-2 border-rose-100 flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-1" />
                  <div className="space-y-1">
                     <h5 className="font-black text-rose-900 text-sm">{isRtl ? 'إشعار تصفير البيانات' : 'Data Reset Notice'}</h5>
                     <p className="text-[10px] text-rose-700 font-bold leading-relaxed">
                        {isRtl ? 'إعادة فتح المرحلة سيؤدي لإعادتها لحالة "قيد التنفيذ". يرجى تحديد ما إذا كنت ترغب في إلغاء سجلات الإنجاز الميداني المرتبطة بها والبدء من جديد.' : 'Reopening will return the stage to "In-Progress". Choose if you want to invalidate all current logs and reset quantities.'}
                     </p>
                  </div>
               </div>

               <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border-2">
                  <div className="space-y-0.5">
                     <Label className="font-black text-xs uppercase tracking-tighter text-rose-600">{isRtl ? 'تطهير سجلات الإنجاز' : 'Purge Field Logs'}</Label>
                     <p className="text-[8px] text-slate-400 font-bold">أرشفة كافة سجلات الكميات والتعليقات</p>
                  </div>
                  <Switch checked={clearLogsOnUndo} onCheckedChange={setClearLogsOnUndo} />
               </div>

               <Button 
                onClick={handleReopenStage} 
                disabled={!!processingId} 
                className="w-full h-16 rounded-2xl bg-rose-600 text-white font-black text-xl shadow-xl shadow-rose-200 border-b-8 border-rose-800 hover:bg-rose-700"
               >
                  {processingId === undoStage?.id ? <Loader2 className="animate-spin h-6 w-6" /> : <RotateCw className="h-6 w-6" />}
                  {isRtl ? 'تأكيد إعادة الفتح' : 'Confirm Reopen'}
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* Exceptional Closure Dialog */}
      <Dialog open={!!incompleteStage} onOpenChange={(open) => !open && setIncompleteStage(null)}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
           <div className="bg-amber-500 p-8 text-white text-start">
              <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                 <ShieldAlert className="h-8 w-8" />
                 {isRtl ? 'تحذير: إنجاز غير مكتمل' : 'Incomplete Progress Warning'}
              </DialogTitle>
           </div>
           <div className="p-8 space-y-6 text-start">
              <p className="font-bold text-slate-600 leading-relaxed">
                 {isRtl 
                   ? `المرحلة "${incompleteStage?.stage.name}" لم تكتمل بنسبة 100% بعد (الإنجاز الحالي: ${incompleteStage?.progress.progressPercent}%).` 
                   : `The stage "${incompleteStage?.stage.name}" is not 100% complete (Current: ${incompleteStage?.progress.progressPercent}%).`}
              </p>
              <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-100 flex items-start gap-4">
                 <Info className="h-5 w-5 text-amber-600 shrink-0 mt-1" />
                 <p className="text-[10px] text-amber-800 font-bold italic">{incompleteStage?.progress.reason}</p>
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'هل ترغب في تجاوز الرقابة وإغلاق المرحلة إجبارياً؟' : 'Do you want to override guard and force close?'}</p>
           </div>
           <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3">
              <Button variant="outline" onClick={() => setIncompleteStage(null)} className="flex-1 h-14 rounded-xl border-2 font-bold">إلغاء</Button>
              {isAdmin && (
                <Button onClick={() => handleCompleteStage(incompleteStage!.stage, true)} className="flex-[2] h-14 rounded-xl bg-slate-900 text-white font-black shadow-xl">
                   {isRtl ? 'إغلاق استثنائي (تجاوز)' : 'Exceptional Closure'}
                </Button>
              )}
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50"><Trash2 className="h-10 w-10" /></div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900">{isRtl ? 'حذف المقايسة تماماً؟' : 'Permanent BOQ Delete?'}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">{isRtl ? 'سيتم حذف كافة البنود وسجلات التنفيذ للبدء من جديد.' : 'All items and execution logs will be removed to start over.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteBOQ} 
              disabled={isDeletingBOQ} 
              className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
            >
              {isDeletingBOQ ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!namingTemplate} onOpenChange={(open) => !open && setNamingTemplate(null)}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
            <div className="bg-primary/5 p-8 text-slate-900 text-start border-b">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3"><Pencil className="h-7 w-7 text-primary" />{isRtl ? 'تأكيد مسمى المقايسة' : 'Confirm Name'}</DialogTitle>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="space-y-3"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المسمى المختار' : 'Target BOQ Name'}</Label><Input value={customBOQName} onChange={e => setCustomBOQName(e.target.value)} className="h-14 rounded-2xl border-2 font-black text-lg focus:border-primary/50 transition-all shadow-inner" /></div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3"><Button variant="outline" onClick={() => setNamingTemplate(null)} className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">إلغاء</Button><Button onClick={handleConfirmLinkBOQ} disabled={processingId === 'linking_boq' || !customBOQName.trim()} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-2 border-b-8 border-orange-700">{processingId === 'linking_boq' ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}{isRtl ? 'اعتماد وإنشاء' : 'Confirm'}</Button></DialogFooter>
         </DialogContent>
      </Dialog>

      {activeBoq && <VOManagerDialog isOpen={isVOOpen} onClose={() => setIsVOOpen(false)} boqId={activeBoq.id} transactionId={transactionId} boqNumber={activeBoq.boqNumber} boqItems={boqItems || []} />}
    </div>
  );
}
