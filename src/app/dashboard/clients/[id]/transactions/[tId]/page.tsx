
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
  ShieldAlert,
  ShieldX
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
    return globalUser?.fullName || user?.displayName || globalUser?.username || 'Engineer';
  }, [globalUser, user]);

  const transRef = useMemo(() => (companyId && db && transactionId) ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  const contractsQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.contracts(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: contracts, loading: contractsLoading } = useCollection<Contract>(contractsQuery);
  
  const activeContract = useMemo(() => 
    contracts?.find(c => ['approved', 'paid', 'active', 'signed'].includes(c.status || '') || c.isPaid),
  [contracts]);
  
  const isFinancialLockActive = !activeContract;

  const isFieldProject = useMemo(() => {
    if (!transaction) return false;
    const type = transaction.activityTypeName || '';
    return type.includes('مقاولات') || type.includes('Construction') || type.includes('بناء') || type.includes('Build');
  }, [transaction]);

  const isDesignProject = useMemo(() => {
    if (!transaction) return false;
    const type = transaction.activityTypeName || '';
    return type.includes('استشارات') || type.includes('Consulting') || type.includes('تصميم') || type.includes('Design');
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
      if (!executionService || !stages || stages.length === 0 || isDesignProject) return;
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
  }, [executionService, stages, transactionId, allExecutions, isDesignProject]);

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
      toast({ title: isRtl ? "تم إنشاء المقايسة" : "BOQ Created" });
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
      toast({ title: isRtl ? "تم تنشيط المسار" : "Path Active" });
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
      toast({ title: isRtl ? "بدء العمل" : "Started" }); 
    } catch (e: any) { toast({ variant: "destructive", title: t('error'), description: e.message }); }
    finally { setProcessingId(null); }
  };

  const handleCompleteStage = async (stage: StageInstance, force: boolean = false) => {
    if (!transactionService || !user || !stage.id) return;
    if (!isDesignProject && !force) {
      const progress = stageProgressMap[stage.technicalStageId];
      if (progress && !progress.canComplete) { setIncompleteStage({ stage, progress }); return; }
    }
    setProcessingId(stage.id);
    try { 
      await transactionService.completeStage(transactionId, stage.id, user.uid, currentUserName, globalUser?.departmentId, force); 
      toast({ title: isRtl ? "إنجاز المرحلة" : "Completed" }); 
      setIncompleteStage(null); 
    } catch (e: any) { toast({ variant: "destructive", title: t('error'), description: e.message }); }
    finally { setProcessingId(null); }
  };

  const handleConfirmRevision = async () => {
    if (!transactionService || !user || !revisionStage || !revisionComment.trim()) return;
    setProcessingId(`rev_${revisionStage.id}`);
    setIsRevisionOpen(false);
    try {
      await transactionService.incrementStageRevision(transactionId, revisionStage.id!, user.uid, currentUserName, revisionComment, globalUser?.departmentId);
      toast({ title: isRtl ? "تم تسجيل المراجعة" : "Revision Logged" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
      setRevisionStage(null);
    }
  };

  const handleReopenStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    if (!confirm(isRtl ? "إعادة فتح المرحلة سيجمد المسار اللاحق. متابعة؟" : "Reopening will freeze subsequent stages. Proceed?")) return;
    setProcessingId(`reopen_${stageId}`);
    try {
      await transactionService.reopenStage(transactionId, stageId, user.uid, currentUserName);
      toast({ title: isRtl ? "تم إعادة الفتح" : "Stage Reopened" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
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

  if (transLoading || stagesLoading || contractsLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-100">
        <div className="flex items-center gap-3 text-start">
           <Badge variant="outline" className="h-6 px-2 font-bold text-[10px] bg-slate-50 border-slate-200">{transaction?.transactionNumber}</Badge>
           <div className="text-start">
              <h1 className="text-xl font-bold text-slate-900 leading-none">{transaction?.subServiceName}</h1>
              <div className="flex items-center gap-2 mt-1">
                 <Badge className={cn("font-bold px-2 h-5 rounded-md text-[9px] uppercase", transaction?.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-0' : 'bg-blue-50 text-blue-600 border-0')}>{transaction?.status}</Badge>
                 <span className="text-[10px] font-medium text-slate-400">{transaction?.activityTypeName}</span>
              </div>
           </div>
        </div>
        <div className="flex gap-2">
           {!isFinancialLockActive && isFieldProject && (
             <>
               {activeBoq ? (
                 <div className="flex gap-2">
                    <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} variant="outline" size="sm" className="h-9 px-4 rounded-md font-bold text-xs gap-1.5">
                        <FileSpreadsheet className="h-3.5 w-3.5" /> {isRtl ? 'المقايسة' : 'BOQ'}
                    </Button>
                    <Button onClick={() => setIsVOOpen(true)} variant="outline" size="sm" className="h-9 px-4 rounded-md font-bold text-xs gap-1.5">
                        <PlusCircle className="h-3.5 w-3.5" /> {isRtl ? 'أمر تغييري' : 'VO'}
                    </Button>
                 </div>
               ) : (
                 <Button onClick={() => setIsBoqInitOpen(true)} variant="outline" size="sm" className="h-9 px-4 rounded-md font-bold text-xs gap-1.5">
                    <FilePlus className="h-3.5 w-3.5" /> {isRtl ? 'إنشاء مقايسة' : 'Create BOQ'}
                 </Button>
               )}
             </>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
             <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                <TabsList className="bg-slate-100/50 p-1 rounded-md h-10 gap-1 shadow-sm mb-6 inline-flex w-fit">
                   <TabsTrigger value="pipeline" className="rounded-sm text-[11px] font-bold px-6 h-full data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                      {isRtl ? 'رادار التنفيذ' : 'Radar'}
                   </TabsTrigger>
                   {canSeeFinance && (
                     <TabsTrigger value="documents" className="rounded-sm text-[11px] font-bold px-6 h-full data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                        {isRtl ? 'المستندات' : 'Docs'}
                     </TabsTrigger>
                   )}
                </TabsList>

                <TabsContent value="pipeline">
                   {isFinancialLockActive ? (
                      <Card className="border-2 border-dashed rounded-lg bg-white p-12 text-center space-y-6">
                         <Lock className="h-10 w-10 text-slate-200 mx-auto" />
                         <div className="space-y-1">
                            <h3 className="text-base font-bold text-slate-900">{isRtl ? 'المسار مقفل - مطلوب ربط مالي' : 'Pipeline Locked'}</h3>
                            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                               {isRtl ? 'يجب إصدار عقد معتمد لبدء العمل الفني والميداني.' : 'Approved contract required to launch technical pipeline.'}
                            </p>
                         </div>
                         <Button onClick={() => setActiveTab('documents')} size="sm" className="h-9 font-bold px-6">
                            <Gavel className="h-4 w-4 me-2" /> {isRtl ? 'إصدار العقد' : 'Go to Contracts'}
                         </Button>
                      </Card>
                   ) : (rawStages || []).length === 0 ? (
                      <Card className="py-20 text-center bg-white rounded-lg border-2 border-dashed space-y-4">
                        <Workflow className="h-10 w-10 text-slate-100 mx-auto" />
                        <div className="space-y-1">
                           <h3 className="text-sm font-bold text-slate-900">{isRtl ? 'بانتظار إطلاق المسار' : 'Awaiting Launch'}</h3>
                           <p className="text-[10px] text-slate-400">{isRtl ? 'تم التحقق من الربط المالي. يمكنك تفعيل مراحل العمل الآن.' : 'Ready. You can now launch technical stages.'}</p>
                        </div>
                        <Button onClick={handleManualInitialize} disabled={loadingAction === 'init'} size="sm" className="h-9 font-bold px-6">
                           <Zap className="h-4 w-4 me-2" /> {isRtl ? 'تفعيل المسار' : 'Launch Path'}
                        </Button>
                      </Card>
                   ) : (
                     <div className="space-y-4 text-start">
                        <div className="flex justify-between items-end px-1">
                           <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /> {isRtl ? 'المسار الفني' : 'Technical Path'}</h3>
                           <span className="text-xl font-bold text-primary">{progressPercent}%</span>
                        </div>

                        <div className="space-y-2">
                           {stages.map((stage, idx) => {
                              const boqProgress = stageProgressMap[stage.technicalStageId];
                              const isPreviousCompleted = idx === 0 || stages[idx-1].status === 'completed';
                              const isOperationalFrontier = stage.status === 'in-progress' || (stage.status === 'pending' && isPreviousCompleted);
                              const isAssignedLocal = globalUser?.employeeId === transaction?.assignedEngineerId;
                              const isDeptAllowed = !stage.allowedDepartmentIds?.length || isAssignedLocal || (globalUser?.departmentId && stage.allowedDepartmentIds.includes(globalUser.departmentId));

                              return (
                                <Card key={stage.id} onClick={() => setFilterStageId(filterStageId === stage.id ? null : stage.id!)} className={cn("rounded-lg shadow-sm border-0 bg-white transition-all border-s-4 cursor-pointer", stage.status === 'completed' ? 'border-s-emerald-500' : stage.status === 'in-progress' ? 'border-s-blue-500' : isOperationalFrontier ? 'border-s-orange-300' : 'border-s-slate-100 opacity-60')}>
                                  <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                     <div className="flex items-center gap-4 flex-1 text-start min-w-0">
                                        <div className={cn("h-8 w-8 rounded-md flex items-center justify-center font-bold text-xs shrink-0", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400")}>
                                           {stage.status === 'completed' ? <Check className="h-4 w-4" /> : (idx + 1)}
                                        </div>
                                        <div className="space-y-1 flex-1 truncate text-start">
                                           <h4 className="font-bold text-sm text-slate-900 truncate">{stage.name}</h4>
                                           {isFieldProject && boqProgress && boqProgress.linkedItemsCount > 0 && (<div className="w-full max-w-[120px] h-1 bg-slate-100 rounded-full overflow-hidden mt-2"><div className="h-full bg-primary" style={{ width: `${boqProgress.progressPercent}%` }} /></div>)}
                                        </div>
                                     </div>
                                     <div className="flex gap-2 shrink-0">
                                           {isOperationalFrontier && (
                                              <>
                                                {stage.status === 'pending' && <Button onClick={(e) => { e.stopPropagation(); handleStartStage(stage.id!); }} size="sm" className="h-7 px-3 rounded-md text-[10px] font-bold">بدء</Button>}
                                                {stage.status === 'in-progress' && <Button onClick={(e) => { e.stopPropagation(); handleCompleteStage(stage); }} size="sm" className="h-7 px-3 rounded-md text-[10px] font-bold bg-emerald-600">إنهاء</Button>}
                                              </>
                                           )}
                                           {(isAdmin || isAssignedLocal) && stage.status === 'completed' && (
                                              <Button onClick={(e) => { e.stopPropagation(); handleReopenStage(stage.id!); }} variant="ghost" size="sm" className="h-7 px-3 rounded-md text-[10px] text-orange-600 hover:bg-orange-50 font-bold"><RotateCcw className="h-3 w-3 me-1" /> فتح</Button>
                                           )}
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
          <div className="lg:col-span-5 h-full">
             <CommentSection transactionId={transactionId} path={paths.transactionComments(companyId!, transactionId)} externalLogs={allExecutions || []} boqItems={boqItems || []} stages={stages} filterStageId={filterStageId} onClearFilter={() => setFilterStageId(null)} />
          </div>
      </div>

      {activeBoq && <VOManagerDialog isOpen={isVOOpen} onClose={() => setIsVOOpen(false)} boqId={activeBoq.id} transactionId={transactionId} boqNumber={activeBoq.boqNumber} boqItems={boqItems || []} />}
    </div>
  );
}
