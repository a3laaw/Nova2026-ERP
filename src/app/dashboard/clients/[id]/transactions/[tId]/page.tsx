'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  FileText,
  Workflow,
  PlusCircle,
  ArrowRight,
  Trash2,
  Pencil,
  Info,
  Calculator,
  ShieldAlert,
  Sparkles,
  XCircle
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
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [filterStageId, setFilterStageId] = useState<string | null>(null);
  const [activeTabOverride, setActiveTabOverride] = useState<'active' | 'timeline' | 'chat_archive' | 'time_archive' | undefined>(undefined);
  
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isComplementary, setIsComplementary] = useState(false);
  const [targetStage, setTargetStage] = useState<StageInstance | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number>(0);
  const [progressNotes, setProgressNotes] = useState("");

  const [undoStage, setUndoStage] = useState<StageInstance | null>(null);
  const [clearLogsOnUndo, setClearLogsOnUndo] = useState(false);

  // States for Incomplete Stage Warning (Sovereign Centered Dialog)
  const [incompleteStage, setIncompleteStage] = useState<{ stage: StageInstance, progress: StageProgressResult } | null>(null);

  // States for VO
  const [isVOOpen, setIsVOOpen] = useState(false);

  // States for Naming and Linking BOQ
  const [namingTemplate, setNamingTemplate] = useState<BOQTemplate | null>(null);
  const [customBOQName, setCustomBOQName] = useState("");
  const [isDeletingBOQ, setIsDeletingBOQ] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const editAccess = check('projects', 'edit');

  const currentUserName = useMemo(() => {
    return globalUser?.username || user?.displayName || user?.email?.split('@')[0] || 'Admin';
  }, [globalUser, user]);

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
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs && boqs.length > 0 ? boqs[0] : null;

  const templatesQuery = useMemo(() => 
    companyId && db && transaction ? query(
        collection(db, paths.boqTemplates(companyId)), 
        where('subServiceId', '==', transaction.subServiceId),
        where('isActive', '==', true)
    ) : null, 
  [db, companyId, transaction]);
  const { data: availableTemplates } = useCollection<BOQTemplate>(templatesQuery);

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

  // التعديل السيادي: فلترة المسار الفني لإخفاء المراحل الطارئة الفارغة
  const stages = useMemo(() => {
    if (!rawStages) return [];
    return [...rawStages]
      .filter(s => {
        // 1. دائماً نعرض المراحل الهندسية الأصلية أو المراحل التي تم البدء فيها/إنجازها
        if (!s.isTemporary && s.originType !== 'temporary_vo') return true;
        if (s.status !== 'pending') return true;

        // 2. بالنسبة للمراحل الطارئة المنتظرة: نخفيها إذا لم يعد يوجد أي بند نشط مرتبط بها
        // بند نشط يعني plannedQuantity > 0
        const hasActiveWork = boqItems?.some(item => 
          (item.technicalStageId === s.technicalStageId || item.technicalStageIds?.includes(s.technicalStageId)) 
          && (item.plannedQuantity || 0) > 0
        );

        return !!hasActiveWork;
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
      // تجاهل البنود الملغاة في نافذة تسجيل الإنجاز
      return (allowedIds.includes(sId) || primaryId === sId) && (item.plannedQuantity || 0) > 0;
    });
  }, [boqItems, targetStage]);

  // البند المختار حالياً في نافذة تسجيل الإنجاز
  const selectedItem = useMemo(() => boqItems?.find(i => i.id === selectedItemId), [boqItems, selectedItemId]);

  // Actions
  const handleInitiateLink = (template: BOQTemplate) => {
    setNamingTemplate(template);
    setCustomBOQName(`${template.name} - ${transaction?.transactionNumber || ''}`);
  };

  const handleConfirmLinkBOQ = async () => {
    if (!db || !companyId || !user || !transaction || !namingTemplate) return;
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
          name: customBOQName || namingTemplate.name
      }, user.uid, currentUserName);
      
      toast({ title: isRtl ? "تم ربط المقايسة بنجاح" : "BOQ Linked Successfully" });
      setNamingTemplate(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteBOQ = async () => {
    if (!activeBoq || !db || !companyId || !user) return;
    setIsDeletingBOQ(true);
    try {
      const docService = new DocumentService(db, companyId, permissions);
      await docService.deleteBOQ(activeBoq.id, transactionId, user.uid, currentUserName);
      toast({ title: isRtl ? "تم حذف المقايسة المربوطة" : "BOQ Deleted" });
      setShowDeleteConfirm(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setIsDeletingBOQ(false);
    }
  };

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try {
      await transactionService.startStage(transactionId, stageId, user.uid, currentUserName);
      toast({ title: isRtl ? "تم بدء العمل" : "Stage Started" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAdminActivation = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try {
      await transactionService.activateManualStageOverride(transactionId, stageId, user.uid, currentUserName);
      toast({ title: isRtl ? "تم الفتح الإداري الموازي" : "Admin Parallel Activation Done" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteStage = async (stage: StageInstance, force: boolean = false) => {
    if (!transactionService || !user || !stage.id) return;
    
    // 1. فحص الإنجاز المحلي قبل الاستدعاء لتجنب الخطأ المباشر (Toast) وفتح الـ Dialog بدلاً منه
    const progress = stageProgressMap[stage.technicalStageId];
    if (!force && progress && !progress.canComplete) {
       setIncompleteStage({ stage, progress });
       return;
    }

    setProcessingId(stage.id);
    try {
      await transactionService.completeStage(transactionId, stage.id, user.uid, currentUserName, force);
      toast({ title: isRtl ? "تم إنجاز المرحلة بنجاح" : "Stage Completed" });
      setIncompleteStage(null);
    } catch (e: any) {
      //Fallback handle error
      toast({ variant: "destructive", title: isRtl ? "تعذر إغلاق المرحلة" : "Cannot Close Stage", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmedUndo = async () => {
    if (!transactionService || !user || !undoStage?.id) return;
    setProcessingId(undoStage.id);
    try {
      await transactionService.reopenStage(transactionId, undoStage.id, user.uid, currentUserName, clearLogsOnUndo);
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
        currentUserName,
        progressNotes,
        targetStage.id 
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

  const handleStageCommentClick = (stage: StageInstance) => {
    setFilterStageId(stage.id!);
    setActiveTabOverride('active');
    setTimeout(() => setActiveTabOverride(undefined), 100);
  };

  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!transaction) return <div className="p-20 text-center font-black text-slate-400">{isRtl ? 'المعاملة غير موجودة' : 'Transaction not found'}</div>;

  const currentFilteredStage = stages.find(s => s.id === filterStageId);
  const isAnyStageInProgress = stages.some(s => s.status === 'in-progress' && !s.isTemporary);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
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
           {activeBoq && (
             <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsVOOpen(true)}
                  className="h-11 px-5 rounded-xl bg-white border-2 font-black text-xs gap-2 text-blue-600 border-blue-100 shadow-sm hover:bg-blue-50"
                >
                   <Calculator className="h-4 w-4" /> {isRtl ? 'أمر تغييري' : 'VO'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="h-11 px-6 rounded-xl bg-white border-2 font-black text-xs gap-2 text-primary border-primary/20 shadow-sm">
                   <FileSpreadsheet className="h-4 w-4" /> {isRtl ? 'تتبع إنجاز المقايسة' : 'BOQ Progress'}
                </Button>
                {isAdmin && (
                   <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)} className="h-11 w-11 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 border-2 border-transparent hover:border-rose-100">
                      <Trash2 className="h-5 w-5" />
                   </Button>
                )}
             </div>
           )}
        </div>
      </div>

      {!activeBoq && !boqLoading ? (
         <Card className="border-4 border-dashed border-primary/20 rounded-[3rem] bg-white shadow-2xl p-12 text-center animate-in zoom-in-95">
            <div className="max-w-2xl mx-auto space-y-8">
               <div className="mx-auto w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center shadow-inner">
                  <FileSpreadsheet className="h-12 w-12" />
               </div>
               <div className="space-y-2">
                  <h2 className="text-3xl font-black font-headline">{isRtl ? 'ربط المقايسة الفنية' : 'Link Technical BOQ'}</h2>
                  <p className="text-slate-500 font-bold leading-relaxed">
                     {isRtl ? 'يجب اختيار قالب المقايسة المناسب لهذا المسار الفني للبدء في تتبع التكاليف والإنجاز الميداني.' : 'Select the appropriate BOQ template for this technical path to start cost and progress tracking.'}
                  </p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableTemplates && availableTemplates.length > 0 ? (
                    availableTemplates.map(temp => (
                      <Card key={temp.id} className="border-2 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer rounded-3xl p-6 text-start group" onClick={() => handleInitiateLink(temp)}>
                         <div className="flex items-center justify-between mb-4">
                            <Badge variant="outline" className="font-black text-[9px] px-3">{temp.code}</Badge>
                            <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                               <PlusCircle className="h-4 w-4" />
                            </div>
                         </div>
                         <h4 className="font-black text-slate-800">{temp.name}</h4>
                         <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">EST. VALUE: {temp.baseAmount?.toLocaleString()} KWD</p>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full p-10 bg-slate-50 rounded-3xl border-2 border-dashed flex flex-col items-center gap-3">
                       <AlertTriangle className="h-8 w-8 text-amber-500" />
                       <p className="text-sm font-bold text-slate-500">{isRtl ? 'لا توجد قوالب معرّفة لهذا المسار حالياً.' : 'No templates found for this path.'}</p>
                       <Button variant="link" onClick={() => router.push('/dashboard/settings/templates/boq')} className="text-primary font-black">إدارة مكتبة القوالب</Button>
                    </div>
                  )}
               </div>
            </div>
         </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                      const isTemporary = stage.isTemporary || stage.originType === 'temporary_vo';

                      return (
                        <Card 
                          key={stage.id} 
                          onClick={() => setFilterStageId(isSelected ? null : stage.id!)}
                          className={cn(
                            "border-0 shadow-lg rounded-[2.5rem] bg-white transition-all overflow-hidden border-s-8 cursor-pointer relative group",
                            stage.status === 'completed' ? 'border-s-emerald-500' : 
                            stage.status === 'in-progress' ? 'border-s-blue-500 ring-4 ring-blue-500/5' : 
                            isPreviousCompleted ? 'border-s-orange-300' : 'border-s-slate-100 opacity-50',
                            isSelected && "ring-4 ring-primary shadow-2xl scale-[1.01]",
                            isTemporary && "ring-1 ring-blue-200"
                          )}
                        >
                          <CardContent className="p-0">
                             <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-6 flex-1 text-start">
                                   <div className={cn(
                                     "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border transition-all", 
                                     stage.status === 'completed' ? "bg-emerald-50 text-white" : 
                                     isTemporary ? "bg-blue-50 text-blue-600 border-blue-100" :
                                     !isPreviousCompleted ? "bg-slate-50 text-slate-300" : 
                                     "bg-white group-hover:bg-primary/5"
                                   )}>
                                      {stage.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : 
                                       isTemporary ? <Zap className="h-6 w-6" /> : (idx + 1)}
                                   </div>
                                   <div className="space-y-1 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                         <h4 className="font-black text-lg text-slate-900 tracking-tight">{stage.name}</h4>
                                         {!isPreviousCompleted && stage.status !== 'completed' && <Lock className="h-3 w-3 text-slate-300" />}
                                         {isSelected && <Target className="h-3.5 w-3.5 text-primary animate-pulse" />}
                                         {isTemporary && (
                                           <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] font-black h-5 px-2 uppercase flex items-center gap-1 shadow-sm">
                                             <Sparkles className="h-2.5 w-2.5" /> {isRtl ? 'مرحلة طارئة' : 'Local Stage'}
                                           </Badge>
                                         )}
                                         {stage.isManuallyActivated && (
                                           <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-200 border-0 text-[8px] font-black h-5 px-2 uppercase shadow-sm">
                                              <ShieldAlert className="h-2.5 w-2.5" /> {isRtl ? 'استثناء إداري' : 'Admin Override'}
                                           </Badge>
                                         )}
                                      </div>
                                      
                                      {stage.createdFromVO && (
                                         <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Calculator className="h-2.5 w-2.5" /> {isRtl ? 'أضيفت من أمر تغييري' : 'Injected from VO'}
                                         </p>
                                      )}

                                      {(stage.status === 'completed' || stage.status === 'in-progress') && stage.startedAt && (
                                         <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                                            <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Start: {stage.startedAt?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            {stage.completedAt && (
                                              <>
                                                <ArrowRight className="h-2 w-2" />
                                                <span className="flex items-center gap-1 text-emerald-600"><Check className="h-2.5 w-2.5" /> End: {stage.completedAt?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                              </>
                                            )}
                                         </div>
                                      )}
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
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleStageCommentClick(stage); }}
                                     className="h-11 px-4 rounded-xl text-slate-400 hover:text-primary font-black text-[10px] gap-2 hover:bg-primary/5 flex items-center"
                                   >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      {isRtl ? 'تعليق' : 'Comment'}
                                   </button>
                                   {stage.status === 'completed' && editAccess.can && (
                                      <button 
                                        onClick={() => setUndoStage(stage)} 
                                        disabled={processingId === stage.id}
                                        className="h-11 px-4 rounded-xl text-slate-400 hover:text-rose-600 font-black text-[10px] gap-2 flex items-center"
                                      >
                                         {processingId === stage.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                         {isRtl ? 'تراجع' : 'Undo'}
                                      </button>
                                   )}
                                   {stage.status === 'in-progress' && editAccess.can && (
                                      <Button onClick={() => { setTargetStage(stage); setIsRecordOpen(true); }} variant="outline" className="h-11 px-4 rounded-xl border-2 border-primary/20 text-primary font-black text-xs gap-2 hover:bg-primary/5">
                                         <Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز' : 'Log Progress'}
                                      </Button>
                                   )}
                                   
                                   {/* زر الفتح الاستثنائي للمدير فقط في المراحل الطارئة */}
                                   {isAdmin && isTemporary && stage.status === 'pending' && isAnyStageInProgress && (
                                      <Button 
                                        onClick={() => handleAdminActivation(stage.id!)} 
                                        disabled={processingId === stage.id} 
                                        variant="outline"
                                        className="h-11 px-4 rounded-xl border-2 border-amber-400 text-amber-600 font-black text-xs gap-2 hover:bg-amber-50"
                                      >
                                         {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                                         {isRtl ? 'فتح استثنائي' : 'Admin Open'}
                                      </Button>
                                   )}

                                   {stage.status === 'pending' && (isPreviousCompleted || (isAdmin && isTemporary)) && (
                                      <Button onClick={() => handleStartStage(stage.id!)} disabled={processingId === stage.id} className="h-11 px-6 rounded-xl bg-blue-600 text-white font-black text-xs gap-2">
                                         {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />} {isRtl ? 'بدء' : 'Start'}
                                      </Button>
                                   )}
                                   {stage.status === 'in-progress' && (
                                      <Button onClick={() => handleCompleteStage(stage)} disabled={processingId === stage.id} className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-black text-xs gap-2">
                                         {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />} {isRtl ? 'إكمال' : 'Complete'}
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
          <div className="lg:col-span-4">
             <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 flex flex-col h-full min-h-[700px]">
                <CardContent className="p-6 flex-1">
                   <CommentSection 
                      transactionId={transactionId} 
                      path={paths.transactionComments(companyId!, transactionId)} 
                      externalLogs={allExecutions || []}
                      boqItems={boqItems || []}
                      stages={stages || []}
                      filterStageId={filterStageId}
                      technicalStageId={currentFilteredStage?.technicalStageId}
                      selectedStageName={currentFilteredStage?.name}
                      onClearFilter={() => setFilterStageId(null)}
                      activeTabOverride={activeTabOverride}
                   />
                </CardContent>
             </Card>
          </div>
        </div>
      )}

      {/* Sovereign Centered Warning Dialog for Incomplete Stages */}
      <AlertDialog open={!!incompleteStage} onOpenChange={(open) => !open && setIncompleteStage(null)}>
         <AlertDialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-rose-600 p-8 text-white text-center space-y-4">
               <div className="mx-auto h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-white" />
               </div>
               <div className="space-y-1">
                  <AlertDialogTitle className="text-xl font-black font-headline">تعذر إغلاق المرحلة</AlertDialogTitle>
                  <p className="text-xs font-bold text-rose-100 opacity-90">لا يمكن إغلاق المرحلة قبل اكتمال 100% من البنود المرتبطة بها (المرحلة ما زالت تحتوي على كميات غير منفذة).</p>
               </div>
            </div>
            <div className="p-8 space-y-6">
               <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 space-y-4 text-start">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                     <span>المرحلة المستهدفة:</span>
                     <span className="text-slate-900">{incompleteStage?.stage.name}</span>
                  </div>
                  <div className="space-y-1.5">
                     <div className="flex justify-between text-11px font-black">
                        <span className="text-slate-500">نسبة الإنجاز الفعلية:</span>
                        <span className="text-rose-600">{incompleteStage?.progress.progressPercent}%</span>
                     </div>
                     <Progress value={incompleteStage?.progress.progressPercent} className="h-2 bg-slate-200" />
                  </div>
               </div>

               {isAdmin && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-start animate-in zoom-in-95">
                     <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                     <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                        بما أنك تملك صلاحيات "مدير النظام"، يمكنك اختيار **التخطي الإجباري** لإغلاق المرحلة لأسباب استثنائية، مع العلم أن هذا الإجراء سيتم توثيقه في السجل الزمني.
                     </p>
                  </div>
               )}
            </div>
            <AlertDialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3">
               <AlertDialogCancel className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">إلغاء</AlertDialogCancel>
               {isAdmin ? (
                  <Button 
                    onClick={() => incompleteStage && handleCompleteStage(incompleteStage.stage, true)}
                    disabled={!!processingId}
                    className="flex-[2] h-14 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm shadow-xl shadow-amber-200 border-b-4 border-amber-800 transition-all gap-2"
                  >
                     {processingId === incompleteStage?.stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                     تخطي وإغلاق إجباري
                  </Button>
               ) : (
                  <Button onClick={() => setIncompleteStage(null)} className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black">حسناً</Button>
               )}
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

      {/* Naming Dialog for linking BOQ */}
      <Dialog open={!!namingTemplate} onOpenChange={(open) => !open && setNamingTemplate(null)}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
            <div className="bg-primary/5 p-8 text-slate-900 text-start border-b">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <Pencil className="h-7 w-7 text-primary" />
                  {isRtl ? 'تأكيد مسمى المقايسة' : 'Confirm BOQ Name'}
               </DialogTitle>
               <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">{isRtl ? 'اقتراح مسمى جديد لتمييز هذا المستند' : 'Suggest a unique name for this record'}</p>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'مسمى المقايسة الجاري إنشاؤها' : 'Target BOQ Name'}</Label>
                  <Input 
                    value={customBOQName} 
                    onChange={e => setCustomBOQName(e.target.value)} 
                    className="h-14 rounded-2xl border-2 font-black text-lg focus:border-primary/50 transition-all shadow-inner"
                    placeholder={isRtl ? "مثلاً: مقايسة البناء - فيلا جابر" : "e.g. Construction BOQ - Villa Jabir"}
                  />
               </div>
               <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-100 flex items-start gap-4">
                  <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                     {isRtl ? 'سيتم استخدام هذا المسمى في كافة التقارير والمراجعات الميدانية لاحقاً.' : 'This name will be used across all reports and field audits.'}
                  </p>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setNamingTemplate(null)} className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">إلغاء</Button>
               <Button onClick={handleConfirmLinkBOQ} disabled={processingId === 'linking_boq' || !customBOQName.trim()} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-2 border-b-8 border-orange-700">
                  {processingId === 'linking_boq' ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                  {isRtl ? 'اعتماد وإنشاء' : 'Confirm & Create'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Delete BOQ Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                <AlertTriangle className="h-10 w-10" />
             </div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900">{isRtl ? 'حذف المقايسة تماماً؟' : 'Permanent BOQ Delete?'}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                {isRtl 
                  ? 'سيتم حذف كافة بنود المقايسة وسجلات الإنجاز الميداني المرتبطة بها نهائياً لتتمكن من الربط مجدداً "على نظافة". لا يمكن التراجع عن هذا الإجراء.' 
                  : 'All BOQ items and field execution logs will be permanently removed so you can start fresh. This cannot be undone.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteBOQ} 
              disabled={isDeletingBOQ}
              className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
            >
               {isDeletingBOQ ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف المقايسة' : 'Confirm Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Record Progress Dialog - المحدث والمحسن */}
      <Dialog open={isRecordOpen} onOpenChange={(open) => { if(!open) { setIsRecordOpen(false); setIsComplementary(false); } }}>
         <DialogContent className="rounded-[2rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
            <div className="bg-primary/5 p-6 text-slate-900 text-start border-b flex justify-between items-center">
               <div>
                  <DialogTitle className="text-xl font-black font-headline flex items-center gap-2">
                     <Hammer className="h-6 w-6 text-primary" />
                     {isRtl ? 'تسجيل إنجاز ميداني' : 'Record Site Progress'}
                  </DialogTitle>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-70">{targetStage?.name}</p>
               </div>
            </div>
            <div className="p-6 space-y-6 text-start">
               {!activeBoq ? (
                  <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-slate-50">
                    <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                    <p className="font-black text-xs text-slate-600">{isRtl ? "لا توجد مقايسة مرتبطة" : "No BOQ linked"}</p>
                  </div>
               ) : (
                 <>
                    {/* التبديل بين الإجراء المكمل والكمية */}
                    <div className="p-4 rounded-xl bg-blue-50/30 border border-blue-100 flex items-center justify-between group transition-all">
                       <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all", isComplementary ? "bg-blue-600 text-white" : "bg-white text-blue-400 border")}>
                             <Zap className="h-4 w-4" />
                          </div>
                          <div className="text-start">
                             <Label className="font-black text-xs text-blue-900">{isRtl ? "تأكيد فني (بدون كمية)" : "Technical Check"}</Label>
                             <p className="text-[8px] font-bold text-blue-600/60 uppercase">{isRtl ? "إجراء مكمل لا يؤثر على الأرقام" : "Complementary Step"}</p>
                          </div>
                       </div>
                       <Switch checked={isComplementary} onCheckedChange={(v) => { setIsComplementary(v); if(v) setProgressQty(0); }} />
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? "بند المقايسة المستهدف" : "Target Work Item"}</Label>
                       <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                          <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white focus:ring-0">
                             <SelectValue placeholder="..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-2 shadow-2xl">
                             {filteredItemsForStage.map(item => (
                               <SelectItem key={item.id} value={item.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                                  <div className="flex flex-col text-start gap-0.5">
                                     <span>{item.referenceTitle}</span>
                                     <span className="text-[8px] text-slate-400 font-black uppercase">{item.referenceCode} | {isRtl ? 'المخطط:' : 'Plan:'} {item.plannedQuantity} {item.unitSymbol}</span>
                                  </div>
                               </SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>

                    {/* عرض الكميات (رادار التذكير الميداني) */}
                    {selectedItem && (
                      <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center shadow-sm">
                           <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{isRtl ? "المخطط" : "Planned"}</p>
                           <p className="text-sm font-black text-slate-700">{selectedItem.plannedQuantity} <span className="text-[9px] opacity-40">{selectedItem.unitSymbol}</span></p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center shadow-sm">
                           <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{isRtl ? "المنجز" : "Executed"}</p>
                           <p className="text-sm font-black text-blue-600">{selectedItem.executedQuantity} <span className="text-[9px] opacity-40">{selectedItem.unitSymbol}</span></p>
                        </div>
                        <div className={cn(
                          "p-3 rounded-xl border text-center shadow-md", 
                          (selectedItem.plannedQuantity - selectedItem.executedQuantity) > 0 ? "bg-orange-50 border-orange-200" : "bg-emerald-50 border-emerald-200"
                        )}>
                           <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{isRtl ? "المتبقي" : "Balance"}</p>
                           <p className={cn("text-sm font-black", (selectedItem.plannedQuantity - selectedItem.executedQuantity) > 0 ? "text-orange-600" : "text-emerald-600")}>
                              {Math.max(0, selectedItem.plannedQuantity - selectedItem.executedQuantity)} <span className="text-[9px] opacity-40">{selectedItem.unitSymbol}</span>
                           </p>
                        </div>
                      </div>
                    )}

                    {!isComplementary && (
                      <div className="space-y-2 animate-in slide-in-from-top-2">
                         <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? "الكمية المنفذة الآن" : "Current Executed Qty"}</Label>
                         <div className="relative">
                            <input 
                              type="number" 
                              value={progressQty || ''} 
                              onChange={e => setProgressQty(Number(e.target.value))} 
                              className="h-14 w-full rounded-xl border-2 border-primary/20 font-black text-2xl text-primary text-center outline-none focus:border-primary transition-all bg-slate-50/50" 
                              placeholder="0" 
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">
                               {selectedItem?.unitSymbol || 'QTY'}
                            </div>
                         </div>
                      </div>
                    )}

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? "ملاحظات وتوثيق التنفيذ" : "Execution Documentation"}</Label>
                       <Textarea 
                         value={progressNotes} 
                         onChange={e => setProgressNotes(e.target.value)} 
                         className="min-h-[80px] rounded-xl border-2 bg-slate-50/30 p-4 text-xs font-bold focus:bg-white transition-all shadow-inner resize-none" 
                         placeholder={isRtl ? "اكتب تفاصيل الموقع أو أسباب الانحراف..." : "Site details or deviation notes..."} 
                       />
                    </div>
                 </>
               )}
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-12 rounded-xl border-2 font-bold bg-white text-slate-500">إلغاء</Button>
               <Button 
                 onClick={handleRecordProgress} 
                 disabled={!activeBoq || !selectedItemId || (progressQty <= 0 && !isComplementary) || processingId === 'recording'} 
                 className={cn(
                   "flex-[2] h-12 rounded-xl font-black text-sm shadow-lg gap-2 border-b-4 transition-all", 
                   isComplementary ? "bg-blue-600 text-white border-blue-800" : "bg-primary text-white border-orange-700"
                 )}
               >
                  {processingId === 'recording' ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isComplementary ? (isRtl ? "تأكيد الإجراء" : "Confirm Step") : (isRtl ? "تسجيل الإنجاز" : "Record Progress")}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Undo Stage Alert */}
      <AlertDialog open={!!undoStage} onOpenChange={(open) => !open && setUndoStage(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-lg" dir={dir}>
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
                         {isRtl ? 'سيتم إعادة قفل المرحلة التالية (إذا بدأت) لضمان سلامة مسار العمل. سيتم نقل تعليقات المرحلة الحالية للأرشيف.' : 'Next stage will be locked. Current stage comments will be moved to Archive.'}
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

      {/* VO Manager Component */}
      {activeBoq && (
        <VOManagerDialog 
          isOpen={isVOOpen}
          onClose={() => setIsVOOpen(false)}
          boqId={activeBoq.id}
          transactionId={transactionId}
          boqNumber={activeBoq.boqNumber}
          boqItems={boqItems || []}
        />
      )}
    </div>
  );
}
