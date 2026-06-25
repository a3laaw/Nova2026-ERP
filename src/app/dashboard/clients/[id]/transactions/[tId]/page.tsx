
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, Clock, Loader2, 
  History, ShieldCheck, HardHat, ListChecks, 
  Timer, LayoutGrid, CheckCircle2,
  AlertCircle, Lock, User, Printer, Play, Check, Save,
  RotateCcw, Plus
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance, TransactionTimelineEvent } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

  const viewAccess = check('projects', 'view');
  const canEdit = check('projects', 'edit').can;

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

  const timelineQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionTimeline(companyId, transactionId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId, transactionId]);
  const { data: timeline, loading: timelineLoading } = useCollection<TransactionTimelineEvent>(timelineQuery);

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
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try {
      await transactionService.completeStage(transactionId, stageId, user.uid, user.displayName || 'User');
      toast({ title: isRtl ? "تم إنجاز المرحلة بنجاح" : "Stage Completed" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReopenStage = async (stageId: string) => {
    if (!transactionService || !user) return;
    setProcessingId(stageId);
    try {
      await transactionService.reopenStage(transactionId, stageId, user.uid, user.displayName || 'User');
      toast({ title: isRtl ? "تم إعادة فتح المرحلة للمراجعة" : "Stage Reopened" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateCount = async (stage: StageInstance) => {
    if (!transactionService || !user) return;
    const newCount = (stage.currentCount || 0) + 1;
    setProcessingId(`count_${stage.id}`);
    try {
      await transactionService.updateStageCount(transactionId, stage.id!, newCount, user.uid, user.displayName || 'User');
      toast({ title: isRtl ? "تم تحديث الإنجاز" : "Count Updated" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessingId(null);
    }
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
                          transaction.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
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
           <Button variant="outline" size="sm" onClick={() => window.print()} className="flex-1 md:flex-none h-11 px-6 rounded-xl bg-white border-2 font-black text-xs gap-2">
              <Printer className="h-4 w-4" /> {isRtl ? 'طباعة' : 'Print'}
           </Button>
           <Button size="sm" className="flex-1 md:flex-none h-11 px-6 rounded-xl bg-primary text-white font-black text-xs shadow-lg shadow-primary/20">
              {isRtl ? 'إرسال تحديث' : 'Send Update'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <div className="bg-slate-50/50 p-8 border-b grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'العميل' : 'Client'}</p>
                    <p className="text-sm font-black text-slate-800">{transaction.clientName}</p>
                 </div>
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'المهندس المسؤول' : 'Engineer'}</p>
                    <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                       <HardHat className="h-4 w-4 text-primary" /> {transaction.assignedEngineerName}
                    </p>
                 </div>
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'تاريخ البدء' : 'Start Date'}</p>
                    <p className="text-sm font-black text-slate-800 font-mono">{transaction.createdAt?.toDate().toLocaleDateString()}</p>
                 </div>
              </div>
              <CardContent className="p-8 text-start">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{isRtl ? 'وصف المتطلبات' : 'Requirements Description'}</p>
                 <p className="text-slate-600 leading-relaxed italic">{transaction.description || (isRtl ? 'لا يوجد وصف.' : 'No description.')}</p>
              </CardContent>
           </Card>

           <div className="space-y-6">
              <div className="flex justify-between items-end px-2">
                 <div className="text-start">
                    <h3 className="text-xl font-black font-headline text-slate-800 flex items-center gap-2">
                       <LayoutGrid className="h-6 w-6 text-primary" />
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

                    return (
                      <Card key={stage.id} className={cn(
                        "border-0 shadow-lg rounded-[2rem] bg-white transition-all overflow-hidden border-s-8",
                        stage.status === 'completed' ? 'border-s-emerald-500 opacity-80' : 
                        stage.status === 'in-progress' ? 'border-s-blue-500 ring-4 ring-blue-500/5' : 
                        blocked ? 'border-s-slate-100 opacity-60 bg-slate-50/50' : 'border-s-orange-300'
                      )}>
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                           <div className="flex items-center gap-6 flex-1 text-start">
                              <div className={cn(
                                 "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border",
                                 stage.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : (idx + 1)
                              )}>
                                 {stage.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : (idx + 1)}
                              </div>
                              <div className="space-y-1">
                                 <div className="flex items-center gap-2">
                                    <h4 className="font-black text-lg text-slate-900 tracking-tight">{stage.name}</h4>
                                    {blocked && <Badge variant="outline" className="text-[7px] font-black bg-slate-100 text-slate-400 border-0 uppercase">Locked</Badge>}
                                 </div>
                                 {blocked && predecessors.length > 0 && (
                                   <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-400 bg-rose-50 px-2 py-0.5 rounded-lg w-fit">
                                      <Lock className="h-2 w-2" />
                                      {isRtl ? 'بانتظار:' : 'Requires:'} {predecessors.map(p => p.name).join(', ')}
                                   </div>
                                 )}
                                 <div className="flex flex-wrap gap-3 mt-1">
                                    {stage.isNumeric && (
                                       <div className="flex items-center gap-3">
                                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[10px] font-black border-emerald-100 border gap-1 px-3 py-1">
                                             <ListChecks className="h-3 w-3" /> {isRtl ? 'الإنجاز:' : 'Qty:'} {stage.currentCount} / {stage.numericTarget}
                                          </Badge>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </CardContent>
                      </Card>
                    );
                 })}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
