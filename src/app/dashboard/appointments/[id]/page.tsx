
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, Workflow, CheckCircle2,
  AlertTriangle, Hammer, Check, Layers, Save,
  Target, X, RotateCcw, Lock, Info, AlertCircle, Play,
  Users, Truck, Plus, Trash2, HardHat
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { Transaction, StageInstance } from '@/types/transaction';
import { BOQ, BOQItem, BOQItemExecutionEntry, LaborDetail, EquipmentUsed } from '@/types/documents';
import { CommentSection } from '@/components/transactions/comment-section';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
import { AppointmentService } from '@/services/appointment-service';
import { TransactionService } from '@/services/transaction-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * @fileOverview صفحة الزيارة الميدانية المدمجة مع محرك العمالة والمعدات.
 * تم تحديثها لفلترة مراحل العمل بناءً على "شرط القسم" المعتمد في الإعدادات.
 */
export default function AppointmentDetailPage() {
  const apptId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { permissions, check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // الحالات الفنية
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number | "">(""); 
  const [progressNotes, setProgressNotes] = useState("");
  
  // حالات الموارد (Labor & Equipment)
  const [laborDetails, setLaborDetails] = useState<LaborDetail[]>([{ trade: '', count: 1 }]);
  const [equipmentUsed, setEquipmentUsed] = useState<EquipmentUsed[]>([]);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [isRecordOpen, setIsRecordOpen] = useState(false);

  const apptRef = useMemo(() => 
    companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, 
  [db, companyId, apptId]);
  const { data: appt, loading: apptLoading } = useDoc<Appointment>(apptRef);

  const transRef = useMemo(() => 
    companyId && db && appt?.transactionId ? doc(db, paths.transactions(companyId), appt.transactionId) : null,
  [db, companyId, appt?.transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null,
  [db, companyId, appt?.transactionId]);
  const { data: rawStages } = useCollection<StageInstance>(stagesQuery);

  // --- بروتوكول فلترة المراحل السيادي (Sovereign Stage Filtering) ---
  const stages = useMemo(() => {
    const list = (rawStages || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // المدير يرى كل شيء للرقابة
    if (isAdmin) return list;

    // الموظف يرى حصراً ما يخص قسمه أو المراحل العامة
    const userDeptId = globalUser?.departmentId;
    return list.filter(stage => {
       if (!stage.allowedDepartmentIds || stage.allowedDepartmentIds.length === 0) return true;
       return userDeptId && stage.allowedDepartmentIds.includes(userDeptId);
    });
  }, [rawStages, isAdmin, globalUser?.departmentId]);

  const boqQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', appt.transactionId), limit(1)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => 
    companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null,
  [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const inventoryQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.inventoryItems(companyId)), where('isActive', '==', true)) : null,
  [db, companyId]);
  const { data: inventory } = useCollection<any>(inventoryQuery);

  const equipmentItems = useMemo(() => 
    (inventory || []).filter((i: any) => i.category === 'EQUIPMENT' || i.itemType === 'equipment'), 
  [inventory]);

  const execsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', appt.transactionId)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: allExecutions } = useCollection<BOQItemExecutionEntry>(execsQuery);

  const commentsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionComments(companyId, appt.transactionId))) : null,
  [db, companyId, appt?.transactionId]);
  const { data: comments } = useCollection<any>(commentsQuery);

  const executionService = useMemo(() => (db && companyId) ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);
  const transactionService = useMemo(() => (db && companyId) ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    let active = true;
    async function fetchAllProgress() {
      if (!executionService || !stages || stages.length === 0 || !appt?.transactionId) return;
      const results: Record<string, StageProgressResult> = {};
      const promises = stages.map(async (s) => {
        const res = await executionService.getTechnicalStageProgress(appt.transactionId!, s.technicalStageId);
        return { id: s.technicalStageId, res };
      });
      const resolved = await Promise.all(promises);
      resolved.forEach(item => { results[item.id] = item.res; });
      if (active) setStageProgressMap(results);
    }
    fetchAllProgress();
    return () => { active = false; };
  }, [executionService, stages, appt?.transactionId, allExecutions]);

  const isConsulting = useMemo(() => {
    const name = transaction?.activityTypeName || '';
    return name.includes('استشارات') || name.includes('Consulting') || name.includes('تصميم') || name.includes('Design');
  }, [transaction]);

  const checkResults = useMemo(() => {
    if (!appt?.transactionId) return { hasAchievement: true, hasComment: true, ready: true };
    const hasProgressLogs = (allExecutions || []).some(e => e.appointmentId === apptId);
    const hasRevisionsInWarRoom = (comments || []).some((c: any) => c.appointmentId === apptId && c.commentType === 'note');
    const hasStageCompletion = (rawStages || []).some(s => s.completedByApptId === apptId);
    
    const hasAchievement = hasProgressLogs || hasRevisionsInWarRoom || hasStageCompletion;
    const hasComment = (comments || []).some((c: any) => c.appointmentId === apptId && c.createdBy === user?.uid);

    return { hasAchievement, hasComment, ready: hasAchievement && hasComment };
  }, [allExecutions, comments, apptId, appt?.transactionId, user?.uid, rawStages]);

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user || !appt?.transactionId) return;
    setProcessingId(stageId);
    try {
      await transactionService.startStage(appt.transactionId, stageId, user.uid, globalUser?.username || 'User', apptId);
      toast({ title: isRtl ? "تم بدء العمل" : "Stage Started" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteStage = async (stage: StageInstance, force: boolean = false) => {
    if (!transactionService || !user || !stage.id || !appt?.transactionId) return;
    if (!isConsulting && !force) {
      const progress = stageProgressMap[stage.technicalStageId];
      if (progress && !progress.canComplete) {
         toast({ variant: "destructive", title: isRtl ? "المرحلة غير مكتملة فنيًا" : "Incomplete", description: progress.reason });
         return;
      }
    }
    setProcessingId(stage.id);
    try {
      await transactionService.completeStage(appt.transactionId, stage.id, user.uid, globalUser?.username || 'User', force, apptId);
      toast({ title: isRtl ? "تم إنجاز المرحلة" : "Stage Completed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRecordProgress = async () => {
    if (!db || !companyId || !user || !activeBoq || !selectedItemId || !selectedStageId) return;
    const qtyInput = progressQty === "" ? 0 : Number(progressQty);
    setLoadingAction('recording');
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      const stage = stages?.find(s => s.id === selectedStageId);
      if (!stage) throw new Error("Stage not found");

      await service.recordBOQItemExecution(
        activeBoq.id, selectedItemId, stage.technicalStageId, qtyInput, 
        user.uid, globalUser?.username || 'User', progressNotes, 
        selectedStageId, false, apptId, 
        { laborDetails, equipmentUsed }
      );
      
      toast({ title: isRtl ? "تم تسجيل الإنجاز والموارد" : "Progress & Resources Logged" });
      setIsRecordOpen(false);
      setProgressQty(""); setProgressNotes(""); setSelectedItemId("");
      setLaborDetails([{ trade: '', count: 1 }]); setEquipmentUsed([]);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const forceThaw = useCallback(() => {
    if (typeof document !== 'undefined') {
       document.body.style.pointerEvents = 'auto';
       document.body.style.overflow = 'auto';
       document.body.removeAttribute('data-scroll-locked');
    }
  }, []);

  if (apptLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!appt) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start" dir={dir}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="h-12 w-12 border-2 rounded-2xl bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900">{appt.title}</h1>
             <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-[0.2em] opacity-60">
               {appt.clientName} | {transaction?.transactionNumber || 'External'}
             </p>
           </div>
        </div>
        
        {appt.status !== 'completed' && (
           <div className="flex flex-col items-end gap-2">
              <Button 
                onClick={() => {
                   if (db && companyId && user) {
                      const service = new AppointmentService(db, companyId);
                      service.updateStatus(apptId, 'completed', user.uid).then(() => {
                        toast({ title: isRtl ? "تم إنجاز الموعد وإغلاق الملف" : "Appt Completed" });
                        router.push('/dashboard/appointments');
                      });
                   }
                }} 
                disabled={!checkResults.ready}
                className={cn(
                  "h-14 px-10 rounded-2xl font-black text-lg transition-all gap-3 border-b-8 shadow-xl",
                  checkResults.ready ? "bg-emerald-600 text-white border-emerald-800 shadow-emerald-100" : "bg-slate-200 text-slate-400 border-slate-400"
                )}
              >
                  <CheckCircle2 className="h-6 w-6" />
                  {isRtl ? 'إغلاق وإنجاز الموعد' : 'Complete Appointment'}
              </Button>
           </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 p-8 text-slate-900 border-b flex flex-row justify-between items-center text-start">
                 <div className="text-start">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                       <Target className="h-6 w-6 text-primary" />
                       {isRtl ? 'رادار المسار الفني' : 'Technical Radar'}
                    </CardTitle>
                 </div>
                 {appt.status !== 'completed' && !isConsulting && (
                    <Button onClick={() => setIsRecordOpen(true)} className="btn-gradient h-12 px-8 rounded-xl gap-2 shadow-lg">
                       <Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز فني' : 'Log Progress'}
                    </Button>
                 )}
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                 {stages.length === 0 ? (
                   <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                      <Workflow className="h-12 w-12 text-slate-200" />
                      <p className="text-xs font-bold text-slate-400">
                        {isRtl ? 'لا توجد مراحل مرتبطة بقسمك حالياً.' : 'No stages associated with your department.'}
                      </p>
                   </div>
                 ) : stages.map((stage, idx) => {
                    const isSelected = stage.id === selectedStageId;
                    const isPreviousCompleted = idx === 0 || stages[idx-1].status === 'completed';
                    const isFrontier = stage.status === 'in-progress' || (stage.status === 'pending' && isPreviousCompleted && !checkResults.hasAchievement);
                    
                    return (
                       <div key={stage.id} onClick={() => setSelectedStageId(stage.id!)} className={cn("p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col gap-4 group", isSelected ? "bg-primary/5 border-primary shadow-lg scale-[1.01]" : "bg-white border-slate-100 hover:border-slate-200")}>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs border shadow-sm", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white text-slate-400")}>{stage.status === 'completed' ? <Check className="h-5 w-5" /> : (idx + 1)}</div>
                                <div className="text-start">
                                   <p className={cn("text-base font-black leading-tight", isSelected ? "text-primary" : "text-slate-800")}>{stage.name}</p>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-1">{stage.status}</p>
                                </div>
                             </div>
                          </div>
                          {isSelected && isFrontier && (
                             <div className="flex gap-3 animate-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                                {stage.status === 'pending' && <Button onClick={() => handleStartStage(stage.id!)} disabled={!!processingId} className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-black text-xs gap-2 shadow-lg">{processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />}{isRtl ? 'بدء العمل' : 'Start'}</Button>}
                                {stage.status === 'in-progress' && <Button onClick={() => handleCompleteStage(stage)} disabled={!!processingId} className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xs gap-2 shadow-lg">{processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{isRtl ? 'إنجاز' : 'Done'}</Button>}
                             </div>
                          )}
                       </div>
                    );
                 })}
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-5 flex flex-col h-[700px]">
           <div className="bg-white rounded-[3rem] shadow-2xl border border-primary/10 overflow-hidden flex-1 flex flex-col">
              <CommentSection transactionId={appt.transactionId || apptId} appointmentId={apptId} path={appt.transactionId ? paths.transactionComments(companyId!, appt.transactionId) : `companies/${companyId}/appointments/${apptId}/comments`} title={isRtl ? 'غرفة عمليات الزيارة' : 'Visit War Room'} onlyComments={true} />
           </div>
        </div>
      </div>

      <Dialog open={isRecordOpen} onOpenChange={(v) => { if(!v) setIsRecordOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl flex flex-col max-h-[95vh]" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 border-b shrink-0 text-start">
               <DialogTitle className="text-xl font-black flex items-center gap-3"><Hammer className="h-6 w-6 text-primary" />{isRtl ? 'تسجيل إنجاز فني وموارد الموقع' : 'Log Site Progress & Resources'}</DialogTitle>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 text-start scrollbar-hide">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Target Stage</Label>
                     <Select value={selectedStageId} onValueChange={v => { setSelectedStageId(v); setSelectedItemId(""); }}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">{stages?.filter(s => s.status === 'in-progress').map(s => (<SelectItem key={s.id} value={s.id!} className="font-bold py-2">{s.name}</SelectItem>))}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">BOQ Work Item</Label>
                     <Select disabled={!selectedStageId} value={selectedItemId} onValueChange={setSelectedItemId}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">{boqItems?.filter(i => {
                           const stage = stages?.find(s => s.id === selectedStageId);
                           return (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(stage?.technicalStageId!) || i.technicalStageId === stage?.technicalStageId);
                        }).map(i => (<SelectItem key={i.id} value={i.id!} className="font-bold text-xs py-3 text-start"><div className="text-start flex flex-col"><span className="font-black text-slate-800">{i.referenceTitle}</span><span className="text-[8px] text-slate-400">#{i.referenceCode}</span></div></SelectItem>))}</SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="space-y-4 p-6 bg-primary/5 rounded-[1.5rem] border-2 border-primary/10">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Quantity Executed Today</Label><Input type="number" step="0.01" value={progressQty} onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} className="h-14 rounded-xl border-2 font-black text-4xl text-center bg-white shadow-inner" /></div>
               </div>

               {/* محرك العمالة */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                     <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" /> {isRtl ? 'القوى العاملة المشاركة' : 'Labor Resources'}</h4>
                     <Button variant="ghost" size="sm" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1 }])} className="h-7 text-[10px] font-black gap-1 text-primary"><Plus className="h-3 w-3" /> {isRtl ? 'إضافة فئة' : 'Add Trade'}</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                     {laborDetails.map((labor, i) => (
                        <div key={i} className="flex items-center gap-3 animate-in slide-in-from-top-1">
                           <Input placeholder={isRtl ? "التخصص" : "Trade"} value={labor.trade} onChange={e => {
                              const newL = [...laborDetails]; newL[i].trade = e.target.value; setLaborDetails(newL);
                           }} className="h-10 rounded-lg font-bold text-xs" />
                           <Input type="number" value={labor.count} onChange={e => {
                              const newL = [...laborDetails]; newL[i].count = Number(e.target.value); setLaborDetails(newL);
                           }} className="h-10 w-24 rounded-lg font-black text-center" />
                           {laborDetails.length > 1 && <Button variant="ghost" size="icon" onClick={() => setLaborDetails(laborDetails.filter((_, idx) => idx !== i))} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                     ))}
                  </div>
               </div>

               {/* محرك المعدات */}
               <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between border-b pb-2">
                     <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Truck className="h-4 w-4 text-orange-500" /> {isRtl ? 'الآليات والمعدات المستخدمة' : 'Equipment & Tools'}</h4>
                     <Button variant="ghost" size="sm" onClick={() => setEquipmentUsed([...equipmentUsed, { equipmentId: '', name: '', hoursUsed: 1 }])} className="h-7 text-[10px] font-black gap-1 text-primary"><Plus className="h-3 w-3" /> {isRtl ? 'إضافة معدة' : 'Add Gear'}</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                     {equipmentUsed.map((equip, i) => (
                        <div key={i} className="flex items-center gap-3 animate-in slide-in-from-top-1">
                           <Select value={equip.equipmentId} onValueChange={v => {
                              const item = equipmentItems.find(x => x.id === v);
                              const newE = [...equipmentUsed]; newE[i].equipmentId = v; newE[i].name = item?.name || ''; setEquipmentUsed(newE);
                           }}>
                              <SelectTrigger className="h-10 rounded-lg font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                              <SelectContent className="rounded-xl">{equipmentItems.map((e:any) => <SelectItem key={e.id} value={e.id!} className="font-bold text-xs">{e.name}</SelectItem>)}</SelectContent>
                           </Select>
                           <div className="relative w-32 shrink-0">
                              <Input type="number" value={equip.hoursUsed} onChange={e => {
                                 const newE = [...equipmentUsed]; newE[i].hoursUsed = Number(e.target.value); setEquipmentUsed(newE);
                              }} className="h-10 rounded-lg font-black text-center pe-8" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">HRS</span>
                           </div>
                           <Button variant="ghost" size="icon" onClick={() => setEquipmentUsed(equipmentUsed.filter((_, idx) => idx !== i))} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-2 pt-4 text-start">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Site Notes</Label>
                  <Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-xl bg-slate-50/50 border-2 font-bold" />
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0 shadow-lg">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-14 rounded-2xl font-bold">إلغاء</Button>
               <Button onClick={handleRecordProgress} disabled={!!loadingAction || !selectedItemId || !selectedStageId} className="flex-[2] btn-gradient h-14 rounded-2xl text-xl gap-2 shadow-xl shadow-orange-500/20">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  {isRtl ? 'حفظ واعتماد السجل' : 'Commit Record'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}

