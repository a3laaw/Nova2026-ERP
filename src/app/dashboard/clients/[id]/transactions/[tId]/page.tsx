'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, Clock, Loader2, 
  ShieldCheck, HardHat, CheckCircle2,
  Lock, Printer, Play, Check,
  FileSpreadsheet, TrendingUp, MessageSquare,
  ChevronDown, Hammer, Plus, Save,
  AlertTriangle,
  Layers,
  Sparkles,
  Search,
  ArrowRight,
  Info,
  RotateCcw
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
import { DocumentService } from '@/services/document-service';
import { BOQ, BOQItem } from '@/types/documents';
import { BOQTemplate } from '@/types/templates';
import { CommentSection } from '@/components/transactions/comment-section';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
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

  // --- States ---
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});
  const [isCreatingBoq, setIsCreatingBoq] = useState(false);
  
  // Progress Recording State
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<StageInstance | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number>(0);
  const [progressNotes, setProgressNotes] = useState("");

  const editAccess = check('projects', 'edit');

  // --- Data Fetching Logic ---
  // 1. جلب بيانات المعاملة الرئيسية
  const transRef = useMemo(() => 
    companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, 
  [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  // 2. جلب مراحل العمل الميدانية
  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order')) : null, 
  [db, companyId, transactionId]);
  const { data: rawStages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  // 3. جلب المقايسة الحية المرتبطة (The BOQ Header)
  const boqQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId), limit(1)) : null, 
  [db, companyId, transactionId]);
  const { data: boqs, loading: boqCheckLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  // 4. سحب البيانات من "جدول البنود الميدانية" (The Source Table: boqItems)
  // المسار: companies/{companyId}/boqs/{boqId}/items
  const itemsQuery = useMemo(() => 
    companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, 
  [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const stages = useMemo(() => {
    return [...(rawStages || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawStages]);

  const executionService = useMemo(() => db && companyId ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  // تحديث نسب الإنجاز بناءً على حركة البنود
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
        resolved.forEach(item => {
          results[item.id] = item.res;
        });

        if (active) {
          setStageProgressMap(prev => {
            const hasChanged = JSON.stringify(prev) !== JSON.stringify(results);
            return hasChanged ? results : prev;
          });
        }
      } catch (e) {
        console.error("Progress fetch error:", e);
      }
    }
    
    fetchAllProgress();
    return () => { active = false; };
  }, [executionService, stages, transactionId, boqItems]); 

  const transactionService = useMemo(() => 
    db && companyId ? new TransactionService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const documentService = useMemo(() => 
    db && companyId ? new DocumentService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  // --- Filtering Logic (الربط الفني) ---
  // يتم سحب البنود من "جدول البنود" وفلترتها بناءً على معرف المرحلة
  const filteredItemsForStage = useMemo(() => {
    if (!boqItems || !targetStage) return [];
    const sId = targetStage.technicalStageId;
    return boqItems.filter(item => 
      (item.technicalStageIds && item.technicalStageIds.includes(sId)) || 
      (item.technicalStageId === sId)
    );
  }, [boqItems, targetStage]);

  // --- Handlers ---
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

  const handleReopenStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try {
      await transactionService.reopenStage(transactionId, stageId, user.uid, user.displayName || 'User');
      toast({ title: isRtl ? "تمت إعادة فتح المرحلة للتعديل" : "Stage Reopened" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateBOQ = async () => {
    if (!documentService || !transaction || !user || !companyId || !db) return;
    setIsCreatingBoq(true);
    try {
      const templatesRef = collection(db, paths.boqTemplates(companyId));
      const q = query(
        templatesRef, 
        where('activityTypeId', '==', transaction.activityTypeId || ''),
        where('serviceId', '==', transaction.serviceId || ''),
        where('subServiceId', '==', transaction.subServiceId || ''),
        where('isDefault', '==', true),
        where('isActive', '==', true),
        limit(1)
      );
      
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error(isRtl ? 'لم يتم العثور على قالب BOQ افتراضي مطابق لهذا المسار.' : 'No matching default BOQ template found.');
      }

      const template = snap.docs[0].data() as BOQTemplate;
      await documentService.instantiateBoqFromTemplate(
        snap.docs[0].id,
        {
          transactionId,
          clientId: transaction.clientId,
          clientName: transaction.clientName,
          activityTypeId: transaction.activityTypeId,
          serviceId: transaction.serviceId,
          subServiceId: transaction.subServiceId,
          name: `${template.name} - ${transaction.transactionNumber}`
        },
        user.uid,
        user.displayName || 'User'
      );

      toast({ title: isRtl ? "تم إنشاء المقايسة التنفيذية بنجاح" : "BOQ Created" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setIsCreatingBoq(false);
    }
  };

  const handleRecordProgress = async () => {
    if (!executionService || !activeBoq || !user || !selectedItemId || !targetStage || progressQty <= 0) {
      return;
    }

    setProcessingId('recording');
    try {
      await executionService.recordBOQItemExecution(
        activeBoq.id,
        selectedItemId,
        targetStage.technicalStageId,
        progressQty,
        user.uid,
        user.displayName || 'User',
        progressNotes
      );

      toast({ title: isRtl ? "تم تسجيل الإنجاز" : "Progress Recorded" });
      setIsRecordOpen(false);
      setSelectedItemId("");
      setProgressQty(0);
      setProgressNotes("");
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const toggleStageCollapse = (id: string) => {
    setOpenStages(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!check('projects', 'view').can) return <div className="h-[60vh] flex flex-col items-center justify-center space-y-4"><Lock className="h-12 w-12 text-rose-500" /><p className="font-black">{isRtl ? 'وصول محجوب' : 'Access Denied'}</p></div>;
  if (transLoading || stagesLoading || boqCheckLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!transaction) return <div className="p-20 text-center font-black text-slate-400">{isRtl ? 'المعاملة غير موجودة' : 'Transaction not found'}</div>;

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
                 <Badge className={cn(
                     "font-black px-3 py-0.5 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                     transaction.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-white'
                 )}>
                     {transaction.status}
                 </Badge>
                 <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                     <Activity className="h-3 w-3 text-primary" /> {transaction.activityTypeName}
                 </span>
              </div>
           </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
           <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="flex-1 md:flex-none h-11 px-6 rounded-xl bg-white border-2 font-black text-xs gap-2 text-primary border-primary/20">
              <FileSpreadsheet className="h-4 w-4" /> {isRtl ? 'تتبع إنجاز المقايسة' : 'BOQ Progress'}
           </Button>
           <Button variant="outline" size="sm" onClick={() => window.print()} className="flex-1 md:flex-none h-11 px-6 rounded-xl bg-white border-2 font-black text-xs gap-2">
              <Printer className="h-4 w-4" /> {isRtl ? 'طباعة' : 'Print'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <div className="bg-slate-900 p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="flex items-center gap-4 text-start">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center text-primary shadow-lg border border-white/5">
                       <FileSpreadsheet className="h-7 w-7" />
                    </div>
                    <div>
                       <h3 className="text-xl font-black font-headline">{isRtl ? 'المقايسة التنفيذية' : 'Executive BOQ'}</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{activeBoq ? activeBoq.boqNumber : (isRtl ? 'لم يتم ربط مقايسة بعد' : 'No BOQ linked')}</p>
                    </div>
                 </div>

                 {activeBoq ? (
                   <div className="flex items-center gap-4">
                      <div className="text-center md:text-end">
                         <p className="text-[9px] font-black text-slate-500 uppercase">{isRtl ? 'إجمالي البنود' : 'Items'}</p>
                         <p className="text-lg font-black text-primary">{boqItems?.length || 0}</p>
                      </div>
                      <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} className="bg-white text-slate-900 font-black h-12 px-6 rounded-xl hover:bg-slate-100 shadow-xl">
                         {isRtl ? 'فتح المقايسة' : 'Open BOQ'}
                         <ArrowRight className={cn("h-4 w-4 ms-2", isRtl && "rotate-180")} />
                      </Button>
                   </div>
                 ) : (
                   <Button 
                     onClick={() => handleCreateBOQ()} 
                     disabled={isCreatingBoq}
                     className="bg-primary text-white font-black h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-3 border-b-4 border-orange-700"
                   >
                      {isCreatingBoq ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                      {isRtl ? 'إنشاء المقايسة من القالب' : 'Create from Template'}
                   </Button>
                 )}
              </div>
           </Card>

           <div className="space-y-6">
              <div className="flex justify-between items-end px-2">
                 <div className="text-start">
                    <h3 className="text-xl font-black font-headline text-slate-800 flex items-center gap-2">
                       <TrendingUp className="h-6 w-6 text-primary" />
                       {isRtl ? 'مسار التنفيذ الميداني المعتمد' : 'Execution Pipeline'}
                    </h3>
                    <p className="text-xs font-bold text-slate-400">{isRtl ? 'متابعة مراحل العمل بالتسلسل الهندسي' : 'Tracking stages'}</p>
                 </div>
                 <div className="text-end">
                    <span className="text-4xl font-black font-headline text-primary">{progressPercent}%</span>
                 </div>
              </div>
              
              <div className="space-y-4">
                 {stages.map((stage, idx) => {
                    const boqProgress = stageProgressMap[stage.technicalStageId];
                    const isOpen = openStages[stage.id!];

                    return (
                      <Card key={stage.id} className={cn(
                        "border-0 shadow-lg rounded-[2.5rem] bg-white transition-all overflow-hidden border-s-8",
                        stage.status === 'completed' ? 'border-s-emerald-500 opacity-80' : 
                        stage.status === 'in-progress' ? 'border-s-blue-500 ring-4 ring-blue-500/5' : 'border-s-orange-300'
                      )}>
                        <CardContent className="p-0">
                           <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                              <div className="flex items-center gap-6 flex-1 text-start">
                                 <div className={cn(
                                    "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border",
                                    stage.status === 'completed' ? "bg-emerald-500 text-white" : "bg-white"
                                 )}>
                                    {stage.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : (idx + 1)}
                                 </div>
                                 <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                       <h4 className="font-black text-lg text-slate-900 tracking-tight">{stage.name}</h4>
                                    </div>
                                    
                                    {boqProgress && boqProgress.linkedItemsCount > 0 && (
                                      <div className="mt-2 space-y-1.5">
                                         <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                                            <span className="flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" /> {isRtl ? 'إنجاز البنود المرتبطة' : 'Linked BOQ Items'}</span>
                                            <span>{boqProgress.progressPercent}%</span>
                                         </div>
                                         <Progress value={boqProgress.progressPercent} className="h-1.5" />
                                      </div>
                                    )}
                                 </div>
                              </div>

                              <div className="flex gap-2 shrink-0">
                                 {stage.status === 'in-progress' && editAccess.can && (
                                    <Button 
                                      onClick={() => { setTargetStage(stage); setIsRecordOpen(true); }}
                                      variant="outline"
                                      className="h-11 px-4 rounded-xl border-2 border-primary/20 text-primary font-black text-xs gap-2 hover:bg-primary/5"
                                    >
                                       <Hammer className="h-4 w-4" />
                                       {isRtl ? 'تسجيل إنجاز' : 'Log Qty'}
                                    </Button>
                                 )}

                                 <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => toggleStageCollapse(stage.id!)}
                                    className={cn("h-11 w-11 rounded-xl text-slate-300 hover:text-primary transition-all", isOpen && "bg-primary/5 text-primary")}
                                 >
                                    <MessageSquare className="h-5 w-5" />
                                 </Button>

                                 {stage.status === 'pending' && (
                                    <Button 
                                      onClick={() => handleStartStage(stage.id!)} 
                                      disabled={processingId === stage.id}
                                      className="h-11 px-6 rounded-xl bg-blue-600 text-white font-black text-xs gap-2 shadow-lg shadow-blue-900/10"
                                    >
                                       {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />}
                                       {isRtl ? 'بدء العمل' : 'Start'}
                                    </Button>
                                 )}
                                 {stage.status === 'in-progress' && (
                                    <Button 
                                      onClick={() => handleCompleteStage(stage)} 
                                      disabled={processingId === stage.id}
                                      className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-black text-xs gap-2 shadow-lg shadow-emerald-900/10"
                                    >
                                       {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />}
                                       {isRtl ? 'إكمال المرحلة' : 'Complete'}
                                    </Button>
                                 )}

                                 {stage.status === 'completed' && editAccess.can && (
                                    <Button 
                                      onClick={() => handleReopenStage(stage.id!)} 
                                      disabled={processingId === stage.id}
                                      variant="ghost"
                                      className="h-11 px-4 rounded-xl text-amber-600 font-black text-xs gap-2 hover:bg-amber-50"
                                    >
                                       {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                                       {isRtl ? 'تراجع' : 'Undo'}
                                    </Button>
                                 )}
                              </div>
                           </div>

                           <Collapsible open={isOpen}>
                              <CollapsibleContent className="animate-in slide-in-from-top-2 duration-300">
                                 <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                                    <CommentSection 
                                      transactionId={transactionId} 
                                      stageInstanceId={stage.id} 
                                      path={paths.stageComments(companyId!, transactionId, stage.id!)}
                                      title={isRtl ? 'نقاشات المرحلة الميدانية' : 'Stage Field Discussion'}
                                      compact
                                    />
                                 </div>
                              </CollapsibleContent>
                           </Collapsible>
                        </CardContent>
                      </Card>
                    );
                 })}
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 flex flex-col h-full min-h-[600px]">
              <CardHeader className="bg-slate-50/50 border-b p-6">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {isRtl ? 'غرفة عمليات المعاملة' : 'Transaction War Room'}
                 </CardTitle>
                 <CardDescription className="font-bold text-[10px] mt-1">{isRtl ? 'نقاشات عامة غير مرتبطة بمرحلة معينة.' : 'General discussions.'}</CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-1">
                 <CommentSection 
                   transactionId={transactionId} 
                   path={paths.transactionComments(companyId!, transactionId)}
                 />
              </CardContent>
           </Card>
        </div>
      </div>

      {/* --- Progress Recording Dialog --- */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
            <div className="bg-primary/5 p-8 text-slate-900 text-start border-b">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <Hammer className="h-7 w-7 text-primary" />
                  {isRtl ? 'تسجيل إنجاز ميداني' : 'Record Field Execution'}
               </DialogTitle>
               <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">{targetStage?.name}</p>
            </div>

            <div className="p-8 space-y-6 text-start">
               {!activeBoq ? (
                  <div className="p-10 text-center border-2 border-dashed rounded-3xl bg-slate-50">
                     <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-4" />
                     <p className="font-black text-slate-600">{isRtl ? "لا توجد مقايسة مرتبطة بهذه المعاملة" : "No BOQ linked to this transaction"}</p>
                  </div>
               ) : (
                 <>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          {isRtl ? "بند المقايسة المتاح لهذه المرحلة" : "Available BOQ Item"}
                       </Label>
                       <p className="text-[8px] text-slate-400 font-bold mb-2">
                          {isRtl 
                            ? 'يسحب البيانات من: companies/{companyId}/boqs/{boqId}/items' 
                            : 'Data source: companies/{companyId}/boqs/{boqId}/items'}
                       </p>
                       <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/30">
                             <SelectValue placeholder={isRtl ? "اختر البند الميداني..." : "Select item..."} />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-2 shadow-2xl">
                             {filteredItemsForStage.length === 0 ? (
                               <div className="p-6 text-center space-y-3">
                                  <Info className="h-6 w-6 mx-auto text-blue-400" />
                                  <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed">
                                     {isRtl ? "لا توجد بنود مرتبطة بهذه المرحلة في القاموس المرجعي." : "No items linked to this stage in registry."}
                                  </p>
                                  <p className="text-[9px] text-slate-300 font-bold leading-relaxed px-4">
                                     {isRtl ? "تنبيه: المهندس في الموقع لن يرى هذا البند إلا إذا قمت بربطه بالمراحل (الإعدادات > شجرة الأعمال)." : "Engineer in field won't see this item unless linked to stages in settings."}
                                  </p>
                               </div>
                             ) : (
                               filteredItemsForStage.map(item => (
                                 <SelectItem key={item.id} value={item.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                                    <div className="flex flex-col text-start">
                                       <span>{item.referenceTitle}</span>
                                       <span className="text-[8px] text-slate-400 font-black uppercase">{item.referenceCode} | Qty: {item.plannedQuantity} {item.unitSymbol}</span>
                                    </div>
                                 </SelectItem>
                               ))
                             )}
                          </SelectContent>
                       </Select>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? "الكمية المنفذة" : "Executed Quantity"}</Label>
                       <div className="relative">
                          <input 
                            type="number" 
                            value={progressQty} 
                            onChange={e => setProgressQty(Number(e.target.value))}
                            className="h-14 w-full rounded-2xl border-2 font-black text-xl text-primary text-center outline-none focus:border-primary/50 transition-all" 
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">QTY</div>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? "ملاحظات التنفيذ" : "Field Notes"}</Label>
                       <Textarea 
                         value={progressNotes} 
                         onChange={e => setProgressNotes(e.target.value)}
                         className="min-h-[100px] rounded-2xl border-2 bg-slate-50/30 p-4 text-xs font-bold"
                         placeholder="..."
                       />
                    </div>
                 </>
               )}
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">إلغاء</Button>
               <Button 
                 onClick={handleRecordProgress} 
                 disabled={!activeBoq || !selectedItemId || progressQty <= 0 || processingId === 'recording'}
                 className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-2 border-b-4 border-orange-700"
               >
                  {processingId === 'recording' ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  {isRtl ? "تأكيد التسجيل" : "Confirm Record"}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
