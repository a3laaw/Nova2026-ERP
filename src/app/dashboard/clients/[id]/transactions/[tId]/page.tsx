'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, Check, FileSpreadsheet, Zap, Workflow, ArrowRight,
  Sparkles, FilePlus, Lock, Plus, Save, CheckCircle2, RotateCcw,
  MessageSquare, History, Hammer, X, AlertTriangle, Undo2,
  Hash, Target, Calculator, LayoutGrid, Folder, Pencil
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, serverTimestamp, addDoc, updateDoc, getDocs, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { BOQ, Contract, BOQItem } from '@/types/documents';
import { BOQTemplate } from '@/types/templates';
import { CommentSection } from '@/components/transactions/comment-section';
import { DocumentService } from '@/services/document-service';
import { BOQExecutionService } from '@/services/boq-execution-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TransactionDocumentsView } from '@/components/transactions/transaction-documents-view';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function TransactionDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const clientId = params?.id as string;
  const transactionId = params?.tId as string;
  
  const { globalUser, user } = useAuthContext();
  const { t, tSafe, dir, isRtl } = useLanguage();
  const { permissions, isAdmin, check } = usePermissions();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [activeTab, setActiveTab] = useState('pipeline');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isBoqInitOpen, setIsBoqInitOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  
  // Smart Filtering (#)
  const [filterStageId, setFilterStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string>("");
  const [selectedTechStageId, setSelectedTechStageId] = useState<string | null>(null);

  // Cascading Log Engine
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [activeStageForLog, setActiveStageForLog] = useState<StageInstance | null>(null);
  const [logForm, setLogForm] = useState({
    sectionId: '',
    itemId: '',
    quantity: '',
    notes: ''
  });

  // Revision Engine
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionForm, setRevisionForm] = useState({ content: '', stageId: '', stageName: '' });

  // Revert Engine
  const [revertingStage, setRevertingStage] = useState<StageInstance | null>(null);
  const [revertReason, setRevertReason] = useState("");

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const canSeeFinance = check('accounting', 'view').can || check('procurement', 'view').can;
  const currentUserName = useMemo(() => globalUser?.fullName || user?.displayName || 'User', [globalUser, user]);

  const transRef = useMemo(() => (companyId && db && transactionId) ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  const contractsQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.contracts(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: contracts } = useCollection<Contract>(contractsQuery);

  const hasApprovedContract = useMemo(() => {
    return contracts?.some(c => ['approved', 'paid', 'active', 'signed'].includes(c.status || '') || c.isPaid);
  }, [contracts]);
  
  const boqQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.boqs(companyId))) : null, [db, companyId]);
  const { data: allBoqs } = useCollection<BOQ>(boqQuery);
  
  const activeBoq = useMemo(() => {
    const tid = transactionId?.trim();
    return (allBoqs || []).find(b => b.transactionId?.trim() === tid);
  }, [allBoqs, transactionId]);

  const boqItemsQuery = useMemo(() => (companyId && db && activeBoq?.id) ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(boqItemsQuery);

  const allTemplatesQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.boqTemplates(companyId))) : null, [db, companyId]);
  const { data: allTemplates } = useCollection<BOQTemplate>(allTemplatesQuery);

  const templates = useMemo(() => {
    if (!allTemplates || !transaction) return [];
    return allTemplates.filter(t => t.subServiceId === transaction.subServiceId);
  }, [allTemplates, transaction]);

  const isDesignProject = useMemo(() => {
     const actName = transaction?.activityTypeName || '';
     return actName.includes('تصميم') || 
            actName.includes('Architectural') || 
            actName.includes('Design') ||
            actName.includes('استشارات') ||
            actName.includes('Consulting');
  }, [transaction]);

  const stagesQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order', 'asc')) : null, [db, companyId, transactionId]);
  const { data: rawStages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  const stages = useMemo(() => (rawStages || []).sort((a, b) => (a.order || 0) - (b.order || 0)), [rawStages]);
  const progressPercent = useMemo(() => stages.length ? Math.round((stages.filter(s => s.status === 'completed').length / stages.length) * 100) : 0, [stages]);

  const transactionService = useMemo(() => (db && companyId) ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);
  const boqExecService = useMemo(() => (db && companyId) ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  const availableSections = useMemo(() => {
    if (!activeStageForLog || !boqItems) return [];
    const sections = new Map<string, string>();
    boqItems.forEach(i => {
       if ((i.technicalStageIds?.includes(activeStageForLog.technicalStageId) || i.technicalStageId === activeStageForLog.technicalStageId)) {
          if (i.ancestorIds && i.ancestorTitles && i.ancestorIds.length > 0) {
             const lastIdx = i.ancestorIds.length - 1;
             sections.set(i.ancestorIds[lastIdx], i.ancestorTitles[lastIdx] || 'Section');
          }
       }
    });
    return Array.from(sections.entries()).map(([id, title]) => ({ id, title }));
  }, [activeStageForLog, boqItems]);

  const availableItems = useMemo(() => {
    if (!activeStageForLog || !boqItems || !logForm.sectionId) return [];
    return boqItems.filter(i => 
      (i.technicalStageIds?.includes(activeStageForLog.technicalStageId) || i.technicalStageId === activeStageForLog.technicalStageId) &&
      i.ancestorIds?.includes(logForm.sectionId)
    );
  }, [activeStageForLog, boqItems, logForm.sectionId]);

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try { 
      await transactionService.startStage(transactionId, stageId, user.uid, currentUserName, globalUser?.departmentId); 
      toast({ title: tSafe('common.active', 'نشط', 'Active') }); 
    }
    catch (e: any) { toast({ variant: "destructive", title: tSafe('common.error', 'خطأ', 'Error'), description: e.message }); }
    finally { setProcessingId(null); }
  };

  const handleCompleteStage = async (stage: StageInstance) => {
    if (!transactionService || !user || !stage.id) return;
    setProcessingId(stage.id);
    try { 
      await transactionService.completeStage(transactionId, stage.id, user.uid, currentUserName, globalUser?.departmentId); 
      toast({ title: tSafe('common.completed', 'مكتمل', 'Completed') }); 
    }
    catch (e: any) { toast({ variant: "destructive", title: tSafe('common.error', 'خطأ', 'Error'), description: e.message }); }
    finally { setProcessingId(null); }
  };

  const handleSaveLog = async () => {
    if (!boqExecService || !activeStageForLog || !logForm.itemId || !logForm.quantity) return;
    
    const item = boqItems?.find(i => i.id === logForm.itemId);
    if (item) {
       const planned = item.plannedQuantity || 0;
       const alreadyDone = item.executedQuantity || 0;
       const newVal = Number(logForm.quantity) || 0;
       if (alreadyDone + newVal > planned) {
          toast({ 
            variant: "destructive", 
            title: tSafe('common.alert', 'تنبيه', 'Alert'), 
            description: isRtl 
              ? `الكمية المطلوبة تتجاوز المخطط (${planned}). يرجى إنشاء أمر تغييري (VO) أولاً.` 
              : `Quantity exceeds planned (${planned}). Please create a VO first.` 
          });
          return;
       }
    }

    setLoadingAction('logging');
    try {
      await boqExecService.recordBOQItemExecution(activeBoq!.id, logForm.itemId, activeStageForLog.technicalStageId, Number(logForm.quantity), user!.uid, currentUserName, logForm.notes, activeStageForLog.id!, false);
      toast({ title: tSafe('common.saved', 'تم الحفظ', 'Saved') });
      setIsLogOpen(false);
      setLogForm({ sectionId: '', itemId: '', quantity: '', notes: '' });
    } finally { setLoadingAction(null); }
  };

  const handleSaveRevision = async () => {
    if (!transactionService || !revisionForm.content.trim()) return;
    setLoadingAction('revision');
    try {
      await transactionService.addStageRevision(transactionId, revisionForm.stageId, revisionForm.content, user!.uid, currentUserName);
      toast({ title: tSafe('common.saved', 'تم الحفظ', 'Saved') });
      setIsRevisionOpen(false);
      setRevisionForm({ content: '', stageId: '', stageName: '' });
    } finally { setLoadingAction(null); }
  };

  const handleRevertStage = async () => {
    if (!db || !companyId || !revertingStage || !revertReason.trim()) return;
    setLoadingAction('revert');
    try {
      const stageRef = doc(db, paths.transactionStages(companyId, transactionId), revertingStage.id!);
      await updateDoc(stageRef, { status: 'in-progress', completedAt: null, completedBy: null, updatedAt: serverTimestamp() });

      const timelineRef = collection(db, paths.transactionTimeline(companyId, transactionId));
      await addDoc(timelineRef, {
        transactionId, stageId: revertingStage.id, type: 'stage_reopen',
        content: tSafe('inline.reason.for.reverting.stage', 'سبب التراجع عن اكتمال المرحلة:', 'Reason for reverting stage:') + " " + revertReason,
        userId: user!.uid, userName: currentUserName, companyId, createdAt: serverTimestamp()
      });

      toast({ title: tSafe('inline.reverted', 'تم التراجع', 'Reverted') });
      setRevertingStage(null);
      setRevertReason("");
    } finally { setLoadingAction(null); }
  };

  const handleUpdateNumericProgress = async (stageId: string, value: number) => {
    if (!db || !companyId) return;
    const stageRef = doc(db, paths.transactionStages(companyId, transactionId), stageId);
    await updateDoc(stageRef, { currentCount: value, updatedAt: serverTimestamp() });
  };

  const getStageConstructionProgress = (technicalStageId: string) => {
     if (!boqItems) return { planned: 0, executed: 0, pct: 0 };
     const stageItems = boqItems.filter(i => (i.technicalStageIds?.includes(technicalStageId) || i.technicalStageId === technicalStageId));
     if (stageItems.length === 0) return { planned: 0, executed: 0, pct: 100 };
     const planned = stageItems.reduce((acc, i) => acc + (i.plannedQuantity || 0), 0);
     const executed = stageItems.reduce((acc, i) => acc + (i.executedQuantity || 0), 0);
     return { planned, executed, pct: Math.min(100, Math.round((executed / Math.max(1, planned)) * 100)) };
  };

  const handleCreateBOQ = async () => {
    if (!db || !companyId || !user || !selectedTemplateId || !transaction) return;
    setLoadingAction('creating_boq');
    try {
      const docService = new DocumentService(db, companyId, permissions);
      const template = templates?.find(t => t.id === selectedTemplateId);
      await docService.instantiateBoqFromTemplate(selectedTemplateId, { 
        transactionId, clientId, clientName: transaction.clientName, 
        activityTypeId: transaction.activityTypeId, serviceId: transaction.serviceId, 
        subServiceId: transaction.subServiceId, name: template?.name || "" 
      }, user.uid, currentUserName);
      toast({ title: t('common.saved') });
      setIsBoqInitOpen(false);
    } catch (e: any) { 
      toast({ variant: "destructive", title: tSafe('common.error', 'خطأ', 'Error'), description: e.message }); 
    }
    finally { setLoadingAction(null); }
  };

  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-100 text-start">
        <div className="text-start">
           <div className="flex items-center gap-3">
              <Badge variant="outline" className="h-6 px-2 font-bold text-[10px] bg-slate-50 border-slate-200">{transaction?.transactionNumber}</Badge>
              <h1 className="text-lg md:text-xl font-bold text-slate-900">{transaction?.subServiceName}</h1>
           </div>
           <div className="flex items-center gap-2 mt-1">
              <Badge className={cn("font-bold px-2 h-4 rounded-md text-[8px] uppercase", transaction?.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{transaction?.status}</Badge>
              <span className="text-[10px] font-medium text-slate-400">{transaction?.activityTypeName}</span>
           </div>
        </div>
        <div className="flex gap-2">
           {activeBoq ? (
             <button 
               disabled={!hasApprovedContract}
               onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} 
               className={cn(
                 "h-8 px-3 rounded-md font-bold text-[10px] gap-1.5 border flex items-center shadow-sm", 
                 !hasApprovedContract ? "opacity-50 cursor-not-allowed bg-slate-50" :
                 activeBoq.status !== 'approved' ? "border-amber-200 bg-amber-50 text-amber-600" : "border-slate-200 bg-white"
               )}
             >
                 <FileSpreadsheet className="h-3 w-3" /> {activeBoq.status === 'approved' ? tSafe('inline.boq', 'المقايسة المعتمدة', 'BOQ') : tSafe('common.pending', 'معلق', 'Pending')}
             </button>
           ) : (
             <Button 
               disabled={!hasApprovedContract}
               onClick={() => setIsBoqInitOpen(true)} 
               variant="outline" 
               size="sm" 
               className="h-8 px-3 rounded-md font-bold text-[10px] gap-1.5 border-slate-200 shadow-sm"
             >
                <FilePlus className="h-3.5 w-3.5 me-2" /> {tSafe('inline.create.boq', 'إنشاء مقايسة', 'Create BOQ')}
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
             <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                <TabsList className="bg-slate-100/50 p-1 rounded-md h-9 gap-1 shadow-sm mb-4 inline-flex">
                   <TabsTrigger value="pipeline" className="rounded-sm text-[10px] font-black px-4 h-full data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                      {tSafe('projects.details.radar', 'رادار التنفيذ', 'Execution Radar')}
                   </TabsTrigger>
                   {canSeeFinance && (
                     <TabsTrigger value="documents" className="rounded-sm text-[10px] font-black px-4 h-full data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                        {tSafe('projects.details.finance', 'المستندات والمالية', 'Docs & Finance')}
                     </TabsTrigger>
                   )}
                </TabsList>

                <TabsContent value="pipeline">
                   {!hasApprovedContract ? (
                      <Card className="border-2 border-dashed rounded-[1.5rem] bg-white p-12 text-center space-y-4">
                         <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto"><Lock className="h-8 w-8 text-slate-200" /></div>
                         <h3 className="text-sm font-black text-slate-900">{tSafe('inline.no_contract_lock', 'المسار مقفل. يرجى اعتماد العقد للعميل أولاً.', 'Path locked. Approve contract first.')}</h3>
                         <Button onClick={() => setActiveTab('documents')} variant="outline" size="sm" className="h-8 font-bold px-6 text-[10px] rounded-md shadow-sm border-2">
                           <Plus className="h-3.5 w-3.5 me-2" /> {tSafe('inline.contracts', 'إصدار العقد', 'Contracts')}
                         </Button>
                      </Card>
                   ) : (
                     <div className="space-y-6 text-start animate-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-end px-1">
                           <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Workflow className="h-3.5 w-3.5 text-primary" /> {tSafe('checklists', 'قواعد العمل', 'Business Rules')}</h3>
                           <span className="text-sm font-black text-primary">{progressPercent}%</span>
                        </div>
                        
                        <div className="space-y-3">
                           {!stages.length ? (
                              <Card className="py-20 text-center bg-white rounded-lg border-2 border-dashed space-y-4 shadow-none">
                                <Workflow className="h-8 w-8 text-slate-100 mx-auto" />
                                <h3 className="text-xs font-bold text-slate-900">{tSafe('inline.awaiting.launch', 'بانتظار إطلاق المسار', 'Awaiting Launch')}</h3>
                                <Button onClick={() => transactionService?.initializeTechnicalPath(transactionId, transaction?.activityTypeId || '', transaction?.serviceId || '', transaction?.subServiceId || '', user!.uid)} disabled={loadingAction === 'init'} size="sm" className="h-8 font-bold px-6 text-[10px] rounded-md shadow-sm">
                                   <Zap className="h-3.5 w-3.5 me-2" /> {tSafe('inline.launch.path', 'تفعيل المسار', 'Launch Path')}
                                </Button>
                              </Card>
                           ) : stages.map((stage, idx) => {
                              const isOperationalFrontier = stage.status === 'in-progress' || (stage.status === 'pending' && (idx === 0 || stages[idx-1].status === 'completed'));
                              const constProgress = !isDesignProject ? getStageConstructionProgress(stage.technicalStageId) : null;
                              const isFiltered = filterStageId === stage.id;

                              return (
                                <Card 
                                  key={stage.id} 
                                  onClick={() => {
                                     setFilterStageId(isFiltered ? null : stage.id!);
                                     setSelectedStageName(isFiltered ? "" : stage.name);
                                     setSelectedTechStageId(isFiltered ? null : stage.technicalStageId);
                                  }}
                                  className={cn(
                                    "rounded-xl shadow-sm border bg-white transition-all border-s-8 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20", 
                                    stage.status === 'completed' ? 'border-s-emerald-500' : stage.status === 'in-progress' ? 'border-s-blue-500' : 'border-s-slate-100 opacity-80',
                                    isFiltered && "ring-2 ring-primary bg-primary/[0.02]"
                                  )}
                                >
                                  <CardContent className="p-5 space-y-4 text-start">
                                     <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                           <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-inner", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400")}>{stage.status === 'completed' ? <Check className="h-5 w-5" /> : (idx + 1)}</div>
                                           <div className="flex flex-col min-w-0">
                                              <div className="flex items-center gap-2">
                                                 <h4 className={cn("font-black text-sm", isFiltered ? "text-primary" : "text-slate-900")}>{stage.name}</h4>
                                                 {(stage.revisionCount || 0) > 0 && <Badge className="bg-orange-500 text-white text-[7px] font-black h-4 px-1.5 border-0">REV: {stage.revisionCount}</Badge>}
                                              </div>
                                              <div className="flex items-center gap-3 mt-1">
                                                 {isDesignProject && stage.isNumeric && (
                                                   <span className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded">
                                                      <Target className="h-3 w-3" /> {stage.currentCount || 0} / {stage.numericTarget}
                                                   </span>
                                                 )}
                                                 {!isDesignProject && constProgress && (
                                                   <span className="text-[9px] font-black text-emerald-600 uppercase flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                                                      <LayoutGrid className="h-3 w-3" /> {constProgress.pct}% {tSafe('inline.completion', 'إنجاز', 'Completion')}
                                                   </span>
                                                 )}
                                              </div>
                                           </div>
                                        </div>
                                        
                                        <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                                           {stage.status === 'in-progress' && (
                                              <div className="flex gap-2">
                                                 {!isDesignProject && (
                                                   <Button onClick={() => { setActiveStageForLog(stage); setIsLogOpen(true); }} size="sm" className="h-8 px-4 rounded-lg text-[10px] font-black bg-primary text-white shadow-lg hover:scale-105 transition-all gap-2">
                                                      <Hammer className="h-3.5 w-3.5" /> {tSafe('inline.log_progress', 'تسجيل إنجاز', 'Log Progress')}
                                                   </Button>
                                                 )}
                                                 <Button variant="outline" size="sm" onClick={() => { setRevisionForm({ content: '', stageId: stage.id!, stageName: stage.name }); setIsRevisionOpen(true); }} className="h-8 px-3 rounded-lg text-[10px] font-black border-2 gap-2">
                                                    <RotateCcw className="h-3.5 w-3.5" /> {tSafe('inline.revision', 'تعديل', 'Revision')}
                                                 </Button>
                                              </div>
                                           )}

                                           {isOperationalFrontier && (
                                              <>
                                                {stage.status === 'pending' && <Button onClick={() => handleStartStage(stage.id!)} size="sm" className="h-8 px-4 rounded-lg text-[10px] font-black bg-primary shadow-lg hover:scale-105 transition-all">
                                                  {processingId === stage.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tSafe('inline.start_btn', 'مباشرة', 'Start')}
                                                </Button>}
                                                {stage.status === 'in-progress' && <Button onClick={() => handleCompleteStage(stage)} size="sm" className="h-8 px-4 rounded-lg text-[10px] font-black bg-emerald-600 text-white shadow-lg hover:scale-105 transition-all">
                                                  {processingId === stage.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : tSafe('inline.complete_btn', 'إتمام', 'Complete')}
                                                </Button>}
                                              </>
                                           )}
                                           {stage.status === 'completed' && isAdmin && (
                                              <Button onClick={() => setRevertingStage(stage)} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-300 hover:text-rose-600">
                                                 <Undo2 className="h-4 w-4" />
                                              </Button>
                                           )}
                                        </div>
                                     </div>

                                     {isDesignProject && stage.isNumeric && stage.status === 'in-progress' && (
                                        <div className="pt-4 border-t border-slate-50 flex items-center justify-between gap-6 animate-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                                           <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase">{tSafe('inline.track_progress', 'تتبع المخرجات العددية', 'Track Numeric Outputs')}</p></div>
                                           <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
                                              <Input type="number" defaultValue={stage.currentCount || 0} onBlur={(e) => handleUpdateNumericProgress(stage.id!, Number(e.target.value))} className="h-9 w-20 text-center font-black text-blue-600 border-2" />
                                              <span className="text-[10px] font-black text-slate-300">/ {stage.numericTarget}</span>
                                           </div>
                                        </div>
                                     )}

                                     {!isDesignProject && stage.status === 'in-progress' && (
                                        <div className="pt-4 border-t border-slate-50 space-y-3 animate-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                                           <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-3">
                                                 <div className="h-8 w-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600"><Calculator className="h-4 w-4" /></div>
                                                 <div className="text-start">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">{tSafe('inline.linked_to_boq', 'مربوط بالكميات الميدانية (BOQ)', 'Linked to BOQ')}</p>
                                                    <p className="text-[10px] font-bold text-slate-500">{constProgress?.executed} / {constProgress?.planned} {tSafe('inline.total_units', 'وحدة إجمالية', 'Total Units')}</p>
                                                 </div>
                                              </div>
                                              <Button variant="link" onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="text-[9px] font-black text-primary p-0 h-auto">
                                                 {tSafe('inline.view_quantities', 'عرض كميات المرحلة', 'View Quantities')} <ArrowRight className={cn("h-3 w-3 ms-1", isRtl && "rotate-180")} />
                                              </Button>
                                           </div>
                                           <Progress value={constProgress?.pct} className="h-1.5" />
                                        </div>
                                     )}
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
          <div className="lg:col-span-5 h-full min-h-[500px]">
             <CommentSection transactionId={transactionId} path={paths.transactionComments(companyId!, transactionId)} stages={stages} boqItems={boqItems} filterStageId={filterStageId} selectedStageName={selectedStageName} technicalStageId={selectedTechStageId} onClearFilter={() => { setFilterStageId(null); setSelectedStageName(""); setSelectedTechStageId(null); }} />
          </div>
      </div>

      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden bg-white border-0 shadow-3xl max-w-xl text-start" dir={dir}>
            <div className="bg-primary p-8 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-4"><Hammer className="h-8 w-8 text-white" /> {tSafe('inline.log_stage_progress', 'تسجيل إنجاز فني', 'Log Stage Progress')}</DialogTitle>
               <p className="text-white/70 font-bold mt-2 uppercase text-[10px] tracking-widest">{tSafe('inline.active_stage', 'المرحلة الجارية:', 'Active Stage:')} {activeStageForLog?.name}</p>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.select_section', 'اختر القسم الرئيسي', 'Select Section')}</Label>
                     <Select value={logForm.sectionId} onValueChange={v => setLogForm({...logForm, sectionId: v, itemId: ''})}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50 shadow-inner"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl border-0 shadow-2xl z-[160]">
                           {availableSections.map(s => <SelectItem key={s.id} value={s.id} className="font-bold py-3 border-b last:border-0 border-slate-50">{s.title}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.select_work_item', 'اختر بند العمل', 'Select Work Item')}</Label>
                     <Select disabled={!logForm.sectionId} value={logForm.itemId} onValueChange={v => setLogForm({...logForm, itemId: v})}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl border-0 shadow-2xl z-[160]">
                           {availableItems.map(i => (
                             <SelectItem key={i.id} value={i.id!} className="font-bold py-3 border-b last:border-0 border-slate-50">
                                <div className="flex flex-col text-start"><span>{i.referenceTitle}</span><span className="text-[8px] text-slate-400 uppercase">#{i.referenceCode} • {i.unitSymbol}</span></div>
                             </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-50">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.quantity', 'الكمية المنفذة', 'Quantity')}</Label><Input type="number" step="0.01" value={logForm.quantity} onChange={e => setLogForm({...logForm, quantity: e.target.value})} className="h-14 rounded-2xl border-2 font-black text-2xl text-center text-primary bg-slate-50/50" /></div>
                  <div className="md:col-span-2 space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('common.notes', 'ملاحظات المهندس', 'Notes')}</Label><Textarea value={logForm.notes} onChange={e => setLogForm({...logForm, notes: e.target.value})} className="min-h-[100px] rounded-2xl border-2 p-4 text-xs font-bold" /></div>
               </div>
               <Button onClick={handleSaveLog} disabled={!logForm.itemId || !logForm.quantity || !!loadingAction} className="w-full h-16 rounded-[2rem] font-black text-xl bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 transition-all border-b-8 border-orange-700">
                  {loadingAction === 'logging' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6 me-2" />} {tSafe('inline.confirm_log', 'اعتماد وتسجيل الإنجاز', 'Confirm & Log')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      <Dialog open={isRevisionOpen} onOpenChange={setIsRevisionOpen}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden bg-white border-0 shadow-3xl max-w-xl text-start" dir={dir}>
            <div className="bg-orange-500 p-8 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-4"><RotateCcw className="h-8 w-8 text-white" /> {tSafe('inline.technical_revision', 'تسجيل تعديل فني', 'Technical Revision')}</DialogTitle>
               <p className="text-white/70 font-bold mt-2 uppercase text-[10px] tracking-widest">{tSafe('inline.active_stage', 'المرحلة:', 'Stage:')} {revisionForm.stageName}</p>
            </div>
            <div className="p-8 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('common.notes', 'وصف التعديل', 'Revision Content')}</Label>
                  <Textarea value={revisionForm.content} onChange={e => setRevisionForm({...revisionForm, content: e.target.value})} placeholder="..." className="min-h-[150px] rounded-2xl border-2 p-6 font-bold bg-slate-50 shadow-inner" />
               </div>
               <Button onClick={handleSaveRevision} disabled={!revisionForm.content.trim() || !!loadingAction} className="w-full h-16 rounded-[2rem] bg-orange-600 text-white font-black text-xl shadow-xl shadow-orange-100 border-b-8 border-orange-800">
                  {loadingAction === 'revision' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6 me-2" />} {tSafe('common.save', 'حفظ التعديل', 'Save Revision')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      <Dialog open={!!revertingStage} onOpenChange={(v) => !v && setRevertingStage(null)}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden bg-white border-0 shadow-3xl max-w-lg text-start" dir={dir}>
            <div className="bg-rose-600 p-8 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-4"><Undo2 className="h-8 w-8 text-white" /> {tSafe('inline.revert_stage', 'تراجع عن اكتمال المرحلة', 'Revert Stage Completion')}</DialogTitle>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.revert_reason', 'المبرر الفني للتراجع', 'Technical Reason')}</Label>
                  <Textarea value={revertReason} onChange={e => setRevertReason(e.target.value)} placeholder="..." className="min-h-[120px] rounded-2xl border-2 p-6 font-bold bg-slate-50" />
               </div>
               <Button onClick={handleRevertStage} disabled={!revertReason.trim() || !!loadingAction} className="w-full h-16 rounded-[2rem] font-black bg-rose-600 text-white shadow-xl shadow-rose-100 border-b-8 border-rose-800">
                  {loadingAction === 'revert' ? <Loader2 className="h-6 w-6 animate-spin" /> : tSafe('inline.confirm_revert', 'تأكيد التراجع الآن', 'Confirm Revert')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      <Dialog open={isBoqInitOpen} onOpenChange={setIsBoqInitOpen}>
         <DialogContent className="rounded-xl max-w-md p-0 overflow-hidden border shadow-3xl bg-white text-start" dir={dir}>
            <div className="bg-slate-50 p-6 border-b text-start"><DialogTitle className="text-base font-black flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {tSafe('common.confirm', 'تأكيد', 'Confirm')}</DialogTitle></div>
            <div className="p-8 space-y-4 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('templates', 'القوالب', 'Templates')}</Label>
               <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-black text-lg"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border-2 shadow-2xl">
                     {(templates || []).map((t_item: any) => <SelectItem key={t_item.id} value={t_item.id!} className="font-bold py-4">{t_item.name}</SelectItem>)}
                  </SelectContent>
               </Select>
               <Button onClick={handleCreateBOQ} disabled={!selectedTemplateId || !!loadingAction} className="w-full h-14 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 border-b-4 border-orange-700 mt-4 transition-all">
                  {loadingAction === 'creating_boq' ? <Loader2 className="h-4 w-4 animate-spin" /> : tSafe('common.save', 'حفظ', 'Save')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TransactionDetailsPage() {
  return (
    <Suspense fallback={<div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
      <TransactionDetailsContent />
    </Suspense>
  );
}
