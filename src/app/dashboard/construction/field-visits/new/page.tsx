'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Save, Loader2, Plus, CheckCircle2, Trash2, 
  Truck, LayoutGrid, Hammer, Users, 
  Package, MapPin, Workflow, ShieldAlert,
  PlusCircle, X, UserCircle, HardHat,
  Search
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Employee, WorkGroup } from '@/types/hr';
import { Transaction, StageInstance } from '@/types/transaction';
import { BOQ, BOQItem } from '@/types/documents';
import { usePermissions } from '@/hooks/use-permissions';
import { BOQExecutionService } from '@/services/boq-execution-service';
import { SmartDateInput } from '@/components/ui/smart-date-input';

function NewFieldVisitForm() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [activeStage, setActiveStage] = useState<StageInstance | null>(null);
  const [loadingStage, setLoadingStage] = useState(false);

  const [staffRows, setStaffRows] = useState<any[]>([{ employeeId: '', position: '', count: 1 }]);
  const [equipRows, setEquipRows] = useState<any[]>([{ equipmentId: '', count: 1, hours: 8 }]);
  const [materialRows, setMaterialRows] = useState<any[]>([{ type: '', unit: '', quantity: 0 }]);
  const [executionRows, setExecutionRows] = useState<any[]>([{ boqItemId: '', quantity: '', notes: '' }]);

  const transQuery = useMemo(() => 
    (companyId && db) ? query(collection(db, paths.transactions(companyId)), where('status', '!=', 'completed')) : null, [db, companyId]);
  const empsQuery = useMemo(() => 
    (companyId && db) ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const equipQuery = useMemo(() => 
    (companyId && db) ? query(collection(db, paths.equipment(companyId)), where('status', '==', 'available')) : null, [db, companyId]);

  const { data: allTransactions } = useCollection<Transaction>(transQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);
  const { data: equipmentList } = useCollection<any>(equipQuery);

  const fieldProjects = useMemo(() => {
    return (allTransactions || []).filter(t => {
      const isField = t.activityTypeName?.includes('مقاولات') || t.activityTypeName?.includes('Construction') || t.activityTypeName?.includes('Design & Build');
      if (!isAdmin && globalUser?.employeeId) return isField && t.assignedEngineerId === globalUser.employeeId;
      return isField;
    });
  }, [allTransactions, isAdmin, globalUser]);

  const contractedClients = useMemo(() => {
    const clientsMap = new Map();
    fieldProjects.forEach(p => clientsMap.set(p.clientId, p.clientName));
    return Array.from(clientsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [fieldProjects]);

  const clientProjects = useMemo(() => selectedClientId ? fieldProjects.filter(p => p.clientId === selectedClientId) : [], [fieldProjects, selectedClientId]);

  useEffect(() => {
    async function fetchProjectContext() {
      if (!selectedProjectId || !db || !companyId) {
        setActiveStage(null);
        return;
      }
      setLoadingStage(true);
      try {
        const stagesPath = paths.transactionStages(companyId, selectedProjectId);
        const stagesSnap = await getDocs(query(collection(db, stagesPath)));
        const allStages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StageInstance));
        const current = allStages.find(s => s.status === 'in-progress');
        setActiveStage(current || null);
      } finally {
        setLoadingStage(false);
      }
    }
    fetchProjectContext();
  }, [selectedProjectId, db, companyId]);

  const boqQuery = useMemo(() => companyId && db && selectedProjectId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', selectedProjectId)) : null, [db, companyId, selectedProjectId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: allBoqItems } = useCollection<BOQItem>(itemsQuery);

  const filteredBoqItems = useMemo(() => {
    if (!activeStage || !allBoqItems) return [];
    return allBoqItems.filter(i => (i.technicalStageIds?.includes(activeStage.technicalStageId) || i.technicalStageId === activeStage.technicalStageId));
  }, [activeStage, allBoqItems]);

  const handleSave = async () => {
    if (!db || !companyId || !user || !selectedProjectId || !activeBoq || !activeStage) return;
    
    setLoading(true);
    try {
      const execService = new BOQExecutionService(db, companyId, permissions);
      const visitRef = doc(collection(db, paths.fieldVisits(companyId)));
      const project = allTransactions?.find(t => t.id === selectedProjectId);
      const officialName = globalUser?.fullName || user.displayName || 'Engineer';

      for (const row of executionRows.filter(r => r.boqItemId && Number(r.quantity) > 0)) {
         await execService.recordBOQItemExecution(
           activeBoq.id, row.boqItemId, activeStage.technicalStageId, Number(row.quantity),
           user.uid, officialName, row.notes || '', activeStage.id!, false, '', 
           { laborDetails: [], equipmentUsed: [] }
         );
      }

      await setDoc(visitRef, {
        id: visitRef.id,
        companyId,
        transactionId: selectedProjectId,
        transactionNumber: project?.transactionNumber || '',
        clientId: selectedClientId,
        clientName: project?.clientName || '',
        activeStageId: activeStage.id,
        activeStageName: activeStage.name,
        visitDate,
        items: executionRows.filter(r => r.boqItemId).map(r => ({
          ...r,
          itemName: allBoqItems?.find(i => i.id === r.boqItemId)?.referenceTitle || '',
          unit: allBoqItems?.find(i => i.id === r.boqItemId)?.unitSymbol || '',
          executionStatus: 'executed'
        })),
        staffDetails: staffRows.filter(s => s.employeeId).map(s => ({
           ...s,
           employeeName: employees?.find(e => e.id === s.employeeId)?.fullName || ''
        })),
        equipmentUsed: equipRows.filter(e => e.equipmentId).map(e => ({
           ...e,
           equipmentName: equipmentList?.find(eq => eq.id === e.equipmentId)?.name || ''
        })),
        materialsDelivered: materialRows.filter(m => m.type),
        engineerId: globalUser?.employeeId || user.uid,
        engineerName: officialName,
        status: 'submitted',
        createdAt: serverTimestamp(),
      });

      toast({ title: t('construction.visitCreated') });
      router.push('/dashboard/construction/field-visits');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-20 animate-in fade-in duration-500 text-start bg-slate-50/30" dir={dir}>
      
      <header className="sticky top-0 z-50 flex justify-between items-center gap-6 border-b bg-white/95 backdrop-blur-md px-8 py-5 shadow-sm border-primary/10">
        <div className="flex items-center gap-5 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/5 shadow-inner">
            <PlusCircle className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">
               {tSafe('inline.new.field.report', 'تسجيل تقرير ميداني جديد', 'New Field Report')}
            </h1>
            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-black uppercase mt-1 tracking-widest px-3">Center of Site Operations</Badge>
          </div>
        </div>

        <div className="flex gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-xl font-black h-12 px-8 border-2 border-slate-100 bg-white hover:bg-slate-50 transition-all">{t('common.cancel')}</Button>
           <Button onClick={handleSave} disabled={loading || !activeStage} className="h-12 px-12 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 gap-3 border-b-8 border-orange-700 hover:scale-[1.02] active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} 
              {tSafe('inline.commit.report.now', 'اعتماد التقرير الآن', 'Commit Report Now')}
           </Button>
        </div>
      </header>

      <div className="px-8 space-y-10">
         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden w-full">
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-4 gap-10 items-center">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.clients')}</Label>
                   <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedProjectId(''); }}>
                      <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50 shadow-inner"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl z-[150] shadow-3xl border-0">{contractedClients.map(c => <SelectItem key={c.id} value={c.id} className="font-bold py-4 border-b last:border-0">{c.name}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.projects')}</Label>
                   <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50 shadow-inner"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl z-[150] shadow-3xl border-0">{clientProjects.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-4 border-b last:border-0">{p.subServiceName}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><Workflow className="h-3 w-3" /> {tSafe('inline.active.stage', 'المرحلة النشطة', 'Active Stage')}</Label>
                   {loadingStage ? <div className="h-14 flex items-center animate-pulse"><Loader2 className="h-5 w-5 animate-spin text-primary/30" /></div> : activeStage ? (
                     <div className="h-14 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex items-center px-6 gap-4 shadow-sm group">
                        <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110"><Workflow className="h-4 w-4" /></div>
                        <span className="text-sm font-black text-emerald-800 truncate">{activeStage.name}</span>
                     </div>
                   ) : selectedProjectId && (
                     <div className="h-14 rounded-2xl bg-rose-50 border-2 border-dashed border-rose-200 flex items-center px-6 text-rose-500">
                        <ShieldAlert className="h-4 w-4 me-3" />
                        <span className="text-[11px] font-bold italic">{isRtl ? 'لا توجد مرحلة نشطة.' : 'No active stage found.'}</span>
                     </div>
                   )}
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.date')}</Label>
                   <SmartDateInput value={visitDate} onChange={setVisitDate} className="h-14" />
                </div>
            </CardContent>
         </Card>

         <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row justify-between items-center">
               <div className="text-start">
                  <CardTitle className="text-xl font-black font-headline flex items-center gap-4 text-slate-800">
                     <Hammer className="h-7 w-7 text-primary" /> 
                     {tSafe('inline.work.items.execution.grid', 'إنجاز بنود المقايسة (BOQ)', 'Work Items Execution Grid')}
                  </CardTitle>
               </div>
               <Button variant="outline" onClick={() => setExecutionRows([...executionRows, { boqItemId: '', quantity: '', notes: '' }])} className="rounded-xl h-11 px-8 font-black border-2 gap-3 bg-white hover:bg-primary/5 transition-all">
                  <Plus className="h-5 w-5 text-primary" /> {t('common.add')}
               </Button>
            </CardHeader>
            <CardContent className="p-0">
               <Table className="w-full">
                  <TableHeader>
                     <TableRow className="bg-white hover:bg-transparent border-b-2 border-slate-100">
                        <TableHead className="ps-10 text-start text-xs font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'بند العمل المرجعي' : 'Reference Work Item'}</TableHead>
                        <TableHead className="text-center w-[180px] text-xs font-black uppercase text-primary tracking-widest">{t('common.quantity')}</TableHead>
                        <TableHead className="text-start text-xs font-black uppercase text-slate-400 tracking-widest">{t('common.notes')}</TableHead>
                        <TableHead className="w-16"></TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {executionRows.map((row, idx) => (
                        <TableRow key={idx} className="border-b last:border-0 hover:bg-primary/[0.01] transition-colors">
                           <TableCell className="ps-10 py-6 text-start">
                              <Select value={row.boqItemId} onValueChange={v => { const nr = [...executionRows]; nr[idx].boqItemId = v; setExecutionRows(nr); }}>
                                 <SelectTrigger className="h-12 rounded-xl border-2 font-black text-sm bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                                 <SelectContent className="rounded-2xl z-[160] shadow-3xl max-h-[400px]">
                                    {filteredBoqItems.map(i => (
                                       <SelectItem key={i.id} value={i.id!} className="font-bold py-4 border-b last:border-0 border-slate-50">
                                          <div className="flex flex-col text-start">
                                             <span className="text-slate-800 text-sm">{i.referenceTitle}</span>
                                             <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">CODE: {i.referenceCode}</span>
                                          </div>
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </TableCell>
                           <TableCell className="py-6">
                              <div className="relative group">
                                 <Input type="number" step="0.01" value={row.quantity} onChange={e => { const nr = [...executionRows]; nr[idx].quantity = e.target.value; setExecutionRows(nr); }} className="h-14 rounded-2xl text-center font-black text-3xl border-2 text-primary bg-primary/5 focus:bg-white transition-all shadow-inner" />
                              </div>
                           </TableCell>
                           <TableCell className="py-6">
                              <Input value={row.notes} onChange={e => { const nr = [...executionRows]; nr[idx].notes = e.target.value; setExecutionRows(nr); }} className="h-14 text-sm font-bold border-2 bg-slate-50/50 focus:bg-white rounded-xl px-6" placeholder="..." />
                           </TableCell>
                           <TableCell className="pe-8 text-center">
                              <button onClick={() => setExecutionRows(executionRows.filter((_, i) => i !== idx))} className="text-rose-200 hover:text-rose-600 transition-colors hover:scale-110 p-2">
                                 <Trash2 className="h-6 w-6" />
                              </button>
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </CardContent>
         </Card>

         <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 pb-20">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50/80 border-b p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black uppercase text-slate-700 tracking-widest flex items-center gap-2">
                       <UserCircle className="h-4 w-4" /> 
                       {tSafe('inline.staff.resources', 'الموارد البشرية', 'Staff Resources')}
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setStaffRows([...staffRows, { employeeId: '', position: '', count: 1 }])} className="text-primary hover:bg-primary/5 rounded-full"><PlusCircle className="h-6 w-6" /></Button>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-white border-b-2">
                        <TableRow>
                           <TableHead className="ps-6 text-start text-[10px] font-black text-slate-400 uppercase">Employee / Position</TableHead>
                           <TableHead className="text-center w-24 text-[10px] font-black text-slate-400 uppercase">Count</TableHead>
                           <TableHead className="w-12"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {staffRows.map((row, idx) => (
                           <TableRow key={idx} className="border-b last:border-0 hover:bg-slate-50/50">
                              <TableCell className="ps-6 py-3">
                                 <Select value={row.employeeId} onValueChange={v => {
                                    const emp = employees?.find(e => e.id === v);
                                    const nr = [...staffRows];
                                    nr[idx] = { ...nr[idx], employeeId: v, position: emp?.jobTitle || '' };
                                    setStaffRows(nr);
                                 }}>
                                    <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl z-[160] shadow-3xl">
                                       {employees?.map(e => (
                                         <SelectItem key={e.id} value={e.id!} className="font-bold py-3">
                                            {e.fullName} <Badge variant="outline" className="ms-2 text-[8px] h-4 border-0 bg-slate-100">{e.jobTitle}</Badge>
                                         </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </TableCell>
                              <TableCell className="py-3">
                                 <Input type="number" value={row.count} onChange={e => { const nr = [...staffRows]; nr[idx].count = e.target.value; setStaffRows(nr); }} className="h-10 text-center font-black border-2 rounded-xl" />
                              </TableCell>
                              <TableCell className="pe-4 text-center">
                                 <button onClick={() => setStaffRows(staffRows.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 p-1"><X className="h-4 w-4" /></button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50/80 border-b p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black uppercase text-slate-700 tracking-widest flex items-center gap-2">
                       <Truck className="h-4 w-4" /> 
                       {tSafe('common.equipment', 'المعدات والآليات', 'Equipment')}
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEquipRows([...equipRows, { equipmentId: '', count: 1, hours: 8 }])} className="text-primary hover:bg-primary/5 rounded-full"><PlusCircle className="h-6 w-6" /></Button>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-white border-b-2">
                        <TableRow>
                           <TableHead className="ps-6 text-start text-[10px] font-black text-slate-400 uppercase">Type / Name</TableHead>
                           <TableHead className="text-center w-24 text-[10px] font-black text-slate-400 uppercase">Qty</TableHead>
                           <TableHead className="text-center w-24 text-[10px] font-black text-slate-400 uppercase">Hours</TableHead>
                           <TableHead className="w-12"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {equipRows.map((row, idx) => (
                           <TableRow key={idx} className="border-b last:border-0 hover:bg-slate-50/50">
                              <TableCell className="ps-6 py-3">
                                 <Select value={row.equipmentId} onValueChange={v => { const nr = [...equipRows]; nr[idx].equipmentId = v; setEquipRows(nr); }}>
                                    <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl z-[160] shadow-3xl">
                                       {equipmentList?.map(eq => (
                                         <SelectItem key={eq.id} value={eq.id!} className="font-bold py-3">
                                            {eq.name} <span className="text-[8px] text-slate-400">({eq.code})</span>
                                         </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </TableCell>
                              <TableCell className="py-3">
                                 <Input type="number" value={row.count} onChange={e => { const nr = [...equipRows]; nr[idx].count = e.target.value; setEquipRows(nr); }} className="h-10 text-center font-black border-2 rounded-xl" />
                              </TableCell>
                              <TableCell className="py-3">
                                 <Input type="number" value={row.hours} onChange={e => { const nr = [...equipRows]; nr[idx].hours = e.target.value; setEquipRows(nr); }} className="h-10 text-center font-black border-2 rounded-xl" />
                              </TableCell>
                              <TableCell className="pe-4 text-center">
                                 <button onClick={() => setEquipRows(equipRows.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 p-1"><X className="h-4 w-4" /></button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>

            <Card className="xl:col-span-2 border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50/80 border-b p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black uppercase text-slate-700 tracking-widest flex items-center gap-2">
                       <Package className="h-4 w-4" /> 
                       {tSafe('inline.materials', 'المواد الموردة للموقع', 'Materials')}
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setMaterialRows([...materialRows, { type: '', unit: '', quantity: 0 }])} className="text-primary hover:bg-primary/5 rounded-full"><PlusCircle className="h-6 w-6" /></Button>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-white border-b-2">
                        <TableRow>
                           <TableHead className="ps-10 text-start text-[10px] font-black text-slate-400 uppercase">Material Description</TableHead>
                           <TableHead className="text-center w-32 text-[10px] font-black text-slate-400 uppercase">Unit</TableHead>
                           <TableHead className="text-center w-40 text-[10px] font-black text-primary uppercase">Quantity Delivered</TableHead>
                           <TableHead className="w-16"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {materialRows.map((row, idx) => (
                           <TableRow key={idx} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                              <TableCell className="ps-10 py-4">
                                 <Input value={row.type} onChange={e => { const nr = [...materialRows]; nr[idx].type = e.target.value; setMaterialRows(nr); }} className="h-11 border-2 font-bold bg-white rounded-xl shadow-inner" placeholder="..." />
                              </TableCell>
                              <TableCell className="py-4">
                                 <Input value={row.unit} onChange={e => { const nr = [...materialRows]; nr[idx].unit = e.target.value; setMaterialRows(nr); }} className="h-11 text-center border-2 font-bold uppercase text-[10px] rounded-xl" placeholder="..." />
                              </TableCell>
                              <TableCell className="py-4">
                                 <Input type="number" value={row.quantity} onChange={e => { const nr = [...materialRows]; nr[idx].quantity = e.target.value; setMaterialRows(nr); }} className="h-11 text-center border-2 font-black text-xl text-primary rounded-xl bg-primary/5" />
                              </TableCell>
                              <TableCell className="pe-8 text-center">
                                 <button onClick={() => setMaterialRows(materialRows.filter((_, i) => i !== idx))} className="text-rose-200 hover:text-rose-600 transition-colors p-2"><Trash2 className="h-5 w-5" /></button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}

export default function NewStructuredFieldVisitPage() {
   return <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin text-primary" /></div>}><NewFieldVisitForm /></Suspense>;
}
