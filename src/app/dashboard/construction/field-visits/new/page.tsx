'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Save, Loader2, ArrowRight, Camera, Users, Target,
  Plus, CheckCircle2, Trash2, Truck, LayoutGrid, Sparkles,
  Workflow, Clock, AlertTriangle, Hammer, PlusCircle,
  ShieldAlert, Landmark, HardHat, Info, CalendarDays,
  X, Trash
} from "lucide-react";
import { useFirestore, useCollection, useFirebaseApp } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function NewFieldVisitForm() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const firebaseApp = useFirebaseApp();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("execution");
  
  const [activeStage, setActiveStage] = useState<StageInstance | null>(null);
  const [loadingStage, setLoadingStage] = useState(false);

  const [laborDetails, setLaborDetails] = useState<any[]>([{ trade: '', count: 1, hours: 8, hourlyCostRef: 0 }]);
  const [equipmentUsed, setEquipmentUsed] = useState<any[]>([{ equipmentId: '', name: '', hoursUsed: 4, hourlyRateRef: 0 }]);

  const [gridRows, setGridRows] = useState<any[]>([
    { boqItemId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }
  ]);

  const transQuery = useMemo(() => 
    (companyId && db) ? query(collection(db, paths.transactions(companyId)), where('status', '!=', 'completed')) : null, [db, companyId]);
  const { data: allTransactions } = useCollection<Transaction>(transQuery);

  const fieldProjects = useMemo(() => {
    return (allTransactions || []).filter(t => {
      const isField = t.activityTypeName?.includes('مقاولات') || t.activityTypeName?.includes('Construction') || t.activityTypeName?.includes('Design & Build');
      if (!isAdmin && globalUser?.employeeId) return isField && t.assignedEngineerId === globalUser.employeeId;
      return isField;
    });
  }, [allTransactions, isAdmin, globalUser]);

  const contractedClients = useMemo(() => {
    const clientsMap = new Map();
    fieldProjects.forEach(p => {
       clientsMap.set(p.clientId, p.clientName);
    });
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
        // الفلترة في الذاكرة لتجنب الحاجة لفهارس مركبة (Index Bypass)
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

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const groupsQuery = useMemo(() => companyId && db ? query(collection(db, paths.workGroups(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  const { data: workGroups } = useCollection<WorkGroup>(groupsQuery);

  const inventoryQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('status', '==', 'available')) : null, [db, companyId]);
  const { data: equipmentItems } = useCollection<any>(inventoryQuery);

  const handlePhotoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !companyId || !firebaseApp) return;
    
    updateRow(idx, 'isUploading', true);
    const storage = getStorage(firebaseApp);
    const urls: string[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const sRef = ref(storage, `site_logs/${companyId}/${Date.now()}_${files[i].name}`);
        const snap = await uploadBytes(sRef, files[i]);
        const url = await getDownloadURL(snap.ref);
        urls.push(url);
      }
      const newPhotos = [...(gridRows[idx].photoUrls || []), ...urls];
      updateRow(idx, 'photoUrls', newPhotos);
      toast({ title: t('common.photosUploaded') });
    } finally {
      updateRow(idx, 'isUploading', false);
    }
  };

  const updateRow = (idx: number, field: string, val: any) => {
    const newRows = [...gridRows];
    newRows[idx][field] = val;
    setGridRows(newRows);
  };

  const handleApplyGroup = (groupId: string) => {
     const group = workGroups?.find(g => g.id === groupId);
     if (!group) return;
     const groupLabor = (group.memberIds || []).map(mid => {
        const emp = employees?.find(e => e.id === mid);
        return { trade: emp?.fullName || 'Worker', count: 1, hours: 8, hourlyCostRef: (emp?.basicSalary || 0) / 26 / 8 };
     });
     const supervisor = employees?.find(e => e.id === group.supervisorId);
     if (supervisor) {
        groupLabor.unshift({ trade: supervisor.fullName, count: 1, hours: 8, hourlyCostRef: (supervisor.basicSalary || 0) / 26 / 8 });
     }
     setLaborDetails([...laborDetails.filter(l => l.trade), ...groupLabor]);
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !selectedProjectId || !activeBoq || !activeStage) return;
    const validRows = gridRows.filter(r => r.boqItemId && Number(r.quantity) > 0);
    
    setLoading(true);
    try {
      const execService = new BOQExecutionService(db, companyId, permissions);
      const visitRef = doc(collection(db, paths.fieldVisits(companyId)));
      const project = allTransactions?.find(t => t.id === selectedProjectId);
      const officialName = globalUser?.fullName || user.displayName || 'Engineer';

      for (const row of validRows) {
         await execService.recordBOQItemExecution(
           activeBoq.id, row.boqItemId, activeStage.technicalStageId, Number(row.quantity),
           user.uid, officialName, row.notes || '', activeStage.id!, false, '', 
           { laborDetails: laborDetails.filter(l => l.trade), equipmentUsed: equipmentUsed.filter(e => e.equipmentId) }
         );
      }

      await setDoc(visitRef, {
        id: visitRef.id, companyId, transactionId: selectedProjectId, transactionNumber: project?.transactionNumber || '',
        clientId: selectedClientId, clientName: project?.clientName || '',
        activeStageId: activeStage.id, activeStageName: activeStage.name,
        visitDate, items: gridRows.filter(r => r.boqItemId).map(r => {
           const boqItem = allBoqItems?.find(i => i.id === r.boqItemId);
           return { ...r, itemName: boqItem?.referenceTitle || '', executionStatus: 'executed' };
        }),
        laborDetails: laborDetails.filter(l => l.trade),
        equipmentUsed: equipmentUsed.filter(e => e.equipmentId),
        engineerId: globalUser?.employeeId || user.uid, engineerName: officialName,
        status: 'submitted', createdAt: serverTimestamp(),
      });
      toast({ title: t('construction.visitCreated') });
      router.push('/dashboard/construction/field-visits');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto pb-32 animate-in fade-in duration-500 text-start bg-[#fdfaf3]" dir={dir}>
      
      {/* Header السيادي الفاتح */}
      <header className="sticky top-0 z-50 flex flex-col md:flex-row justify-between items-center gap-4 border-b bg-white/90 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4 text-start">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/5 shadow-inner">
            <PlusCircle className="h-7 w-7" />
          </div>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'تقرير ميداني ذكي' : 'Smart Field Report'}</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Live Execution Center</p>
          </div>
        </div>

        <div className="flex gap-3">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-xl font-bold h-10 px-6 border-2 border-slate-100 bg-white hover:bg-slate-50">{t('common.cancel')}</Button>
           <Button onClick={handleSave} disabled={loading || !activeStage} className="h-10 px-10 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 gap-2 border-b-4 border-orange-700 hover:scale-105 active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} 
              {isRtl ? 'اعتماد التقرير الآن' : 'Commit Report Now'}
           </Button>
        </div>
      </header>

      <div className="px-6 space-y-6">
         {/* Context Bar: المعلومات الأساسية في شريط واحد مدمج */}
         <Card className="border-0 shadow-lg rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <div className="space-y-1">
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('common.clients')}</Label>
                   <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedProjectId(''); }}>
                      <SelectTrigger className="h-10 rounded-xl border-2 font-black bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl z-[150]">{contractedClients.map(c => <SelectItem key={c.id} value={c.id} className="font-bold py-3 border-b last:border-0">{c.name}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
                <div className="space-y-1">
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('common.projects')}</Label>
                   <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="h-10 rounded-xl border-2 font-black bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl z-[150]">{clientProjects.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 border-b last:border-0">{p.subServiceName}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
                <div className="space-y-1">
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المرحلة النشطة' : 'Active Stage'}</Label>
                   {loadingStage ? <div className="h-10 flex items-center animate-pulse"><Loader2 className="h-4 w-4 animate-spin text-primary/30" /></div> : activeStage ? (
                     <div className="h-10 rounded-xl bg-emerald-50 border-2 border-emerald-100 flex items-center px-4 gap-3">
                        <Workflow className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs font-black text-emerald-800 truncate">{activeStage.name}</span>
                     </div>
                   ) : <div className="h-10 rounded-xl bg-slate-100 border-2 border-dashed flex items-center px-4 italic text-[10px] text-slate-400">---</div>}
                </div>
                <div className="space-y-1">
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('common.date')}</Label>
                   <SmartDateInput value={visitDate} onChange={setVisitDate} className="h-10" />
                </div>
            </CardContent>
         </Card>

         {/* Main Operations Hub: تبويبات عريضة للبيانات الضخمة */}
         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white border-2 border-slate-100 rounded-2xl h-14 p-1.5 gap-2 shadow-sm mb-6 inline-flex">
               <TabsTrigger value="execution" className="rounded-xl px-10 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                  <Hammer className="h-4 w-4" /> {isRtl ? 'إنجاز البنود' : 'Execution'}
                  <Badge variant="outline" className="bg-white/20 border-0 h-5 px-2 text-[9px]">{gridRows.filter(r => r.boqItemId).length}</Badge>
               </TabsTrigger>
               <TabsTrigger value="labor" className="rounded-xl px-10 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                  <Users className="h-4 w-4" /> {isRtl ? 'العمالة والمشرفين' : 'Human Resources'}
                  <Badge variant="outline" className="bg-white/20 border-0 h-5 px-2 text-[9px]">{laborDetails.filter(l => l.trade).length}</Badge>
               </TabsTrigger>
               <TabsTrigger value="equipment" className="rounded-xl px-10 font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                  <Truck className="h-4 w-4" /> {isRtl ? 'المعدات والآليات' : 'Equipment'}
                  <Badge variant="outline" className="bg-white/20 border-0 h-5 px-2 text-[9px]">{equipmentUsed.filter(e => e.equipmentId).length}</Badge>
               </TabsTrigger>
            </TabsList>

            <TabsContent value="execution" className="animate-in fade-in duration-300">
               <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                  <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row justify-between items-center">
                     <div className="text-start">
                        <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3"><LayoutGrid className="h-6 w-6 text-primary" /> {t('construction.siteProgress')}</CardTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{isRtl ? 'توثيق الإنجاز الكمي والمواصفة' : 'Log quantities and specs'}</p>
                     </div>
                     <Button variant="outline" size="sm" onClick={() => setGridRows([...gridRows, { boqItemId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }])} className="rounded-xl h-11 px-8 font-black border-2 bg-white hover:bg-slate-50 shadow-sm gap-2">
                        <Plus className="h-4 w-4" /> {isRtl ? 'إضافة بند تنفيذ' : 'Add Item'}
                     </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                     <Table>
                        <TableHeader className="bg-slate-50/50">
                           <TableRow className="border-0">
                              <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'بند العمل المرجعي' : 'BOQ Item'}</TableHead>
                              <TableHead className="text-center w-[150px] text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.quantity')}</TableHead>
                              <TableHead className="text-center w-[150px] text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.photos')}</TableHead>
                              <TableHead className="pe-10"></TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {gridRows.map((row, idx) => (
                              <TableRow key={idx} className="border-b-slate-100 transition-colors hover:bg-primary/[0.01]">
                                 <TableCell className="ps-10 py-6 text-start">
                                    <div className="max-w-2xl space-y-3">
                                       <Select value={row.boqItemId} onValueChange={v => updateRow(idx, 'boqItemId', v)}>
                                          <SelectTrigger className="h-12 rounded-xl border-2 font-black text-sm bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                                          <SelectContent className="rounded-2xl border-0 shadow-3xl z-[160] max-h-[400px]">
                                             {filteredBoqItems.length === 0 ? (
                                               <div className="p-8 text-center flex flex-col items-center gap-3 opacity-30">
                                                  <ShieldAlert className="h-8 w-8" />
                                                  <p className="text-xs font-black">{isRtl ? 'لا توجد بنود لهذه المرحلة' : 'No items for this stage'}</p>
                                               </div>
                                             ) : filteredBoqItems.map(i => (
                                                <SelectItem key={i.id} value={i.id!} className="font-bold py-4 border-b last:border-0">
                                                   <div className="flex flex-col text-start gap-1">
                                                      <span className="text-sm font-black">{i.referenceTitle}</span>
                                                      <div className="flex items-center gap-2">
                                                         <span className="text-[8px] text-slate-400 font-mono uppercase tracking-tighter">#{i.referenceCode}</span>
                                                         <Badge className="bg-slate-100 text-slate-500 border-0 text-[7px] font-black h-4 px-2 uppercase">{tSafe('inline.remaining', 'المتبقي:', 'REM:')} {(i.plannedQuantity || 0) - (i.executedQuantity || 0)} {i.unitSymbol}</Badge>
                                                      </div>
                                                   </div>
                                                </SelectItem>
                                             ))}
                                          </SelectContent>
                                       </Select>
                                       <Input value={row.notes} onChange={e => updateRow(idx, 'notes', e.target.value)} className="h-10 text-xs mt-2 border-2 bg-slate-50/30 font-medium rounded-xl" placeholder={isRtl ? "ملاحظات فنية عن جودة التنفيذ أو الموقع..." : "Technical notes..."} />
                                    </div>
                                 </TableCell>
                                 <TableCell className="py-6 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                       <Input type="number" step="0.01" value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} className="h-14 w-28 text-center font-black text-2xl rounded-2xl border-2 bg-white text-primary shadow-inner" />
                                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{row.boqItemId ? allBoqItems?.find(i => i.id === row.boqItemId)?.unitSymbol : '---'}</span>
                                    </div>
                                 </TableCell>
                                 <TableCell className="py-6 text-center">
                                    <div className="flex items-center justify-center gap-3">
                                       <label className="h-14 w-14 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center cursor-pointer hover:bg-white hover:border-primary/40 transition-all shadow-sm">
                                          {row.isUploading ? <Loader2 className="h-6 w-6 animate-spin text-primary/30" /> : <Camera className="h-7 w-7 text-slate-300" />}
                                          <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(idx, e)} disabled={row.isUploading} />
                                       </label>
                                       {row.photoUrls?.length > 0 && <Badge className="bg-emerald-600 text-white font-black h-7 w-7 p-0 flex items-center justify-center rounded-xl shadow-lg border-2 border-white">{row.photoUrls.length}</Badge>}
                                    </div>
                                 </TableCell>
                                 <TableCell className="pe-10 text-end">
                                    <Button variant="ghost" size="icon" onClick={() => setGridRows(gridRows.filter((_, i) => i !== idx))} className="h-10 w-10 text-rose-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 className="h-5 w-5" /></Button>
                                 </TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value="labor" className="animate-in fade-in duration-300">
               <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                  <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row justify-between items-center">
                     <div className="text-start">
                        <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3"><Users className="h-6 w-6 text-primary" /> {isRtl ? 'الموارد البشرية' : 'Human Resources'}</CardTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{isRtl ? 'تسجيل حضور وتكاليف العمالة' : 'Log worker attendance and costs'}</p>
                     </div>
                     <div className="flex gap-4">
                        <Select onValueChange={handleApplyGroup}>
                           <SelectTrigger className="h-11 w-56 rounded-xl border-2 font-black text-xs bg-white shadow-sm"><SelectValue placeholder={t('common.loadFromGroup')} /></SelectTrigger>
                           <SelectContent className="rounded-2xl z-[160]">{workGroups?.map(g => <SelectItem key={g.id} value={g.id!} className="font-bold py-3">{g.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1, hours: 8, hourlyCostRef: 0 }])} className="rounded-xl h-11 px-6 font-black border-2 gap-2 bg-white"><Plus className="h-4 w-4" /> {isRtl ? 'إضافة عامل' : 'Add Labor'}</Button>
                     </div>
                  </CardHeader>
                  <CardContent className="p-8">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {laborDetails.map((l, i) => (
                           <div key={i} className="p-6 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner flex flex-col gap-4 group relative">
                              <button onClick={() => setLaborDetails(laborDetails.filter((_, idx) => idx !== i))} className="absolute top-4 end-4 opacity-0 group-hover:opacity-100 text-rose-300 hover:text-rose-600 transition-all"><X className="h-4 w-4" /></button>
                              <div className="space-y-1 text-start">
                                 <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'الموظف / التخصص' : 'Employee / Trade'}</Label>
                                 <Select value={l.trade} onValueChange={v => { const emp = employees?.find(x => x.fullName === v); const nl = [...laborDetails]; nl[i].trade = v; nl[i].hourlyCostRef = (emp?.basicSalary || 0) / 26 / 8; setLaborDetails(nl); }}>
                                    <SelectTrigger className="h-10 rounded-xl border-2 bg-white font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="rounded-2xl z-[161] max-h-[300px]">{employees?.map(e => <SelectItem key={e.id} value={e.fullName} className="font-bold py-2 border-b last:border-0">{e.fullName}</SelectItem>)}</SelectContent>
                                 </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1 text-start">
                                    <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'العدد' : 'Count'}</Label>
                                    <Input type="number" value={l.count} onChange={e => { const nl = [...laborDetails]; nl[i].count = Number(e.target.value); setLaborDetails(nl); }} className="h-10 text-center font-black rounded-xl border-2 bg-white" />
                                 </div>
                                 <div className="space-y-1 text-start">
                                    <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'ساعات العمل' : 'Hours'}</Label>
                                    <Input type="number" value={l.hours} onChange={e => { const nl = [...laborDetails]; nl[i].hours = Number(e.target.value); setLaborDetails(nl); }} className="h-10 text-center font-black rounded-xl border-2 bg-white" />
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                     {laborDetails.length === 0 && <div className="py-24 text-center border-4 border-dashed rounded-[3rem] bg-slate-50/50 flex flex-col items-center gap-4 text-slate-300">
                        <Users className="h-12 w-12 opacity-10" />
                        <p className="font-black text-sm uppercase italic">{isRtl ? 'لا يوجد عمالة مسجلة' : 'No labor logged'}</p>
                     </div>}
                  </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value="equipment" className="animate-in fade-in duration-300">
               <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                  <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row justify-between items-center">
                     <div className="text-start">
                        <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3"><Truck className="h-6 w-6 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Heavy Equipment'}</CardTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{isRtl ? 'توثيق استخدام الآليات الثقيلة' : 'Log machinery usage'}</p>
                     </div>
                     <Button variant="outline" size="sm" onClick={() => setEquipmentUsed([...equipmentUsed, { equipmentId: '', name: '', hoursUsed: 4, hourlyRateRef: 0 }])} className="rounded-xl h-11 px-8 font-black border-2 bg-white gap-2 shadow-sm"><Plus className="h-4 w-4" /> {isRtl ? 'إضافة معدة' : 'Add Equipment'}</Button>
                  </CardHeader>
                  <CardContent className="p-8">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {equipmentUsed.map((e, i) => (
                           <div key={i} className="p-6 rounded-[2rem] bg-blue-50/30 border-2 border-white shadow-inner flex flex-col gap-4 group relative">
                              <button onClick={() => setEquipmentUsed(equipmentUsed.filter((_, idx) => idx !== i))} className="absolute top-4 end-4 opacity-0 group-hover:opacity-100 text-blue-300 hover:text-blue-600 transition-all"><X className="h-4 w-4" /></button>
                              <div className="space-y-1 text-start">
                                 <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'المعدة / الآلية' : 'Equipment'}</Label>
                                 <Select value={e.equipmentId} onValueChange={v => { const equip = equipmentItems?.find((x:any) => x.id === v); const ne = [...equipmentUsed]; ne[i].equipmentId = v; ne[i].name = equip?.name || ''; ne[i].hourlyRateRef = equip?.hourlyRentalRate || equip?.hourlyDepreciationRate || 0; setEquipmentUsed(ne); }}>
                                    <SelectTrigger className="h-10 rounded-xl border-2 bg-white font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="rounded-2xl z-[161] max-h-[300px]">{equipmentItems?.map((x:any) => <SelectItem key={x.id} value={x.id!} className="font-bold py-2 border-b last:border-0">{x.name}</SelectItem>)}</SelectContent>
                                 </Select>
                              </div>
                              <div className="space-y-1 text-start">
                                 <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'ساعات التشغيل' : 'Operating Hours'}</Label>
                                 <Input type="number" value={e.hoursUsed} onChange={v => { const ne = [...equipmentUsed]; ne[i].hoursUsed = Number(v.target.value); setEquipmentUsed(ne); }} className="h-10 text-center font-black rounded-xl border-2 bg-white text-blue-600" />
                              </div>
                           </div>
                        ))}
                     </div>
                     {equipmentUsed.length === 0 && <div className="py-24 text-center border-4 border-dashed rounded-[3rem] bg-slate-50/50 flex flex-col items-center gap-4 text-slate-300">
                        <Truck className="h-12 w-12 opacity-10" />
                        <p className="font-black text-sm uppercase italic">{isRtl ? 'لا توجد معدات مسجلة' : 'No equipment logged'}</p>
                     </div>}
                  </CardContent>
               </Card>
            </TabsContent>
         </Tabs>
      </div>

      {/* Floating Action Bar (Sticky Bottom) */}
      <footer className="fixed bottom-6 left-6 right-6 z-[100] print:hidden">
         <div className="max-w-[1550px] mx-auto bg-slate-900/90 text-white backdrop-blur-xl rounded-[2.5rem] p-6 shadow-3xl flex flex-col md:flex-row items-center justify-between gap-8 border border-white/10 ring-8 ring-black/[0.02]">
            <div className="flex gap-10 items-center">
               <div className="text-start">
                  <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mb-1">{isRtl ? 'بنود العمل' : 'BOQ ITEMS'}</p>
                  <h3 className="text-2xl font-black font-mono">{gridRows.filter(r => r.boqItemId).length}</h3>
               </div>
               <div className="w-[1px] h-10 bg-white/10" />
               <div className="text-start">
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">{isRtl ? 'طاقم العمل' : 'WORKFORCE'}</p>
                  <h3 className="text-2xl font-black font-mono">{laborDetails.filter(l => l.trade).length} <span className="text-[10px] font-bold text-white/40">STAFF</span></h3>
               </div>
               <div className="w-[1px] h-10 bg-white/10" />
               <div className="text-start">
                  <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">{isRtl ? 'الآليات' : 'EQUIPMENT'}</p>
                  <h3 className="text-2xl font-black font-mono">{equipmentUsed.filter(e => e.equipmentId).length} <span className="text-[10px] font-bold text-white/40">UNITS</span></h3>
               </div>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4 text-start">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <p className="text-[9px] font-bold text-slate-300 max-w-[250px] leading-relaxed italic">
                     {isRtl ? 'عند الاعتماد، سيقوم النظام بتحديث المقايسة وإطلاق مطالبات مقاولي الباطن آلياً.' : 'System will auto-update BOQ and trigger Sub-Con payables upon commitment.'}
                  </p>
               </div>
               <Button onClick={handleSave} disabled={loading || !activeStage} className="h-16 px-16 rounded-[2rem] bg-primary text-white font-black text-xl shadow-2xl shadow-primary/30 gap-4 border-b-8 border-orange-700 hover:scale-105 active:scale-95 transition-all">
                  {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-8 w-8" />}
                  {isRtl ? 'اعتماد التقرير الميداني' : 'Commit Field Log'}
               </Button>
            </div>
         </div>
      </footer>
    </div>
  );
}

export default function NewStructuredFieldVisitPage() {
   return <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin text-primary" /></div>}><NewFieldVisitForm /></Suspense>;
}
