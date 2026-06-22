'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  ArrowRight, Activity, Clock, Loader2, 
  CheckCircle2, AlertCircle, History, 
  ShieldCheck, HardHat, ListChecks, Timer,
  PlayCircle, MoreHorizontal, UserCog, Send
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance, TransactionTimelineEvent } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function TransactionExecutionPage() {
  const params = useParams();
  const clientId = params.id as string;
  const transactionId = params.tId as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 1. جلب بيانات المعاملة
  const transRef = useMemo(() => 
    companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, 
  [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  // 2. جلب المراحل التنفيذية (Runtime Instances)
  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order')) : null, 
  [db, companyId, transactionId]);
  const { data: stages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  // 3. جلب السجل الزمني
  const timelineQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionTimeline(companyId, transactionId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId, transactionId]);
  const { data: timeline, loading: timelineLoading } = useCollection<TransactionTimelineEvent>(timelineQuery);

  const transService = useMemo(() => 
    db && companyId ? new TransactionService(db, companyId) : null, 
  [db, companyId]);

  const handleStart = async (stage: StageInstance) => {
    if (!transService || !user) return;
    setUpdatingId(stage.id!);
    try {
      await transService.startStage(transactionId, stage.id!, stage.name, user.uid, user.displayName || 'System');
      toast({ title: isRtl ? 'تم بدء المرحلة' : 'Stage Started' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleComplete = async (stage: StageInstance) => {
    if (!transService || !user) return;
    setUpdatingId(stage.id!);
    try {
      await transService.completeStage(transactionId, stage.id!, stage.name, user.uid, user.displayName || 'System');
      toast({ title: isRtl ? 'تم إنجاز المرحلة' : 'Stage Completed' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateNumeric = async (stage: StageInstance, value: number) => {
    if (!transService || !user) return;
    try {
      await transService.updateStageNumeric(transactionId, stage.id!, stage.name, value, user.uid, user.displayName || 'System');
    } catch (e) {}
  };

  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!transaction) return <div className="p-20 text-center">{isRtl ? 'المعاملة غير موجودة' : 'Transaction not found'}</div>;

  const progressPercent = stages?.length ? Math.round((stages.filter(s => s.status === 'completed').length / stages.length) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4 md:gap-8 flex-wrap">
          <Button 
            variant="ghost" 
            onClick={() => router.push(`/dashboard/clients/${clientId}`)} 
            className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all shrink-0"
          >
            <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-4 flex-wrap">
                <div className="h-16 px-6 w-fit min-w-[4rem] rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-black text-2xl border-2 border-primary/20 shadow-inner">
                   {transaction.transactionNumber}
                </div>
                <div className="min-w-[200px]">
                   <Badge className={cn(
                      "font-black px-4 py-1.5 rounded-xl border-0 shadow-sm uppercase text-[10px] mb-2",
                      transaction.status === 'completed' ? 'bg-emerald-500 text-white' : 
                      transaction.status === 'in-progress' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
                   )}>
                      {transaction.status.replace('-', ' ')}
                   </Badge>
                   <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight leading-tight">{transaction.subServiceName}</h1>
                </div>
             </div>
             <p className="text-sm font-bold text-slate-400 mt-2 flex items-center gap-2 italic">
                <Activity className="h-4 w-4 text-primary" /> 
                {transaction.activityTypeName} | {transaction.clientName}
             </p>
          </div>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
           <Button variant="outline" className="flex-1 md:flex-none h-14 px-8 rounded-2xl bg-white border-2 font-black gap-2">
              <HardHat className="h-5 w-5 text-primary" /> {isRtl ? 'الفريق الفني' : 'Workforce'}
           </Button>
           <Button className="flex-1 md:flex-none h-14 px-8 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2">
              <ShieldCheck className="h-5 w-5" /> {isRtl ? 'اعتماد نهائي' : 'Final Approval'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Stage Tracker */}
        <div className="lg:col-span-2 space-y-8">
           
           {/* Progress Summary Card */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardContent className="p-8">
                 <div className="flex justify-between items-end mb-6">
                    <div className="text-start">
                       <h3 className="text-xl font-black font-headline text-slate-800">{isRtl ? 'تقدم المسار الفني' : 'Technical Progress'}</h3>
                       <p className="text-xs font-bold text-slate-400">{isRtl ? 'متابعة مراحل التنفيذ الفعلي' : 'Tracking operational stages'}</p>
                    </div>
                    <div className="text-end">
                       <span className="text-4xl font-black font-headline text-primary">{progressPercent}%</span>
                    </div>
                 </div>
                 <Progress value={progressPercent} className="h-3 rounded-full bg-slate-100" />
              </CardContent>
           </Card>

           {/* Stages List */}
           <div className="space-y-4">
              {stages?.map((stage, idx) => (
                <Card key={stage.id} className={cn(
                  "border-0 shadow-lg rounded-[2rem] bg-white transition-all overflow-hidden group",
                  stage.status === 'completed' ? 'opacity-80 border-s-8 border-s-emerald-500' : 
                  stage.status === 'in-progress' ? 'ring-2 ring-blue-500 border-s-8 border-s-blue-500' :
                  stage.status === 'blocked' ? 'grayscale opacity-60' : 'border-s-8 border-s-slate-200'
                )}>
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row items-center">
                       <div className="p-6 md:p-8 flex items-center gap-6 flex-1 text-start">
                          <div className={cn(
                            "h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner border-2",
                            stage.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            stage.status === 'in-progress' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'
                          )}>
                             {stage.status === 'completed' ? <CheckCircle2 className="h-7 w-7" /> : (idx + 1)}
                          </div>
                          <div>
                             <h4 className="text-xl font-black text-slate-800 tracking-tight">{stage.name}</h4>
                             <div className="flex gap-4 mt-2">
                                {stage.isTimed && (
                                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-bold text-[9px] gap-1 px-2 border-0">
                                     <Timer className="h-3 w-3" /> {stage.timeTargetDays} {isRtl ? 'يوم' : 'Days'}
                                  </Badge>
                                )}
                                {stage.isNumeric && (
                                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 font-bold text-[9px] gap-1 px-2 border-0">
                                     <ListChecks className="h-3 w-3" /> {isRtl ? 'مستهدف:' : 'Target:'} {stage.numericTarget}
                                  </Badge>
                                )}
                             </div>
                          </div>
                       </div>

                       {/* Interactive Controls Area */}
                       <div className="p-6 md:p-8 bg-slate-50/50 md:border-s flex items-center gap-4 min-w-[300px] justify-center">
                          
                          {/* Numeric Update Input */}
                          {stage.isNumeric && stage.status === 'in-progress' && (
                            <div className="flex items-center gap-2">
                               <Input 
                                 type="number" 
                                 defaultValue={stage.currentCount || 0}
                                 className="w-20 h-10 rounded-xl border-2 font-black text-center text-primary"
                                 onBlur={(e) => handleUpdateNumeric(stage, Number(e.target.value))}
                               />
                               <span className="text-[10px] font-black text-slate-400 uppercase">/ {stage.numericTarget}</span>
                            </div>
                          )}

                          {/* Action Buttons based on status */}
                          {stage.status === 'pending' && (
                            <Button 
                              onClick={() => handleStart(stage)}
                              disabled={updatingId === stage.id}
                              className="bg-primary text-white font-black rounded-xl h-12 px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-all gap-2"
                            >
                               {updatingId === stage.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-5 w-5" />}
                               {isRtl ? 'بدء المرحلة' : 'Start Stage'}
                            </Button>
                          )}

                          {stage.status === 'in-progress' && (
                            <Button 
                              onClick={() => handleComplete(stage)}
                              disabled={updatingId === stage.id}
                              className="bg-emerald-600 text-white font-black rounded-xl h-12 px-6 shadow-lg shadow-emerald-100 hover:scale-105 transition-all gap-2"
                            >
                               {updatingId === stage.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                               {isRtl ? 'إكمال المرحلة' : 'Complete'}
                            </Button>
                          )}

                          {stage.status === 'completed' && (
                            <div className="text-end">
                               <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{isRtl ? 'تم الإنجاز' : 'Done'}</p>
                               <p className="text-[9px] text-slate-400 font-bold">{stage.completedAt?.toDate().toLocaleDateString()}</p>
                            </div>
                          )}

                          {stage.status === 'blocked' && (
                             <div className="flex items-center gap-2 text-slate-400">
                                <ShieldCheck className="h-5 w-5 opacity-30" />
                                <span className="text-[10px] font-black uppercase tracking-tighter">{isRtl ? 'بانتظار سابقتها' : 'Blocked'}</span>
                             </div>
                          )}
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
           </div>
        </div>

        {/* Right Column: Info & Timeline */}
        <div className="space-y-8">
           
           {/* Transaction Snapshot */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden ring-1 ring-white/10">
              <CardHeader className="bg-white/5 border-b border-white/5 p-8 text-start">
                 <CardTitle className="text-lg font-black flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {isRtl ? 'ملخص المعاملة' : 'Transaction Summary'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'العميل المستهدف' : 'Target Client'}</p>
                    <p className="text-xl font-black text-white">{transaction.clientName}</p>
                 </div>
                 <div className="h-[1px] bg-white/5" />
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[9px] font-black text-slate-500 uppercase">{isRtl ? 'المهندس المسؤول' : 'Assigned'}</p>
                       <p className="text-xs font-bold text-slate-200 flex items-center gap-2 mt-1">
                          <HardHat className="h-3 w-3 text-primary" /> {transaction.assignedEngineerName || '---'}
                       </p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-500 uppercase">{isRtl ? 'تاريخ الافتتاح' : 'Opened At'}</p>
                       <p className="text-xs font-mono font-bold text-slate-200 mt-1">
                          {transaction.createdAt?.toDate().toLocaleDateString()}
                       </p>
                    </div>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5 italic text-xs text-slate-400">
                    {transaction.description || (isRtl ? 'لا يوجد وصف مضاف.' : 'No description.')}
                 </div>
              </CardContent>
           </Card>

           {/* Timeline Viewer */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 flex flex-col h-full min-h-[500px]">
              <CardHeader className="bg-slate-50 border-b p-8 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm border">
                       <History className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg font-black">{isRtl ? 'السجل الزمني' : 'Timeline'}</CardTitle>
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] scrollbar-hide text-start">
                 {timelineLoading ? (
                    <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
                 ) : (
                    <div className="relative pt-6">
                       <div className={cn(
                         "absolute top-0 bottom-0 w-[2px] bg-slate-100",
                         isRtl ? "right-10" : "left-10"
                       )} />

                       <div className="space-y-8">
                          {timeline?.map((event) => (
                            <div key={event.id} className="relative group px-8">
                               <div className={cn(
                                 "absolute top-1 h-4 w-4 rounded-full border-4 border-white shadow-md z-10",
                                 event.type === 'stage_complete' ? "bg-emerald-500" : 
                                 event.type === 'stage_start' ? "bg-blue-500" : "bg-slate-300",
                                 isRtl ? "right-8" : "left-8"
                               )} />
                               <div className={cn(isRtl ? "pr-10" : "pl-10")}>
                                  <div className="flex justify-between items-start mb-1">
                                     <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                                        {event.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                     </span>
                                     <Badge variant="outline" className="text-[8px] font-black uppercase h-4 py-0 border-slate-100">
                                        {event.type.replace('_', ' ')}
                                     </Badge>
                                  </div>
                                  <p className="text-xs font-bold text-slate-700 leading-relaxed">{event.content}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                     <div className="h-4 w-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black">
                                        {event.userName?.charAt(0)}
                                     </div>
                                     <span className="text-[8px] font-black text-slate-400 uppercase">{event.userName}</span>
                                  </div>
                               </div>
                            </div>
                          ))}
                          {!timeline?.length && <div className="p-20 text-center text-slate-300 italic text-sm">{isRtl ? 'لا يوجد سجلات بعد.' : 'No events yet.'}</div>}
                       </div>
                    </div>
                 )}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}