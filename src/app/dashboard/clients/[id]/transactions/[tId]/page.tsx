'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, Clock, Loader2, 
  CheckCircle2, Check,
  FileSpreadsheet,
  Zap, Workflow,
  PlusCircle, ArrowRight,
  Info, Sparkles, FilePlus, ShieldCheck,
  Lock, Wallet,
  Gavel, Trash2, RotateCcw,
  LayoutGrid
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, orderBy, where, limit, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { BOQ, Contract } from '@/types/documents';
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function TransactionDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const clientId = params?.id as string;
  const transactionId = params?.tId as string;
  
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions, isAdmin, check } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [activeTab, setActiveTab] = useState('pipeline');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const [isBoqInitOpen, setIsBoqInitOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const canSeeFinance = check('accounting', 'view').can || check('procurement', 'view').can;
  const currentUserName = useMemo(() => globalUser?.fullName || user?.displayName || 'Engineer', [globalUser, user]);

  // 1. جلب بيانات المعاملة الأساسية
  const transRef = useMemo(() => (companyId && db && transactionId) ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  // 2. جلب العقود للتحقق من القفل المالي
  const contractsQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.contracts(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: contracts } = useCollection<Contract>(contractsQuery);
  
  // 3. الحل السيادي لاختفاء المقايسة: جلب الكل والفلترة في الذاكرة (Memory Filtering)
  const boqQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.boqs(companyId))) : null, [db, companyId]);
  const { data: allBoqs } = useCollection<BOQ>(boqQuery);
  
  const activeBoq = useMemo(() => {
    return allBoqs?.find(b => b.transactionId === transactionId);
  }, [allBoqs, transactionId]);

  // منطق القفل المالي الصارم
  const isFinancialLockActive = useMemo(() => {
     const hasApprovedContract = contracts?.some(c => ['approved', 'paid', 'active', 'signed'].includes(c.status || '') || c.isPaid);
     const hasApprovedBOQ = activeBoq?.status === 'approved';
     return !hasApprovedContract || !hasApprovedBOQ;
  }, [contracts, activeBoq]);

  const isFieldProject = useMemo(() => transaction?.activityTypeName?.includes('مقاولات') || transaction?.activityTypeName?.includes('Construction'), [transaction]);

  // 4. جلب مراحل التنفيذ
  const stagesQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order', 'asc')) : null, [db, companyId, transactionId]);
  const { data: rawStages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  // 5. جلب قوالب المقايسات المتاحة لهذا المسار
  const templatesQuery = useMemo(() => (companyId && db && transaction?.subServiceId) ? query(collection(db, paths.boqTemplates(companyId)), where('subServiceId', '==', transaction.subServiceId)) : null, [db, companyId, transaction]);
  const { data: templates } = useCollection<BOQTemplate>(templatesQuery);

  const stages = useMemo(() => (rawStages || []).sort((a, b) => (a.order || 0) - (b.order || 0)), [rawStages]);
  const progressPercent = useMemo(() => stages.length ? Math.round((stages.filter(s => s.status === 'completed').length / stages.length) * 100) : 0, [stages]);

  const transactionService = useMemo(() => (db && companyId) ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try { 
      await transactionService.startStage(transactionId, stageId, user.uid, currentUserName, globalUser?.departmentId); 
      toast({ title: t('common.active') }); 
    }
    catch (e: any) { 
      toast({ variant: "destructive", title: t('common.error'), description: e.message }); 
    }
    finally { setProcessingId(null); }
  };

  const handleCompleteStage = async (stage: StageInstance) => {
    if (!transactionService || !user || !stage.id) return;
    setProcessingId(stage.id);
    try { 
      await transactionService.completeStage(transactionId, stage.id, user.uid, currentUserName, globalUser?.departmentId); 
      toast({ title: t('common.completed') }); 
    }
    catch (e: any) { 
      toast({ variant: "destructive", title: t('common.error'), description: e.message }); 
    }
    finally { setProcessingId(null); }
  };

  const handleRevertStage = async (stage: StageInstance) => {
    if (!db || !companyId || !user || !stage.id) return;
    const reason = prompt(isRtl ? "سبب التراجع عن اكتمال المرحلة:" : "Reason for reverting stage completion:");
    if (!reason) return;

    setProcessingId(stage.id);
    try {
      const stageRef = doc(db, paths.transactionStages(companyId, transactionId), stage.id);
      await updateDoc(stageRef, {
        status: 'in-progress',
        completedAt: null,
        completedBy: null,
        revertedAt: serverTimestamp(),
        reversionReason: reason,
        updatedAt: serverTimestamp()
      });

      const timelineRef = collection(db, paths.transactionTimeline(companyId, transactionId));
      await addDoc(timelineRef, {
        transactionId,
        stageId: stage.id,
        type: 'revision_logged',
        content: `[تراجع إداري] تم إعادة فتح المرحلة "${stage.name}". المبرر: ${reason}`,
        userId: user.uid,
        userName: currentUserName,
        companyId,
        createdAt: serverTimestamp()
      });

      toast({ title: isRtl ? "تم التراجع عن المرحلة" : "Stage Reverted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setProcessingId(null);
    }
  };

  const handleManualInitialize = async () => {
    if (!transactionService || !transaction || !user) return;
    setLoadingAction('init');
    try { 
      await transactionService.initializeTechnicalPath(transactionId, transaction.activityTypeId, transaction.serviceId, transaction.subServiceId, user.uid); 
      toast({ title: t('common.active') }); 
    }
    catch (e: any) { 
      toast({ variant: "destructive", title: t('common.error'), description: e.message }); 
    }
    finally { setLoadingAction(null); }
  };

  const handleCreateBOQ = async () => {
    if (!db || !companyId || !user || !selectedTemplateId || !transaction) return;
    setLoadingAction('creating_boq');
    try {
      const service = new DocumentService(db, companyId, permissions);
      const template = templates?.find(t => t.id === selectedTemplateId);
      await service.instantiateBoqFromTemplate(selectedTemplateId, { 
        transactionId, 
        clientId, 
        clientName: transaction.clientName, 
        activityTypeId: transaction.activityTypeId, 
        serviceId: transaction.serviceId, 
        subServiceId: transaction.subServiceId, 
        name: template?.name || "" 
      }, user.uid, currentUserName);
      toast({ title: t('common.saved') });
      setIsBoqInitOpen(false);
    } catch (e: any) { 
      toast({ variant: "destructive", title: t('common.error'), description: e.message }); 
    }
    finally { setLoadingAction(null); }
  };

  const safePush = (path: string) => {
    if (clientId && transactionId) {
      router.push(path);
    }
  };

  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-100">
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
           {isFieldProject && (
             <div className="flex gap-2">
                {activeBoq ? (
                  <Button onClick={() => safePush(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} variant="outline" size="sm" className={cn("h-8 px-3 rounded-md font-bold text-[10px] gap-1.5 border-slate-200 shadow-sm", activeBoq.status !== 'approved' && "border-amber-200 bg-amber-50 text-amber-600")}>
                      <FileSpreadsheet className="h-3 w-3" /> {activeBoq.status === 'approved' ? (isRtl ? 'المقايسة المعتمدة' : 'BOQ') : (isRtl ? 'بانتظار الاعتماد' : 'Awaiting Approval')}
                  </Button>
                ) : (
                  <Button onClick={() => setIsBoqInitOpen(true)} variant="outline" size="sm" className="h-8 px-3 rounded-md font-bold text-[10px] gap-1.5 border-slate-200 shadow-sm">
                     <FilePlus className="h-3.5 w-3.5" /> {isRtl ? 'إنشاء مقايسة' : 'Create BOQ'}
                  </Button>
                )}
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
             <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                <TabsList className="bg-slate-100/50 p-1 rounded-md h-9 gap-1 shadow-sm mb-4 inline-flex">
                   <TabsTrigger value="pipeline" className="rounded-sm text-[10px] font-black px-4 h-full data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                      {t('projects.details.radar')}
                   </TabsTrigger>
                   {canSeeFinance && (
                     <TabsTrigger value="documents" className="rounded-sm text-[10px] font-black px-4 h-full data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                        {t('projects.details.finance')}
                     </TabsTrigger>
                   )}
                </TabsList>

                <TabsContent value="pipeline">
                   {isFinancialLockActive ? (
                      <Card className="border-2 border-dashed rounded-[1.5rem] bg-white p-12 text-center space-y-4">
                         <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto"><Lock className="h-8 w-8 text-slate-200" /></div>
                         <div className="space-y-1">
                            <h3 className="text-sm font-black text-slate-900">{isRtl ? 'المسار الفني مقفل' : 'Technical Path Locked'}</h3>
                            <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed font-bold italic">
                               {t('projects.details.locked')}
                            </p>
                         </div>
                         <div className="flex justify-center gap-3 pt-4">
                            <Button onClick={() => setActiveTab('documents')} variant="outline" size="sm" className="h-8 font-bold px-6 text-[10px] rounded-md shadow-sm border-2">
                               <Gavel className="h-3.5 w-3.5 me-2" /> {isRtl ? 'إصدار العقد' : 'Contracts'}
                            </Button>
                            <Button onClick={() => safePush(`/dashboard/clients/${clientId}/transactions/${transactionId}/boq`)} size="sm" className="h-8 font-bold px-6 text-[10px] rounded-md shadow-sm">
                               <FileSpreadsheet className="h-3.5 w-3.5 me-2" /> {isRtl ? 'اعتماد المقايسة' : 'BOQ Baseline'}
                            </Button>
                         </div>
                      </Card>
                   ) : !stages.length ? (
                      <Card className="py-20 text-center bg-white rounded-lg border-2 border-dashed space-y-4 shadow-none">
                        <Workflow className="h-8 w-8 text-slate-100 mx-auto" />
                        <h3 className="text-xs font-bold text-slate-900">{isRtl ? 'بانتظار إطلاق المسار' : 'Awaiting Launch'}</h3>
                        <Button onClick={handleManualInitialize} disabled={loadingAction === 'init'} size="sm" className="h-8 font-bold px-6 text-[10px] rounded-md shadow-sm">
                           <Zap className="h-3.5 w-3.5 me-2" /> {isRtl ? 'تفعيل المسار' : 'Launch Path'}
                        </Button>
                      </Card>
                   ) : (
                     <div className="space-y-3 text-start animate-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-end px-1">
                           <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Workflow className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'المسار الفني التنفيذي' : 'Technical Execution Path'}</h3>
                           <span className="text-sm font-black text-primary">{progressPercent}%</span>
                        </div>
                        <div className="space-y-1.5">
                           {stages.map((stage, idx) => {
                              const isOperationalFrontier = stage.status === 'in-progress' || (stage.status === 'pending' && (idx === 0 || stages[idx-1].status === 'completed'));
                              return (
                                <Card key={stage.id} className={cn("rounded-md shadow-none border bg-white transition-all border-s-4", stage.status === 'completed' ? 'border-s-emerald-500' : stage.status === 'in-progress' ? 'border-s-blue-500' : 'border-s-slate-100 opacity-70')}>
                                  <CardContent className="p-3 flex items-center justify-between gap-4">
                                     <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={cn("h-6 w-6 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400")}>{stage.status === 'completed' ? <Check className="h-3 w-3" /> : (idx + 1)}</div>
                                        <h4 className="font-bold text-xs text-slate-900 truncate">{stage.name}</h4>
                                     </div>
                                     <div className="flex gap-1.5 items-center">
                                           {isOperationalFrontier && (
                                              <>
                                                {stage.status === 'pending' && <Button onClick={(e) => { e.stopPropagation(); handleStartStage(stage.id!); }} size="sm" className="h-7 px-3 rounded-md text-[10px] font-bold bg-primary shadow-sm hover:brightness-105">
                                                  {processingId === stage.id ? <Loader2 className="h-3 w-3 animate-spin" /> : (isRtl ? 'بدء' : 'Start')}
                                                </Button>}
                                                {stage.status === 'in-progress' && <Button onClick={(e) => { e.stopPropagation(); handleCompleteStage(stage); }} size="sm" className="h-7 px-3 rounded-md text-[10px] font-bold bg-emerald-600 shadow-sm hover:brightness-105">
                                                  {processingId === stage.id ? <Loader2 className="h-3 w-3 animate-spin" /> : (isRtl ? 'إنهاء' : 'Finish')}
                                                </Button>}
                                              </>
                                           )}
                                           {(isAdmin) && stage.status === 'completed' && (
                                              <Button onClick={(e) => { e.stopPropagation(); handleRevertStage(stage); }} variant="ghost" size="icon" className="h-7 w-7 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50">
                                                {processingId === stage.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                              </Button>
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
          <div className="lg:col-span-5 h-full min-h-[500px]">
             <CommentSection transactionId={transactionId} path={paths.transactionComments(companyId!, transactionId)} stages={stages} />
          </div>
      </div>

      <Dialog open={isBoqInitOpen} onOpenChange={setIsBoqInitOpen}>
         <DialogContent className="rounded-xl max-w-md p-0 overflow-hidden border shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 border-b text-start"><DialogTitle className="text-base font-black flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {isRtl ? 'تنشيط المقايسة المرجعية' : 'Activate BOQ Template'}</DialogTitle></div>
            <div className="p-8 space-y-4 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اختر القالب الهندسي' : 'Select Template'}</Label>
               <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-black text-lg">
                     <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 shadow-2xl">
                     {templates?.map(t => <SelectItem key={t.id} value={t.id!} className="font-bold py-4">{t.name}</SelectItem>)}
                  </SelectContent>
               </Select>
               <Button onClick={handleCreateBOQ} disabled={!selectedTemplateId || !!loadingAction} className="w-full h-14 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 border-b-4 border-orange-700 mt-4 transition-all active:scale-95">
                  {loadingAction === 'creating_boq' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-2" />} {isRtl ? 'تنشيط وبدء الدراسة' : 'Instantiate & Start Study'}
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
