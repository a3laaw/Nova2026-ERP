
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowRight, Calendar, Clock, User, 
  MessageSquare, ShieldCheck, 
  Loader2, Workflow, CheckCircle2,
  AlertTriangle, Timer, Hammer,
  Check, Layers, Info, Pencil, FileText,
  Target, Zap, Receipt, Save
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { Transaction, StageInstance } from '@/types/transaction';
import { BOQ, BOQItem, BOQItemExecutionEntry } from '@/types/documents';
import { CommentSection } from '@/components/transactions/comment-section';
import { BOQExecutionService } from '@/services/boq-execution-service';
import { AppointmentService } from '@/services/appointment-service';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function AppointmentDetailPage() {
  const apptId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { permissions, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // الحالات والتحكم
  const [activeTab, setActiveTab] = useState('pipeline');
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number | "">(""); 
  const [progressNotes, setProgressNotes] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const apptRef = useMemo(() => 
    companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, 
  [db, companyId, apptId]);

  const { data: appt, loading: apptLoading } = useDoc<Appointment>(apptRef);

  // جلب بيانات المشروع المربوط
  const transRef = useMemo(() => 
    companyId && db && appt?.transactionId ? doc(db, paths.transactions(companyId), appt.transactionId) : null,
  [db, companyId, appt?.transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  // جلب مراحل المشروع
  const stagesQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null,
  [db, companyId, appt?.transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

  // جلب المقايسة والبنود لتفعيل ميزة "تسجيل الإنجاز"
  const boqQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', appt.transactionId), limit(1)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => 
    companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null,
  [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  // جلب سجلات التنفيذ للتحقق من شرط الإغلاق
  const execsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', appt.transactionId)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: allExecutions } = useCollection<BOQItemExecutionEntry>(execsQuery);

  // تحديد طبيعة النشاط
  const isConsulting = useMemo(() => {
    const name = transaction?.activityTypeName || '';
    return name.includes('استشارات') || name.includes('Consulting') || name.includes('تصميم') || name.includes('Design');
  }, [transaction]);

  // الشرط السيادي: هل تم تسجيل إنجاز لهذه المرحلة في هذا الموعد؟
  const hasAchievement = useMemo(() => {
    if (!appt?.transactionId || isConsulting) return true; 
    // نبحث عن أي سجل إنجاز غير مؤرشف ينتمي لهذه المرحلة الفنية
    const currentStageExecutions = (allExecutions || []).filter(ex => ex.technicalStageId === appt.stageId && !ex.isArchived);
    return currentStageExecutions.length > 0;
  }, [allExecutions, appt?.stageId, appt?.transactionId, isConsulting]);

  const handleRecordProgress = async () => {
    if (!db || !companyId || !user || !activeBoq || !selectedItemId) return;
    const qtyInput = progressQty === "" ? 0 : Number(progressQty);
    
    setLoadingAction('recording');
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      const currentUserName = globalUser?.username || user.displayName || 'Engineer';
      
      await service.recordBOQItemExecution(
        activeBoq.id, 
        selectedItemId, 
        appt!.stageId!, 
        qtyInput, 
        user.uid, 
        currentUserName, 
        progressNotes, 
        appt!.stageId! // الربط المباشر بطلب الزيارة
      );

      toast({ title: isRtl ? "تم تسجيل الإنجاز في الميدان" : "Field Progress Logged" });
      setIsRecordOpen(false);
      setProgressQty("");
      setProgressNotes("");
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleComplete = async () => {
    if (!db || !companyId || !user) return;

    // قفل صارم: منع الإكمال إذا لم يتوفر إنجاز فني للمواعيد الإنشائية
    if (!hasAchievement && appt?.transactionId && !isConsulting) {
       toast({ 
         variant: "destructive", 
         title: isRtl ? "قفل الإنجاز مفعل" : "Execution Lock Active",
         description: isRtl ? "لا يمكن إغلاق الموعد بدون تسجيل إنجاز ميداني للكميات في هذه المرحلة." : "Log site quantity progress first."
       });
       return;
    }

    try {
      const service = new AppointmentService(db, companyId);
      await service.updateStatus(apptId, 'completed', user.uid);
      toast({ title: isRtl ? "تم إنجاز الموعد والمهمة" : "Appointment Completed" });
      router.push('/dashboard/appointments');
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    }
  };

  const selectedBOQItemMetrics = useMemo(() => {
    if (!selectedItemId || !boqItems) return null;
    const item = boqItems.find(i => i.id === selectedItemId);
    if (!item) return null;
    const executed = (allExecutions || []).filter(e => e.boqItemId === selectedItemId && !e.isArchived).reduce((sum, e) => sum + (e.quantity || 0), 0);
    return { planned: item.plannedQuantity || 0, executed, remaining: Math.max(0, (item.plannedQuantity || 0) - executed), unit: item.unitSymbol || item.unitName };
  }, [selectedItemId, boqItems, allExecutions]);

  if (apptLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!appt) return <div className="p-20 text-center font-black">{isRtl ? 'الموعد غير موجود' : 'Appointment not found'}</div>;

  const displayDate = new Date(appt.start).toLocaleDateString(isRtl ? 'ar-KW' : 'en-US', { 
    dateStyle: 'full',
    numberingSystem: 'latn' 
  });
  const displayTime = new Date(appt.start).toLocaleTimeString(isRtl ? 'ar-KW' : 'en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    numberingSystem: 'latn'
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="h-12 w-12 border-2 rounded-2xl bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition-all">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900">{appt.title}</h1>
             <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-[0.2em] opacity-60">
               {appt.clientName} | {transaction?.transactionNumber || (isRtl ? 'موعد منفصل' : 'External Appointment')}
             </p>
           </div>
        </div>
        
        {appt.status !== 'completed' && (
           <Button 
             onClick={handleComplete} 
             disabled={!hasAchievement && appt?.transactionId && !isConsulting}
             className={cn(
               "h-14 px-10 rounded-2xl font-black text-lg transition-all gap-3 border-b-8 shadow-xl hover:scale-105",
               (hasAchievement || isConsulting) ? "bg-emerald-600 text-white border-emerald-800 shadow-emerald-100" : "bg-slate-200 text-slate-400 border-slate-400 cursor-not-allowed"
             )}
           >
              <CheckCircle2 className="h-6 w-6" />
              {isRtl ? 'إغلاق وإنجاز الموعد' : 'Complete Appointment'}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className="lg:col-span-8">
           <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-white border-2 border-slate-100 p-1 rounded-xl h-14 w-full md:w-fit gap-2 shadow-sm mb-6">
                 <TabsTrigger value="pipeline" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                    <Workflow className="h-4 w-4" /> {isRtl ? 'رادار الموعد' : 'Field Mission'}
                 </TabsTrigger>
                 <TabsTrigger value="warroom" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                    <MessageSquare className="h-4 w-4" /> {isRtl ? 'غرفة العمليات' : 'War Room'}
                 </TabsTrigger>
              </TabsList>

              <TabsContent value="pipeline" className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                 <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                    <CardHeader className="bg-slate-900 p-8 text-white flex flex-row justify-between items-center">
                       <div className="text-start">
                          <CardTitle className="text-xl font-black flex items-center gap-3">
                             <Target className="h-6 w-6 text-primary" />
                             {isRtl ? 'مهمة الزيارة المستهدفة' : 'Site Mission Details'}
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{appt.stageName || 'Meeting'}</p>
                       </div>
                       {appt.status !== 'completed' && !isConsulting && (
                          <Button onClick={() => setIsRecordOpen(true)} className="btn-gradient h-12 px-8 rounded-xl gap-2">
                             <Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز فني' : 'Log Progress'}
                          </Button>
                       )}
                    </CardHeader>
                    <CardContent className="p-10 space-y-10">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="flex items-start gap-4 text-start">
                             <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border"><Calendar className="h-5 w-5" /></div>
                             <div className="text-start">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'التاريخ المجدول' : 'Scheduled Date'}</p>
                                <p className="font-black text-slate-800 text-lg">{displayDate}</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-4 text-start">
                             <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border"><Clock className="h-5 w-5" /></div>
                             <div className="text-start">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الوقت' : 'Time'}</p>
                                <p className="font-black text-slate-800 text-lg">{displayTime}</p>
                             </div>
                          </div>
                       </div>

                       <div className="p-8 rounded-[2rem] bg-slate-50/50 border-2 border-slate-100 flex items-start gap-4 text-start">
                          <Info className="h-6 w-6 text-primary mt-1" />
                          <div className="space-y-1">
                             <h5 className="font-black text-xs uppercase">{isRtl ? 'توجيهات العمل' : 'Work Instructions'}</h5>
                             <p className="text-sm font-bold text-slate-600 italic">"{appt.notes || (isRtl ? 'لا يوجد ملاحظات إضافية.' : 'No special notes.')}"</p>
                          </div>
                       </div>

                       {!hasAchievement && !isConsulting && (
                          <div className="p-8 rounded-[2.5rem] bg-rose-50 border-2 border-rose-100 text-rose-800 flex items-center gap-6 animate-pulse text-start">
                             <AlertTriangle className="h-10 w-10 shrink-0" />
                             <div className="text-start">
                                <h4 className="font-black text-lg">{isRtl ? 'مطلوب تسجيل إنجاز' : 'Progress Log Required'}</h4>
                                <p className="text-xs font-bold leading-relaxed">{isRtl ? 'تنفيذاً لسياسة Nova ERP، يجب تسجيل كميات الإنجاز الميداني (من خلال زر المطرقة أعلاه) قبل أن تتمكن من إغلاق الموعد بنجاح.' : 'Per Nova ERP policy, site quantities must be logged (via Hammer button above) before closing this mission.'}</p>
                             </div>
                          </div>
                       )}

                       {hasAchievement && (
                          <div className="p-8 rounded-[2.5rem] bg-emerald-50 border-2 border-emerald-100 text-emerald-800 flex items-center gap-6 text-start">
                             <CheckCircle2 className="h-10 w-10 shrink-0" />
                             <div className="text-start">
                                <h4 className="font-black text-lg">{isRtl ? 'الشرط الفني مكتمل' : 'Technical Condition Met'}</h4>
                                <p className="text-xs font-bold leading-relaxed">{isRtl ? 'تم توثيق إنجاز ميداني لهذه المرحلة. يمكنك الآن إغلاق الموعد.' : 'Field progress has been documented. You can now complete the appointment.'}</p>
                             </div>
                          </div>
                       )}
                    </CardContent>
                 </Card>
              </TabsContent>

              <TabsContent value="warroom" className="h-[700px] animate-in fade-in">
                 <div className="bg-white rounded-[3rem] shadow-2xl border border-primary/10 overflow-hidden h-full">
                    <CommentSection 
                       transactionId={appt.transactionId || apptId} 
                       path={appt.transactionId ? paths.transactionComments(companyId!, appt.transactionId) : `companies/${companyId}/appointments/${apptId}/comments`} 
                       title={isRtl ? 'غرفة عمليات الزيارة' : 'Mission War Room'}
                       filterStageId={appt.stageId}
                       selectedStageName={appt.stageName}
                       stages={stages}
                    />
                 </div>
              </TabsContent>
           </Tabs>
        </div>

        <div className="lg:col-span-4 space-y-6 text-start">
           {appt.transactionId && stages && (
              <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-900 p-6 text-white text-start">
                    <div className="flex items-center gap-3">
                       <Layers className="h-5 w-5 text-primary" />
                       <CardTitle className="text-sm font-black uppercase tracking-widest">{isRtl ? 'رادار المسار الفني' : 'Project Pipeline'}</CardTitle>
                    </div>
                 </CardHeader>
                 <CardContent className="p-4 space-y-2">
                    {stages.map((stage, idx) => {
                       const isTarget = stage.id === appt.stageId;
                       return (
                          <div 
                            key={stage.id} 
                            onClick={() => router.push(`/dashboard/clients/${appt.clientId}/transactions/${appt.transactionId}`)}
                            className={cn(
                              "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group",
                              isTarget ? "bg-primary/5 border-primary shadow-lg scale-105" : "bg-white border-slate-100 hover:border-slate-200"
                            )}
                          >
                             <div className="flex items-center gap-3">
                                <div className={cn(
                                   "h-7 w-7 rounded-lg flex items-center justify-center font-black text-[10px] border shadow-inner",
                                   stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-white"
                                )}>
                                   {stage.status === 'completed' ? <Check className="h-3 w-3" /> : (idx + 1)}
                                </div>
                                <div className="text-start">
                                   <p className={cn("text-[11px] font-black leading-tight", isTarget ? "text-primary" : "text-slate-800")}>{stage.name}</p>
                                   <p className="text-[8px] font-bold text-slate-400 uppercase">{stage.status}</p>
                                </div>
                             </div>
                             {isTarget && (
                                <Badge className="bg-primary text-white border-0 text-[7px] font-black h-4 px-2">TARGET STAGE</Badge>
                             )}
                          </div>
                       );
                    })}
                 </CardContent>
              </Card>
           )}

           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isRtl ? 'عن العميل' : 'Client Snapshot'}</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="flex items-center gap-4 text-start">
                    <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg border-2 border-white">{appt.clientName.charAt(0)}</div>
                    <div className="text-start">
                       <h4 className="font-black text-slate-900 leading-tight">{appt.clientName}</h4>
                       <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Sovereign Client</p>
                    </div>
                 </div>
                 <Button onClick={() => router.push(`/dashboard/clients/${appt.clientId}`)} variant="outline" className="w-full rounded-xl font-black text-[10px] h-11 gap-2 border-2 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                    {isRtl ? 'عرض ملف العميل الكامل' : 'View Full Client File'}
                    <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                 </Button>
              </CardContent>
           </Card>
        </div>

      </div>

      {/* مودال تسجيل الإنجاز */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-md" dir={dir}>
            <div className="bg-slate-900 p-6 text-white text-start flex justify-between items-center">
               <DialogTitle className="text-lg font-black flex items-center gap-3">
                  <Hammer className="h-5 w-5 text-primary" />
                  {isRtl ? 'تسجيل إنجاز فني (ميداني)' : 'Log Site Achievement'}
               </DialogTitle>
               <Badge className="bg-primary text-white border-0 font-black text-[9px] uppercase">{appt.stageName}</Badge>
            </div>
            <div className="p-6 space-y-6 text-start bg-white">
               <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'بند العمل الميداني المستهدف' : 'Target BOQ Item'}</Label>
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                     <SelectTrigger className="h-10 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border-2 shadow-2xl">
                        {boqItems?.filter(i => (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(appt.stageId!) || i.technicalStageId === appt.stageId)).map(i => (
                          <SelectItem key={i.id} value={i.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                             <div className="flex flex-col text-start">
                                <span className="font-black text-slate-800">{i.referenceTitle}</span>
                                <span className="text-[8px] text-slate-400 font-mono">#{i.referenceCode}</span>
                             </div>
                          </SelectItem>
                        ))}
                        {!boqItems?.some(i => i.technicalStageIds?.includes(appt.stageId!) || i.technicalStageId === appt.stageId) && (
                           <div className="p-4 bg-amber-50 rounded-xl border-2 border-dashed border-amber-200 text-center space-y-2">
                              <Info className="h-5 w-5 mx-auto text-amber-500" />
                              <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                                 {isRtl ? 'تنبيه: لا يوجد بنود مقايسة مرتبطة فنياً بهذه المرحلة حالياً. يرجى مراجعة القالب أو القاموس لربط البنود لتتمكن من تسجيل الكميات.' : 'Notice: No BOQ items are technically linked to this stage yet.'}
                              </p>
                           </div>
                        )}
                     </SelectContent>
                  </Select>
               </div>

               {selectedBOQItemMetrics && (
                 <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 rounded-xl border-2 border-white shadow-inner text-center animate-in slide-in-from-top-2">
                    <div className="text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase">Planned</p>
                       <p className="text-sm font-black text-slate-900">{selectedBOQItemMetrics.planned}</p>
                    </div>
                    <div className="text-center border-x-2 border-white">
                       <p className="text-[8px] font-black text-slate-400 uppercase">Executed</p>
                       <p className="text-sm font-black text-blue-600">{selectedBOQItemMetrics.executed}</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase">Remaining</p>
                       <p className={cn("text-sm font-black", selectedBOQItemMetrics.remaining <= 0 ? "text-rose-500" : "text-emerald-600")}>{selectedBOQItemMetrics.remaining}</p>
                    </div>
                 </div>
               )}

               <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                     <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الكمية المنفذة حالياً' : 'Quantity Executed'}</Label>
                     <div className="relative">
                        <input 
                           type="number" 
                           step="0.01" 
                           value={progressQty} 
                           onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} 
                           className="h-12 w-full rounded-lg border-2 font-black text-2xl text-center shadow-inner focus:border-primary transition-all" 
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">{selectedBOQItemMetrics?.unit}</div>
                     </div>
                  </div>
                  <div className="space-y-1.5">
                     <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ملاحظات المهندس الميدانية' : 'Engineer Field Notes'}</Label>
                     <Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-lg bg-slate-50/50 border-2 text-xs font-bold" />
                  </div>
               </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-12 rounded-xl font-bold">إلغاء</Button>
               <Button onClick={handleRecordProgress} disabled={!!loadingAction || !selectedItemId} className="flex-[2] btn-gradient h-12 rounded-xl text-lg gap-2 shadow-xl shadow-orange-500/20">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isRtl ? 'حفظ وإرسال التقرير' : 'Confirm & Send'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
