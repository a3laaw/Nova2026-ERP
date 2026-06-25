'use client';

import { useMemo, useState, useEffect } from 'react';
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
  ChevronDown
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
import { CommentSection } from '@/components/transactions/comment-section';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";

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

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});

  const viewAccess = check('projects', 'view');

  const transRef = useMemo(() => 
    companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, 
  [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order')) : null, 
  [db, companyId, transactionId]);
  const { data: rawStages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  const stages = useMemo(() => {
    return [...rawStages].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawStages]);

  const executionService = useMemo(() => db && companyId ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    if (executionService && stages.length > 0) {
      stages.forEach(async (s) => {
        const res = await executionService.getTechnicalStageProgress(transactionId, s.technicalStageId);
        setStageProgressMap(prev => ({ ...prev, [s.technicalStageId]: res }));
      });
    }
  }, [executionService, stages, transactionId]);

  const transactionService = useMemo(() => 
    db && companyId ? new TransactionService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const isStageBlocked = (stage: StageInstance) => {
    if (!stages) return false;
    return stages.some(other => 
      other.nextStageIds?.includes(stage.technicalStageId) && 
      other.status !== 'completed'
    );
  };

  const getRequiredPredecessors = (stage: StageInstance) => {
    if (!stages) return [];
    return stages.filter(other => 
      other.nextStageIds?.includes(stage.technicalStageId) && 
      other.status !== 'completed'
    );
  };

  const progressPercent = useMemo(() => {
    if (!stages?.length) return 0;
    const completed = stages.filter(s => s.status === 'completed').length;
    return Math.round((completed / stages.length) * 100);
  }, [stages]);

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
    if (!transactionService || !user) return;
    setProcessingId(stage.id!);
    try {
      await transactionService.completeStage(transactionId, stage.id!, user.uid, user.displayName || 'User');
      toast({ title: isRtl ? "تم إنجاز المرحلة بنجاح" : "Stage Completed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: isRtl ? "تعذر إغلاق المرحلة" : "Cannot Close Stage", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const toggleStageCollapse = (id: string) => {
    setOpenStages(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!viewAccess.can) return <div className="h-[60vh] flex flex-col items-center justify-center space-y-4"><Lock className="h-12 w-12 text-rose-500" /><p className="font-black">{isRtl ? 'وصول محجوب' : 'Access Denied'}</p></div>;
  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!transaction) return <div className="p-20 text-center font-black text-slate-400">{isRtl ? 'المعاملة غير موجودة' : 'Transaction not found'}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="text-start">
             <div className="flex items-center gap-4 flex-wrap">
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
        {/* Main Pipeine (Left) */}
        <div className="lg:col-span-8 space-y-8">
           <div className="space-y-6">
              <div className="flex justify-between items-end px-2">
                 <div className="text-start">
                    <h3 className="text-xl font-black font-headline text-slate-800 flex items-center gap-2">
                       <TrendingUp className="h-6 w-6 text-primary" />
                       {isRtl ? 'مسار التنفيذ الميداني المعتمد' : 'Execution Pipeline'}
                    </h3>
                    <p className="text-xs font-bold text-slate-400">{isRtl ? 'متابعة مراحل العمل بالتسلسل الهندسي' : 'Tracking stages in strict sequence'}</p>
                 </div>
                 <div className="text-end">
                    <span className="text-4xl font-black font-headline text-primary">{progressPercent}%</span>
                 </div>
              </div>
              
              <div className="space-y-4">
                 {stages?.map((stage, idx) => {
                    const blocked = isStageBlocked(stage);
                    const predecessors = getRequiredPredecessors(stage);
                    const boqProgress = stageProgressMap[stage.technicalStageId];
                    const isOpen = openStages[stage.id!];

                    return (
                      <Card key={stage.id} className={cn(
                        "border-0 shadow-lg rounded-[2.5rem] bg-white transition-all overflow-hidden border-s-8",
                        stage.status === 'completed' ? 'border-s-emerald-500 opacity-80' : 
                        stage.status === 'in-progress' ? 'border-s-blue-500 ring-4 ring-blue-500/5' : 
                        blocked ? 'border-s-slate-100 opacity-60 bg-slate-50/50' : 'border-s-orange-300'
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
                                       {blocked && <Badge variant="outline" className="text-[7px] font-black bg-slate-100 text-slate-400 border-0 uppercase">Locked</Badge>}
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

                                    {blocked && predecessors.length > 0 && (
                                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-400 bg-rose-50 px-2 py-0.5 rounded-lg w-fit mt-2">
                                         <Lock className="h-2 w-2" />
                                         {isRtl ? 'بانتظار:' : 'Requires:'} {predecessors.map(p => p.name).join(', ')}
                                      </div>
                                    )}
                                 </div>
                              </div>

                              <div className="flex gap-2 shrink-0">
                                 <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => toggleStageCollapse(stage.id!)}
                                    className={cn("h-11 w-11 rounded-xl text-slate-300 hover:text-primary transition-all", isOpen && "bg-primary/5 text-primary")}
                                 >
                                    <MessageSquare className="h-5 w-5" />
                                 </Button>

                                 {stage.status === 'pending' && !blocked && (
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

        {/* Sidebar (Right) */}
        <div className="lg:col-span-4 space-y-8">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 flex flex-col h-full min-h-[600px]">
              <CardHeader className="bg-slate-50/50 border-b p-6">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {isRtl ? 'غرفة عمليات المعاملة' : 'Transaction War Room'}
                 </CardTitle>
                 <CardDescription className="font-bold text-[10px] mt-1">{isRtl ? 'نقاشات عامة غير مرتبطة بمرحلة معينة.' : 'General discussions non-stage specific.'}</CardDescription>
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
    </div>
  );
}
