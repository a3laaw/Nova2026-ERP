
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, Clock, Loader2, 
  CheckCircle2, Play, Check,
  FileSpreadsheet, Calculator,
  Hammer, Save, AlertTriangle,
  Zap, Workflow,
  PlusCircle, ArrowRight,
  Info, Sparkles, FilePlus, ShieldCheck,
  Pencil, FileText, LayoutGrid, Lock, Wallet,
  Gavel, Receipt, Trash2, RotateCcw,
  PencilLine, History as HistoryIcon,
  ChevronRight,
  ShieldAlert
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, orderBy, where, limit, doc, addDoc, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
import { BOQ, BOQItem, BOQItemExecutionEntry, Contract } from '@/types/documents';
import { BOQTemplate } from '@/types/templates';
import { CommentSection } from '@/components/transactions/comment-section';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TransactionDocumentsView } from '@/components/transactions/transaction-documents-view';
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
import { VOManagerDialog } from '@/components/transactions/vo-manager-dialog';

export default function TransactionDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.id as string;
  const transactionId = params.tId as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions, isAdmin, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'pipeline');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [filterStageId, setFilterStageId] = useState<string | null>(null);
  
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<StageInstance | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number | "">(""); 
  const [progressNotes, setProgressNotes] = useState("");

  const [isBoqInitOpen, setIsBoqInitOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [incompleteStage, setIncompleteStage] = useState<{ stage: StageInstance, progress: StageProgressResult } | null>(null);
  const [isVOOpen, setIsVOOpen] = useState(false);

  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionStage, setRevisionStage] = useState<StageInstance | null>(null);
  const [revisionComment, setRevisionComment] = useState("");

  const editAccess = check('projects', 'edit');
  const canSeeFinance = check('accounting', 'view').can || check('procurement', 'view').can;

  const currentUserName = useMemo(() => {
    return globalUser?.fullName || user?.displayName || globalUser?.username || 'مهندس غير معرف';
  }, [globalUser, user]);

  const transRef = useMemo(() => (companyId && db && transactionId) ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  const contractsQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.contracts(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: contracts, loading: contractsLoading } = useCollection<Contract>(contractsQuery);
  
  const activeContract = useMemo(() => 
    contracts?.find(c => ['approved', 'paid', 'active', 'signed'].includes(c.status || '') || c.isPaid),
  [contracts]);
  
  const isFinancialLockActive = !activeContract;

  // تحديد نوع المعاملة بدقة لفلترة الرادار
  const isConsulting = useMemo(() => {
    if (!transaction) return false;
    const name = transaction.activityTypeName || '';
    return name.includes('استشارات') || name.includes('Consulting') || name.includes('تصميم') || name.includes('Design');
  }, [transaction]);

  const stagesQuery = useMemo(() => 
    (companyId && db && transactionId) ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order', 'asc')) : null, 
  [db, companyId, transactionId]);

  const { data: rawStages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId), limit(1)) : null, [db, companyId, transactionId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const templatesQuery = useMemo(() => {
    if (!companyId || !db || !transaction?.subServiceId) return null;
    return query(collection(db, paths.boqTemplates(companyId)), where('subServiceId', '==', transaction.subServiceId));
  }, [db, companyId, transaction?.subServiceId]);
  const { data: templates } = useCollection<BOQTemplate>(templatesQuery);

  const itemsQuery = useMemo(() => (companyId && db && activeBoq?.id) ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const executionsQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: allExecutions } = useCollection<BOQItemExecutionEntry>(executionsQuery);

  const stages = useMemo(() => {
    return (rawStages || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawStages]);

  const progressPercent = useMemo(() => {
    if (stages.length === 0) return 0;
    const completed = stages.filter(s => s.status === 'completed').length;
    return Math.round((completed / stages.length) * 100);
  }, [stages]);

  const executionService = useMemo(() => (db && companyId) ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);
  const transactionService = useMemo(() => (db && companyId) ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    let active = true;
    async function fetchAllProgress() {
      if (!executionService || !stages || stages.length === 0 || isConsulting) return;
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
  }, [executionService, stages, transactionId, allExecutions, isConsulting]);

  const handleCreateBOQ = async () => {
    if (!db || !companyId || !user || !selectedTemplateId || !transaction) return;
    setLoadingAction('creating_boq');
    try {
      const service = new DocumentService(db, companyId, permissions);
      const template = templates?.find(t => t.id === selectedTemplateId);
      await service.instantiateBoqFromTemplate(
        selectedTemplateId,
        {
          transactionId, clientId, clientName: transaction.clientName,
          activityTypeId: transaction.activityTypeId, serviceId: transaction.serviceId,
          subServiceId: transaction.subServiceId, name: template?.name || ""
        },
        user.uid, currentUserName
      );
      toast({ title: isRtl ? "تم إنشاء المقايسة بنجاح" : "BOQ Created Successfully" });
      setIsBoqInitOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleManualInitialize = async () => {
    if (!transactionService || !transaction || !user) return;
    setLoadingAction('init');
    try {
      await transactionService.initializeTechnicalPath(transactionId, transaction.activityTypeId, transaction.serviceId, transaction.subServiceId, user.uid);
      toast({ title: isRtl ? "تم تنشيط المسار الفني" : "Path Initialized" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try { 
      await transactionService.startStage(transactionId, stageId, user.uid, currentUserName, globalUser?.departmentId); 
      toast({ title: isRtl ? "تم بدء العمل" : "Stage Started" }); 
    } catch (e: any) { toast({ variant: "destructive", title: t('error'), description: e.message }); }
    finally { setProcessingId(null); }
  };

  const handleCompleteStage = async (stage: StageInstance, force: boolean = false) => {
    if (!transactionService || !user || !stage.id) return;
    if (!isConsulting && !force) {
      const progress = stageProgressMap[stage.technicalStageId];
      if (progress && !progress.canComplete) { setIncompleteStage({ stage, progress }); return; }
    }
    setProcessingId(stage.id);
    try { 
      await transactionService.completeStage(transactionId, stage.id, user.uid, currentUserName, globalUser?.departmentId, force); 
      toast({ title: isRtl ? "تم إنجاز المرحلة بنجاح" : "Stage Completed" }); 
      setIncompleteStage(null); 
    } catch (e: any) { toast({ variant: "destructive", title: isRtl ? "تعذر إغلاق المرحلة" : "Cannot Close", description: e.message }); }
    finally { setProcessingId(null); }
  };

  const handleOpenRevisionDialog = (stage: StageInstance) => {
     setRevisionStage(stage);
     setRevisionComment("");
     setIsRevisionOpen(true);
  };

  const handleConfirmRevision = async () => {
    if (!transactionService || !user || !revisionStage || !revisionComment.trim()) return;
    setProcessingId(`rev_${revisionStage.id}`);
    setIsRevisionOpen(false);
    try {
      await transactionService.incrementStageRevision(transactionId, revisionStage.id!, user.uid, currentUserName, revisionComment, globalUser?.departmentId);
      toast({ title: isRtl ? "تم تسجيل دورة مراجعة جديدة بنجاح" : "Revision Cycle Logged" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
      setRevisionStage(null);
    }
  };

  const handleReopenStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    if (!confirm(isRtl ? "تنبيه سيادي: إعادة فتح المرحلة سيجمد كافة المراحل اللاحقة لضمان دقة المسار. هل ترغب في المتابعة؟" : "Warning: Reopening will freeze subsequent stages. Continue?")) return;
    setProcessingId(stageId);
    try {
      await transactionService.reopenStage(transactionId, stageId, user.uid, currentUserName);
      toast({ title: isRtl ? "تم إعادة فتح المرحلة وتجميد المسار اللاحق" : "Stage Reopened & Path Frozen" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRecordProgress = (force: boolean = false) => {
    if (!executionService || !user || !targetStage || !selectedItemId) return;
    const qtyInput = progressQty === "" ? 0 : Number(progressQty);
    setIsRecordOpen(false);
    setLoadingAction('recording');
    setTimeout(async () => {
        try {
            await executionService.recordBOQItemExecution(activeBoq!.id, selectedItemId, targetStage.technicalStageId, qtyInput, user.uid, currentUserName, progressNotes, targetStage.id!, force);
            toast({ title: isRtl ? "تم تسجيل الإنجاز" : "Progress Logged" });
            setProgressQty(""); setProgressNotes(""); setSelectedItemId("");
        } catch (e: any) { toast({ variant: "destructive", title: t('error'), description: e.message }); }
        finally { setLoadingAction(null); }
    }, 100);
  };

  if (transLoading || stagesLoading || contractsLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4 text-start">
           <div className="h-11 px-4 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border-2 border-primary/20 shadow-inner">{transaction?.transactionNumber}</div>
           <div className="text-start">
              <h1 className="text-xl font-black text-slate-900 leading-none">{transaction?.subServiceName}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                 <Badge className={cn("font-black px-2 py-0.5 rounded-lg border-0 shadow-sm uppercase text-[8px]", transaction?.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{transaction?.status}</Badge>
                 <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Activity className="h-2.5 w-2.5 text-primary" /> {transaction?.activityTypeName}</span>
              </div>
           </div>
        </div>
        <div className="flex gap-2">
           {activeBoq && (
             <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="btn-gradient h-10 px-6 rounded-xl gap-2">
                <FileSpreadsheet className="h-4 w-4" /> {isRtl ? 'عرض المقايسة' : 'View BOQ'}
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white border-2 border-slate-100 p-1 rounded-xl h-14 w-full md:w-fit gap-2 shadow-sm mb-6">
                   <TabsTrigger value="pipeline" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                      <Workflow className="h-4 w-4" /> {isRtl ? 'رادار التنفيذ' : 'Technical Radar'}
                   </TabsTrigger>
                   {canSeeFinance && (
                     <TabsTrigger value="documents" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                        <Receipt className="h-4 w-4" /> {isRtl ? 'المستندات والمالية' : 'Financial Docs'}
                     </TabsTrigger>
                   )}
                </TabsList>

                <TabsContent value="pipeline" className="animate-in fade-in slide-in-from-bottom-2">
                   {isFinancialLockActive ? (
                      <Card className="border-4 border-dashed border-rose-100 rounded-[3rem] bg-rose-50/30 p-20 text-center">
                         <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto text-rose-500 shadow-xl mb-8 ring-8 ring-rose-50/50"><Lock className="h-12 w-12" /></div>
                         <h3 className="text-3xl font-black text-rose-900 font-headline">{isRtl ? 'رادار التنفيذ مغلق مالياً' : 'Pipeline Locked'}</h3>
                         <p className="text-slate-400 font-bold mt-2">{isRtl ? 'يرجى اعتماد عقد المشروع لفتح مسار العمل.' : 'Approve contract to launch pipeline.'}</p>
                         
                         {canSeeFinance && (
                           <Button onClick={() => setActiveTab('documents')} variant="outline" className="rounded-xl border-2 font-bold px-10 h-14 mt-6 gap-2">
                              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /> 
                              {isRtl ? 'الذهاب لإدارة العقود والسداد' : 'Go to Finance'}
                           </Button>
                         )}
                      </Card>
                   ) : (rawStages || []).length === 0 ? (
                      <div className="py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 space-y-6">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto text-slate-200"><Workflow className="h-12 w-12" /></div>
                        <div className="space-y-2">
                           <h3 className="text-2xl font-black text-slate-900">{isRtl ? 'بانتظار إطلاق المسار الفني' : 'Awaiting Pipeline Launch'}</h3>
                           <p className="text-sm font-bold text-slate-400 max-sm mx-auto">{isRtl ? 'لقد تم اعتماد العقد بنجاح. يمكنك الآن إطلاق مراحل العمل الفني المعتمدة لهذا المسار.' : 'Contract approved. You can now launch technical stages for this path.'}</p>
                        </div>
                        {isAdmin && (
                          <div className="flex flex-col items-center gap-3">
                             <Button onClick={handleManualInitialize} disabled={loadingAction === 'init'} className="h-14 px-12 rounded-2xl gap-3 shadow-xl bg-primary">
                                {loadingAction === 'init' ? <Loader2 className="animate-spin" /> : <Zap className="h-5 w-5" />}
                                {isRtl ? 'إطلاق المسار الفني الآن' : 'Launch Technical Path'}
                             </Button>
                             {!isConsulting && !activeBoq && (
                               <Button onClick={() => setIsBoqInitOpen(true)} variant="outline" className="h-12 border-2 px-8 rounded-xl gap-2">
                                  <FilePlus className="h-4 w-4" /> {isRtl ? 'إنشاء مقايسة للمشروع' : 'Create BOQ'}
                               </Button>
                             )}
                          </div>
                        )}
                      </div>
                   ) : (
                     <div className="space-y-6 text-start">
                        <div className="flex justify-between items-end px-2">
                           <h3 className="text-lg font-black font-headline text-slate-800 flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" /> {isRtl ? (isConsulting ? 'مسار التصميم الهندسي' : 'رادار المسار الميداني') : (isConsulting ? 'Design Pipeline' : 'Field Pipeline')}</h3>
                           <span className="text-3xl font-black font-headline text-primary">{progressPercent}%</span>
                        </div>
                        <div className="space-y-4">
                           {stages.map((stage, idx) => {
                              const boqProgress = stageProgressMap[stage.technicalStageId];
                              const isPreviousCompleted = idx === 0 || stages[idx-1].status === 'completed';
                              const isOperationalFrontier = stage.status === 'in-progress' || (stage.status === 'pending' && isPreviousCompleted);
                              const isReadyToStart = stage.status === 'pending' && isPreviousCompleted;
                              
                              const isAssignedEngineer = globalUser?.employeeId === transaction?.assignedEngineerId;
                              const isDeptAllowed = !stage.allowedDepartmentIds?.length || isAssignedEngineer || (globalUser?.departmentId && stage.allowedDepartmentIds.includes(globalUser.departmentId));

                              return (
                                <Card key={stage.id} onClick={() => setFilterStageId(filterStageId === stage.id ? null : stage.id!)} className={cn("border-0 shadow-lg rounded-2xl bg-white transition-all border-s-8 cursor-pointer", stage.status === 'completed' ? 'border-s-emerald-500' : stage.status === 'in-progress' ? 'border-s-blue-500' : isOperationalFrontier ? 'border-s-orange-300' : 'border-s-slate-100 opacity-50')}>
                                  <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                                     <div className="flex items-center gap-5 flex-1 text-start">
                                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black shadow-sm border", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-white")}>{stage.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : (idx + 1)}</div>
                                        <div className="space-y-1 flex-1 text-start">
                                           <div className="flex items-center gap-2">
                                              <h4 className="font-black text-base text-slate-900 tracking-tight">{stage.name}</h4>
                                              {isReadyToStart && <Badge className="bg-orange-100 text-orange-700 border-0 font-black text-[7px] px-2 h-4 animate-ready-pulse uppercase">{isRtl ? 'جاهزة للبدء' : 'Ready to Start'}</Badge>}
                                              {isConsulting && (stage.revisionCount || 0) > 0 && <Badge className="bg-orange-100 text-orange-700 border-0 font-black text-[9px] px-2 h-5">{isRtl ? `مراجعة #${stage.revisionCount}` : `Rev #${stage.revisionCount}`}</Badge>}
                                              {!isAdmin && !isDeptAllowed && <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 font-black text-[7px] gap-1 h-4"><Lock className="h-2 w-2" /> {isRtl ? 'خاص بقسم آخر' : 'Dept Locked'}</Badge>}
                                           </div>
                                           {!isConsulting && boqProgress && boqProgress.linkedItemsCount > 0 && (<div className="mt-2 space-y-1.5"><div className="flex justify-between text-[8px] font-black uppercase text-slate-400"><span>{isRtl ? 'الإنجاز الفني' : 'Progress'}</span><span>{boqProgress.progressPercent} %</span></div><Progress value={boqProgress.progressPercent} className="h-1.5" /></div>)}
                                        </div>
                                     </div>
                                     <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                           {isOperationalFrontier && (
                                              <>
                                                {stage.status === 'pending' && <Button onClick={() => handleStartStage(stage.id!)} disabled={!!processingId || (!isAdmin && !isDeptAllowed)} className="h-10 px-6 rounded-xl bg-blue-600 text-white font-black text-[10px] gap-2 shadow-lg hover:scale-105 transition-all">{processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />} {isRtl ? 'بدء العمل' : 'Start'}</Button>}
                                                {stage.status === 'in-progress' && <Button onClick={() => handleCompleteStage(stage)} disabled={!!processingId || (!isAdmin && !isDeptAllowed)} className="h-10 px-6 rounded-xl bg-emerald-600 text-white font-black text-[10px] gap-2 shadow-lg hover:scale-105 transition-all">{processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />} {isRtl ? 'إكمال' : 'Done'}</Button>}
                                                {stage.status === 'in-progress' && isConsulting && (<Button onClick={() => handleOpenRevisionDialog(stage)} disabled={processingId === `rev_${stage.id}` || (!isAdmin && !isDeptAllowed)} variant="outline" className="h-10 px-4 rounded-xl border-orange-200 text-orange-600 font-black text-[10px] gap-2 hover:bg-orange-50">{processingId === `rev_${stage.id}` ? <Loader2 className="animate-spin h-4 w-4" /> : <RotateCcw className="h-4 w-4" />} {isRtl ? 'تسجيل دورة تعديل' : 'Log Revision'}</Button>)}
                                                {stage.status === 'in-progress' && editAccess.can && !isConsulting && (<Button disabled={!isAdmin && !isDeptAllowed} onClick={() => { setTargetStage(stage); setIsRecordOpen(true); }} className="btn-gradient h-10 px-6 rounded-xl text-[10px] gap-2"><Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز' : 'Log'}</Button>)}
                                              </>
                                           )}
                                           {isAdmin && stage.status === 'completed' && <Button onClick={() => handleReopenStage(stage.id!)} variant="outline" className="h-9 px-4 rounded-lg text-orange-600 border-orange-200 hover:bg-orange-50 text-[9px] gap-1"><RotateCcw className="h-3 w-3" /> {isRtl ? 'إعادة فتح' : 'Reopen'}</Button>}
                                           {isAdmin && <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>}
                                     </div>
                                  </CardContent>
                                </Card>
                              );
                           })}
                        </div>
                     </div>
                   )}
                </TabsContent>

                {canSeeFinance && (
                  <TabsContent value="documents" className="animate-in fade-in">
                     <TransactionDocumentsView transaction={transaction} clientId={clientId} clientName={transaction?.clientName || ''} isAdmin={isAdmin} permissions={permissions} />
                  </TabsContent>
                )}
             </Tabs>
          </div>
          <div className="lg:col-span-5">
             <CommentSection transactionId={transactionId} path={paths.transactionComments(companyId!, transactionId)} externalLogs={allExecutions || []} boqItems={boqItems || []} stages={stages} filterStageId={filterStageId} technicalStageId={stages.find(s=>s.id===filterStageId)?.technicalStageId} selectedStageName={stages.find(s=>s.id===filterStageId)?.name} onClearFilter={() => setFilterStageId(null)} />
          </div>
      </div>

      <Dialog open={isRevisionOpen} onOpenChange={setIsRevisionOpen}>
         <DialogContent className="rounded-xl p-0 max-w-lg border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-orange-50 p-6 border-b text-orange-900 text-start">
               <DialogTitle className="text-xl font-black flex items-center gap-3"><RotateCcw className="h-6 w-6" /> {isRtl ? 'توثيق مراجعة وتعديل التصميم' : 'Log Design Revision'}</DialogTitle>
               <p className="text-xs font-bold mt-1 opacity-70">{revisionStage?.name}</p>
            </div>
            <div className="p-8 space-y-4 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'أسباب أو تفاصيل التعديل' : 'Revision Notes / Reason'}</Label>
               <Textarea value={revisionComment} onChange={e => setRevisionComment(e.target.value)} placeholder={isRtl ? "اكتب هنا تفاصيل التعديلات التي تمت على المخطط..." : "Describe the changes made..."} className="min-h-[120px] rounded-2xl border-2 p-5 text-sm font-bold bg-slate-50 focus:bg-white transition-all shadow-inner" />
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRevisionOpen(false)} className="flex-1 h-12 rounded-xl font-bold">إلغاء</Button>
               <Button onClick={handleConfirmRevision} disabled={!revisionComment.trim()} className="flex-[2] h-12 rounded-xl bg-orange-600 text-white font-black text-lg shadow-xl shadow-orange-200"><Save className="h-5 w-5" /> {isRtl ? 'اعتماد دورة التعديل' : 'Confirm Revision'}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isBoqInitOpen} onOpenChange={setIsBoqInitOpen}>
         <DialogContent className="rounded-[2.5rem] p-0 max-w-lg" dir={dir}>
            <div className="bg-slate-50 p-10 text-slate-900 border-b"><DialogTitle className="text-2xl font-black font-headline flex items-center gap-4"><FilePlus className="h-8 w-8 text-primary" />{isRtl ? 'استنساخ مقايسة' : 'Create BOQ'}</DialogTitle></div>
            <div className="p-10 space-y-8">
               <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent className="rounded-2xl">{templates?.map(t => (<SelectItem key={t.id} value={t.id!} className="font-bold py-4">{t.name}</SelectItem>))}</SelectContent>
               </Select>
               <Button onClick={handleCreateBOQ} disabled={!selectedTemplateId || !!loadingAction} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl gap-3 shadow-xl shadow-primary/20 border-b-8 border-orange-700">{loadingAction ? <Loader2 className="animate-spin h-6 w-6" /> : <Sparkles className="h-6 w-6" />}{isRtl ? 'إنشاء المقايسة' : 'Generate'}</Button>
            </div>
         </DialogContent>
      </Dialog>

      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
         <DialogContent className="rounded-xl p-0 max-md border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 border-b text-start"><DialogTitle className="text-lg font-black flex items-center gap-3"><Hammer className="h-5 w-5 text-primary" />{isRtl ? 'تسجيل إنجاز فني' : 'Log Progress'}</DialogTitle></div>
            <div className="p-6 space-y-6 text-start">
               <Label className="text-[11px] font-black uppercase text-slate-400">Target Item</Label>
               <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="h-10 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border shadow-2xl z-[160]">
                    {boqItems?.filter(i => (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(targetStage?.technicalStageId!) || i.technicalStageId === targetStage?.technicalStageId)).map(i => (
                      <SelectItem key={i.id} value={i.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50 text-start">
                        <div className="flex flex-col text-start">
                          <span className="font-black text-slate-800">{i.referenceTitle}</span>
                          <span className="text-[8px] text-slate-400">#{i.referenceCode}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {boqItems?.filter(i => (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(targetStage?.technicalStageId!) || i.technicalStageId === targetStage?.technicalStageId)).length === 0 && (
                       <div className="p-4 text-center text-slate-300 text-xs italic">لا توجد بنود مربوطة بهذه المرحلة.</div>
                    )}
                  </SelectContent>
               </Select>
               <div className="space-y-4 pt-2">
                  <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-slate-400">Quantity Executed</Label><Input type="number" step="0.01" value={progressQty} onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} className="h-12 rounded-lg border-2 font-black text-2xl text-center shadow-inner" /></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-black uppercase text-slate-400">Field Notes</Label><Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-lg bg-slate-50/50 border-2 text-xs font-bold resize-none" /></div>
               </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 text-start"><Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-12 rounded-xl font-bold border-2 bg-white">إلغاء</Button><Button onClick={() => handleRecordProgress()} disabled={loadingAction === 'recording' || !selectedItemId} className="flex-[2] btn-gradient h-12 rounded-xl text-lg gap-2 shadow-xl shadow-orange-500/20">{isRtl ? 'حفظ السجل الميداني' : 'Commit'}</Button></DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!incompleteStage} onOpenChange={(v) => !v && setIncompleteStage(null)}>
         <AlertDialogContent className="rounded-xl p-8 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader className="bg-amber-50 p-6 rounded-xl border border-amber-100"><AlertDialogTitle className="text-start font-black text-xl text-amber-900 flex items-center gap-2"><AlertTriangle className="h-6 w-6" /> {isRtl ? 'المرحلة غير مكتملة فنيًا' : 'Incomplete Stage'}</AlertDialogTitle><AlertDialogDescription className="text-start font-bold text-amber-700 mt-2">{isRtl ? `نسبة إنجاز بنود المقايسة في هذه المرحلة هي ${incompleteStage?.progress.progressPercent}%. هل ترغب في الإغلاق الإجباري؟` : `Progress is only ${incompleteStage?.progress.progressPercent}%. Force close?`}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter className="mt-8 gap-3 flex flex-row"><AlertDialogCancel className="flex-1 h-10 rounded-lg font-bold border-2 bg-white">إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => handleCompleteStage(incompleteStage!.stage, true)} className="flex-[2] h-10 rounded-lg font-black bg-orange-600 text-white shadow-xl shadow-rose-200">{isRtl ? 'نعم، إغلاق إجباري' : 'Force Close'}</AlertDialogAction></AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

      {activeBoq && <VOManagerDialog isOpen={isVOOpen} onClose={() => setIsVOOpen(false)} boqId={activeBoq.id} transactionId={transactionId} boqNumber={activeBoq.boqNumber} boqItems={boqItems || []} />}
    </div>
  );
}
