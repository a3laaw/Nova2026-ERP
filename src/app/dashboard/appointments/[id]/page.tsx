
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, Workflow, CheckCircle2,
  Hammer, Check, Save,
  Target, X, RotateCcw, Lock, Info, Play,
  Users, Truck, Plus, Trash2, Link as LinkIcon,
  ShieldAlert, ShieldX, Sparkles, DollarSign, Building2, Briefcase, Clock, Camera, LayoutGrid,
  Handshake
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, updateDoc, serverTimestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { Transaction, StageInstance } from '@/types/transaction';
import { BOQ, BOQItem, BOQItemExecutionEntry, LaborDetail, EquipmentUsed } from '@/types/documents';
import { Job } from '@/types/reference';
import { CommentSection } from '@/components/transactions/comment-section';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkGroup } from '@/types/hr';

export default function AppointmentDetailPage() {
  const apptId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { permissions, check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const currentUserName = useMemo(() => globalUser?.fullName || user?.displayName || globalUser?.username || 'Engineer', [globalUser, user]);

  const [selectedStageId, setSelectedStageId] = useState("");
  const [loggedItems, setLoggedItems] = useState<any[]>([]);
  const [laborDetails, setLaborDetails] = useState<any[]>([{ trade: '', count: 1, hours: 8, hourlyCostRef: 0, subcontractorId: '', subcontractorName: '' }]);
  const [equipmentUsed, setEquipmentUsed] = useState<any[]>([{ equipmentId: '', hoursUsed: 4, hourlyRateRef: 0 }]);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);

  const apptRef = useMemo(() => companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, [db, companyId, apptId]);
  const { data: appt, loading: apptLoading } = useDoc<Appointment>(apptRef);

  const transRef = useMemo(() => companyId && db && appt?.transactionId ? doc(db, paths.transactions(companyId), appt.transactionId) : null, [db, companyId, appt?.transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null, [db, companyId, appt?.transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => companyId && db && appt?.transactionId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', appt.transactionId), limit(1)) : null, [db, companyId, appt?.transactionId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const inventoryQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('status', '==', 'available')) : null, [db, companyId]);
  const { data: equipmentItems } = useCollection<any>(inventoryQuery);

  const groupsQuery = useMemo(() => companyId && db ? query(collection(db, paths.workGroups(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  const { data: workGroups } = useCollection<WorkGroup>(groupsQuery);

  const subsQuery = useMemo(() => companyId && db ? query(collection(db, paths.subcontractors(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const { data: subcontractors } = useCollection<any>(subsQuery);

  useEffect(() => {
     if (isRecordOpen && db && companyId) {
        getDocs(query(collection(db, paths.employees(companyId)), where('status', '==', 'active')))
           .then(snap => setAvailableEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
           .catch(() => setAvailableEmployees([]));
     }
  }, [isRecordOpen, db, companyId]);

  useEffect(() => {
     if (selectedStageId && boqItems) {
        const stage = stages?.find(s => s.id === selectedStageId);
        if (stage) {
           const filtered = boqItems.filter(i => (i.technicalStageIds?.includes(stage.technicalStageId) || i.technicalStageId === stage.technicalStageId));
           setLoggedItems(filtered.map(i => ({ 
             boqItemId: i.id, 
             itemName: i.referenceTitle, 
             quantity: 0, 
             unit: i.unitSymbol || 'unit', 
             notes: '',
             technicalStageId: stage.technicalStageId,
             subcontractorId: i.subcontractorId || '',
             subcontractorName: i.subcontractorName || ''
           })));
        }
     }
  }, [selectedStageId, boqItems, stages]);

  const handleApplyGroup = (groupId: string) => {
     const group = workGroups?.find(g => g.id === groupId);
     if (!group) return;

     const groupLabor = (group.memberIds || []).map(mid => {
        const emp = availableEmployees?.find(e => e.id === mid);
        return {
           trade: emp?.fullName || 'Worker',
           count: 1,
           hours: 8,
           hourlyCostRef: (emp?.basicSalary || 0) / 26 / 8,
           subcontractorId: '',
           subcontractorName: ''
        };
     });

     const supervisor = availableEmployees?.find(e => e.id === group.supervisorId);
     if (supervisor) {
        groupLabor.unshift({
           trade: supervisor.fullName,
           count: 1,
           hours: 8,
           hourlyCostRef: (supervisor.basicSalary || 0) / 26 / 8,
           subcontractorId: '',
           subcontractorName: ''
        });
     }

     setLaborDetails([...laborDetails.filter(l => l.trade), ...groupLabor]);
     toast({ title: t('construction.crewLoaded') });
  };

  const handleRecordProgress = async () => {
    if (!db || !companyId || !user || !activeBoq || loggedItems.length === 0) return;
    setLoadingAction('recording');
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      const stage = stages?.find(s => s.id === selectedStageId);
      if (!stage) throw new Error("Stage not found");

      for (const item of loggedItems) {
         if (item.quantity > 0) {
            await service.recordBOQItemExecution(
               activeBoq.id, item.boqItemId, stage.technicalStageId, item.quantity, 
               user.uid, currentUserName, item.notes, 
               selectedStageId, false, apptId, 
               { laborDetails, equipmentUsed }
            );
         }
      }
      
      toast({ title: t('construction.visitCreated') });
      setIsRecordOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  if (apptLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!appt) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-100">
        <div className="flex items-center gap-3 text-start">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 rounded-lg border text-slate-400 shadow-sm">
             <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
             <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-none">{appt.title}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{appt.clientName} | Project: {transaction?.transactionNumber || '---'}</p>
           </div>
        </div>
        {appt.status !== 'completed' && (
           <Button onClick={() => setIsRecordOpen(true)} size="sm" className="h-9 px-6 rounded-md font-bold gap-2 shadow-sm">
               <Hammer className="h-4 w-4" /> {t('construction.logResources')}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
           <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden text-start">
              <CardHeader className="bg-slate-50 p-4 border-b">
                 <CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> {t('projects.executionPipeline')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                 {stages?.map((stage, idx) => (
                    <div key={stage.id} onClick={() => setSelectedStageId(stage.id!)} className={cn("p-3 rounded-md border cursor-pointer transition-all flex items-center justify-between group", selectedStageId === stage.id ? "bg-primary/5 border-primary" : "bg-white border-transparent hover:border-slate-50")}>
                       <div className="flex items-center gap-3 text-start">
                          <div className={cn("h-7 w-7 rounded-md flex items-center justify-center font-bold text-[10px] border", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400")}>{stage.status === 'completed' ? <Check className="h-3.5 w-3.5" /> : (idx + 1)}</div>
                          <p className="font-bold text-xs text-slate-800">{stage.name}</p>
                       </div>
                       <Badge variant="outline" className="text-[8px] font-bold uppercase border-0">{stage.status}</Badge>
                    </div>
                 ))}
                 {!stages?.length && <div className="p-10 text-center italic text-xs text-slate-300">No technical stages defined.</div>}
              </CardContent>
           </Card>
        </div>
        <div className="lg:col-span-5 h-full min-h-[500px]">
           <CommentSection transactionId={appt.transactionId || apptId} path={paths.transactionComments(companyId!, appt.transactionId || apptId)} />
        </div>
      </div>

      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
         <DialogContent className="max-w-5xl rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white flex flex-col max-h-[95vh]" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 text-start flex items-center justify-between border-b shrink-0">
               <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm"><LayoutGrid className="h-5 w-5" /></div>
                  <DialogTitle className="text-lg font-bold">{t('construction.logResources')}</DialogTitle>
               </div>
            </div>

            <div className="p-8 space-y-10 overflow-y-auto scrollbar-hide text-start bg-white flex-1">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.target.execution.stage', 'المرحلة التنفيذية المستهدفة', 'Target Execution Stage')}</Label>
                  <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                     <SelectTrigger className="h-12 rounded-xl border-2 font-black text-sm bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border-0 shadow-2xl z-[150]">{stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold py-3 border-b last:border-0 border-slate-50">{s.name}</SelectItem>)}</SelectContent>
                  </Select>
               </div>

               {selectedStageId && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                     <h4 className="font-black text-xs text-primary flex items-center gap-2 border-b pb-2 uppercase tracking-widest"><Hammer className="h-4 w-4" /> {t('boq.workProgress')}</h4>
                     <div className="border-2 rounded-2xl overflow-hidden shadow-sm">
                        <Table>
                           <TableHeader className="bg-slate-50/80">
                              <TableRow className="border-0">
                                 <TableHead className="text-start text-[10px] font-black uppercase text-slate-400 py-4 ps-6">{t('common.addLabel')}</TableHead>
                                 <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 py-4">{tSafe('inline.executing.entity', 'المنفذ', 'Executor')}</TableHead>
                                 <TableHead className="text-center w-[120px] text-[10px] font-black uppercase text-primary py-4">{t('common.quantity')}</TableHead>
                                 <TableHead className="text-start text-[10px] font-black uppercase text-slate-400 py-4 pe-6">{t('common.notes')}</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {loggedItems.map((item, idx) => (
                                <TableRow key={idx} className="border-b-slate-100 hover:bg-slate-50/50">
                                   <TableCell className="py-4 ps-6">
                                      <p className="font-black text-slate-800 text-xs leading-tight">{item.itemName}</p>
                                      <Badge variant="outline" className="mt-1 text-[8px] border-0 h-4 px-0 uppercase text-slate-400 font-mono">{item.unit}</Badge>
                                   </TableCell>
                                   <TableCell className="py-4">
                                      {item.subcontractorName ? (
                                        <Badge className="bg-orange-50 text-orange-600 border-orange-100 text-[8px] font-black gap-1.5 px-3">
                                          <Handshake className="h-3 w-3" /> {item.subcontractorName}
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] font-black px-3">{isRtl ? 'عمالة الشركة' : 'Internal'}</Badge>
                                      )}
                                   </TableCell>
                                   <TableCell className="py-4"><Input type="number" step="0.01" value={item.quantity === 0 ? '' : item.quantity} onChange={e => { const ni = [...loggedItems]; ni[idx].quantity = Number(e.target.value); setLoggedItems(ni); }} className="h-11 rounded-xl text-center font-black text-xl border-2 text-primary bg-primary/5 focus:bg-white" /></TableCell>
                                   <TableCell className="py-4 pe-6"><Input value={item.notes} onChange={e => { const ni = [...loggedItems]; ni[idx].notes = e.target.value; setLoggedItems(ni); }} className="h-11 rounded-xl text-xs font-bold border-2 bg-slate-50/30" placeholder="..." /></TableCell>
                                </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     </div>
                  </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6 border-t border-slate-100">
                  <div className="space-y-6">
                     <div className="flex justify-between items-center">
                        <div className="text-start">
                          <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{t('common.labor')}</Label>
                        </div>
                        <div className="flex gap-2">
                           <Select onValueChange={handleApplyGroup}>
                              <SelectTrigger className="h-8 w-40 rounded-xl text-[10px] font-black border-primary/20 bg-primary/5 text-primary"><SelectValue placeholder={tSafe('inline.load.group', 'تحميل طاقم...', 'Load Group')} /></SelectTrigger>
                              <SelectContent className="z-[160] rounded-xl">{workGroups?.map(g => <SelectItem key={g.id} value={g.id!} className="text-[10px] font-bold py-3">{g.name}</SelectItem>)}</SelectContent>
                           </Select>
                           <Button variant="outline" size="sm" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1, hours: 8, hourlyCostRef: 0, subcontractorId: '', subcontractorName: '' }])} className="h-8 rounded-xl border-2 font-black"><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                     </div>
                     <div className="space-y-3">
                        {laborDetails.map((l, i) => (
                          <div key={i} className="flex gap-2 items-start group p-4 rounded-2xl bg-slate-50/50 border-2 border-white shadow-inner">
                            <div className="flex-1 space-y-3">
                               <div className="grid grid-cols-1 gap-2">
                                  <Select value={l.trade} onValueChange={v => { 
                                    const emp = availableEmployees.find(x => x.fullName === v); 
                                    const nl = [...laborDetails]; 
                                    nl[i].trade = v; 
                                    nl[i].hourlyCostRef = (emp?.basicSalary || 0) / 26 / 8; 
                                    setLaborDetails(nl); 
                                  }}>
                                    <SelectTrigger className="h-10 rounded-xl border-2 text-[11px] font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl z-[160]">{availableEmployees.map(e => <SelectItem key={e.id} value={e.fullName} className="text-xs py-3">{e.fullName}</SelectItem>)}</SelectContent>
                                  </Select>
                               </div>
                               <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                     <Select value={l.subcontractorId} onValueChange={v => {
                                        const sub = subcontractors?.find((s:any) => s.id === v);
                                        const nl = [...laborDetails];
                                        nl[i].subcontractorId = v;
                                        nl[i].subcontractorName = sub?.name || '';
                                        setLaborDetails(nl);
                                     }}>
                                        <SelectTrigger className="h-9 rounded-lg border-2 text-[10px] font-black bg-white/50 border-primary/10"><SelectValue placeholder={tSafe('inline.belongs.to', 'جهة التبعية...', 'Belongs to')} /></SelectTrigger>
                                        <SelectContent className="rounded-xl z-[160]">
                                           <SelectItem value="INTERNAL" className="font-bold text-[10px]">{isRtl ? 'عمالة الشركة' : 'Internal Staff'}</SelectItem>
                                           {subcontractors?.map((s:any) => <SelectItem key={s.id} value={s.id!} className="font-bold text-[10px]">{s.name}</SelectItem>)}
                                        </SelectContent>
                                     </Select>
                                  </div>
                                  <Input type="number" value={l.count} onChange={e => { const nl = [...laborDetails]; nl[i].count = Number(e.target.value); setLaborDetails(nl); }} className="h-9 w-16 text-center text-xs font-black border-2 bg-white" />
                               </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-300 hover:text-rose-600 mt-0.5" onClick={() => setLaborDetails(laborDetails.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                     </div>
                  </div>
                  
                  <div className="space-y-6">
                     <div className="flex justify-between items-center text-start">
                        <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{t('common.equipment')}</Label>
                        <Button variant="outline" size="sm" onClick={() => setEquipmentUsed([...equipmentUsed, { equipmentId: '', hoursUsed: 4, hourlyRateRef: 0 }])} className="h-8 rounded-xl border-2 font-black"><Plus className="h-3.5 w-3.5" /></Button>
                     </div>
                     <div className="space-y-3">
                        {equipmentUsed.map((e, i) => (
                          <div key={i} className="flex gap-2 items-center group p-4 rounded-2xl bg-slate-50/50 border-2 border-white shadow-inner">
                             <Select value={e.equipmentId} onValueChange={v => { 
                               const equip = equipmentItems?.find((x:any) => x.id === v);
                               const ne = [...equipmentUsed]; 
                               ne[i].equipmentId = v; 
                               ne[i].name = equip?.name || '';
                               ne[i].hourlyRateRef = equip?.hourlyRentalRate || equip?.hourlyDepreciationRate || 0;
                               setEquipmentUsed(ne); 
                             }}>
                               <SelectTrigger className="h-10 rounded-xl border-2 text-[11px] font-bold bg-white flex-1"><SelectValue placeholder="..." /></SelectTrigger>
                               <SelectContent className="rounded-xl z-[160]">{equipmentItems?.map((x:any) => <SelectItem key={x.id} value={x.id!} className="text-xs py-3">{x.name}</SelectItem>)}</SelectContent>
                             </Select>
                             <div className="flex items-center gap-1.5 shrink-0">
                                <Label className="text-[8px] font-black text-slate-400">HRS</Label>
                                <Input type="number" value={e.hoursUsed} onChange={v => { const ne = [...equipmentUsed]; ne[i].hoursUsed = Number(v.target.value); setEquipmentUsed(ne); }} className="h-10 w-16 text-center text-xs font-black border-2 bg-white" />
                             </div>
                             <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-300 hover:text-rose-600" onClick={() => setEquipmentUsed(equipmentUsed.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-100/50 border-t flex flex-row gap-6 shrink-0 shadow-2xl">
               <Button variant="ghost" onClick={() => setIsRecordOpen(false)} className="flex-1 h-16 rounded-[2rem] font-bold text-slate-500">{t('common.cancel')}</Button>
               <Button onClick={handleRecordProgress} disabled={loadingAction === 'recording' || !selectedStageId} className="flex-[3] h-16 rounded-[2rem] font-black text-xl gap-4 shadow-2xl shadow-primary/20 border-b-8 border-orange-700 hover:scale-[1.02] transition-all">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} {t('construction.commitResources')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
