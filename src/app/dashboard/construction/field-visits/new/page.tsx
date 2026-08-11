
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Save, Loader2, ArrowRight, Camera, Users, Target,
  Plus, CheckCircle2, Trash2, Truck, LayoutGrid, Sparkles,
  Workflow, Clock, AlertTriangle, Hammer
} from "lucide-react";
import { useFirestore, useCollection, useFirebaseApp } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Employee, WorkGroup } from '@/types/hr';
import { Transaction, StageInstance } from '@/types/transaction';
import { Equipment } from '@/types/equipment';
import { BOQ, BOQItem } from '@/types/documents';
import { usePermissions } from '@/hooks/use-permissions';
import { BOQExecutionService } from '@/services/boq-execution-service';

function NewFieldVisitForm() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const firebaseApp = useFirebaseApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const cloneId = searchParams.get('cloneId');

  const [loading, setLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  
  // بيانات المرحلة النشطة
  const [activeStage, setActiveStage] = useState<StageInstance | null>(null);
  const [loadingStage, setLoadingStage] = useState(false);

  const [laborDetails, setLaborDetails] = useState<any[]>([{ trade: '', count: 1, hours: 8, hourlyCostRef: 0 }]);
  const [equipmentUsed, setEquipmentUsed] = useState<any[]>([{ equipmentId: '', name: '', hoursUsed: 4, hourlyRateRef: 0 }]);

  const [gridRows, setGridRows] = useState<any[]>([
    { boqItemId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }
  ]);

  // جلب المشاريع المتاحة للمهندس
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
    const clients = new Map();
    fieldProjects.forEach(p => {
       clients.set(p.clientId, p.clientName);
    });
    return Array.from(clients.entries()).map(([id, name]) => ({ id, name }));
  }, [fieldProjects]);

  const clientProjects = useMemo(() => selectedClientId ? fieldProjects.filter(p => p.clientId === selectedClientId) : [], [fieldProjects, selectedClientId]);

  // محرك البحث عن المرحلة النشطة والبنود المرتبطة بها
  useEffect(() => {
    async function fetchProjectContext() {
      if (!selectedProjectId || !db || !companyId) {
        setActiveStage(null);
        return;
      }
      setLoadingStage(true);
      try {
        const stagesSnap = await getDocs(query(collection(db, paths.transactionStages(companyId, selectedProjectId)), where('status', '==', 'in-progress'), orderBy('order')));
        if (!stagesSnap.empty) {
           setActiveStage({ id: stagesSnap.docs[0].id, ...stagesSnap.docs[0].data() } as StageInstance);
        } else {
           setActiveStage(null);
        }
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

  // تصفية البنود لتظهر فقط بنود المرحلة النشطة
  const filteredBoqItems = useMemo(() => {
    if (!activeStage || !allBoqItems) return [];
    return allBoqItems.filter(i => (i.technicalStageIds?.includes(activeStage.technicalStageId) || i.technicalStageId === activeStage.technicalStageId));
  }, [activeStage, allBoqItems]);

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const groupsQuery = useMemo(() => companyId && db ? query(collection(db, paths.workGroups(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  const { data: workGroups } = useCollection<WorkGroup>(groupsQuery);

  const equipQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('status', '==', 'available')) : null, [db, companyId]);
  const { data: equipmentRegistry } = useCollection<Equipment>(equipQuery);

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
        return {
           trade: emp?.fullName || 'Worker',
           count: 1,
           hours: 8,
           hourlyCostRef: (emp?.basicSalary || 0) / 26 / 8
        };
     });

     const supervisor = employees?.find(e => e.id === group.supervisorId);
     if (supervisor) {
        groupLabor.unshift({
           trade: supervisor.fullName,
           count: 1,
           hours: 8,
           hourlyCostRef: (supervisor.basicSalary || 0) / 26 / 8
        });
     }

     setLaborDetails([...laborDetails.filter(l => l.trade), ...groupLabor]);
     toast({ title: t('construction.crewLoaded') });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !selectedProjectId || !activeBoq || !activeStage) return;
    
    const validRows = gridRows.filter(r => r.boqItemId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى اختيار بند عمل واحد على الأقل وإدخال كمية." });
      return;
    }

    setLoading(true);
    try {
      const execService = new BOQExecutionService(db, companyId, permissions);
      const visitRef = doc(collection(db, paths.fieldVisits(companyId)));
      const project = allTransactions?.find(t => t.id === selectedProjectId);
      const officialName = globalUser?.fullName || user.displayName || 'Engineer';

      // 1. تسجيل كل بند كحركة إنجاز مستقلة (Live Execution)
      for (const row of validRows) {
         await execService.recordBOQItemExecution(
           activeBoq.id,
           row.boqItemId,
           activeStage.technicalStageId,
           Number(row.quantity),
           user.uid,
           officialName,
           row.notes || '',
           activeStage.id!,
           false,
           '', // لا يوجد موعد مرتبط في التقرير المباشر
           { laborDetails: laborDetails.filter(l => l.trade), equipmentUsed: equipmentUsed.filter(e => e.equipmentId) }
         );
      }

      // 2. حفظ وثيقة التقرير الميداني للأرشفة
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
        items: gridRows.map(r => {
           const boqItem = allBoqItems?.find(i => i.id === r.boqItemId);
           return { ...r, itemName: boqItem?.referenceTitle || '', executionStatus: 'executed' };
        }),
        laborDetails: laborDetails.filter(l => l.trade),
        equipmentUsed: equipmentUsed.filter(e => e.equipmentId),
        engineerId: globalUser?.employeeId || user.uid,
        engineerName: officialName,
        status: 'submitted',
        createdAt: serverTimestamp(),
      });

      toast({ title: t('construction.visitCreated') });
      router.push('/dashboard/construction/field-visits');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <PlusCircle className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'تسجيل تقرير ميداني جديد' : 'New Field Report'}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">{isRtl ? 'توثيق الإنجاز والموارد من الموقع مباشرة' : 'Direct site progress and resources logging'}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => router.back()} className="rounded-xl h-11 px-6 font-bold">{t('common.cancel')}</Button>
           <Button onClick={handleSave} disabled={loading || !activeStage} className="h-11 px-10 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 gap-2 border-b-4 border-orange-700">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {isRtl ? 'اعتماد وحفظ التقرير' : 'Commit Report'}
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         
         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50/50 p-6 border-b text-start">
                  <CardTitle className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                     <Target className="h-4 w-4 text-primary" /> {t('construction.context')}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6 text-start">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.clients')}</Label>
                     <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedProjectId(''); }}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl border-0 shadow-2xl z-[150]">{contractedClients.map(c => <SelectItem key={c.id} value={c.id} className="font-bold py-3">{c.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.projects')}</Label>
                     <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl border-0 shadow-2xl z-[150]">{clientProjects.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3">{p.subServiceName}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>

                  {loadingStage ? (
                     <div className="py-4 flex items-center justify-center animate-pulse"><Loader2 className="h-5 w-5 animate-spin text-primary/30" /></div>
                  ) : activeStage ? (
                    <div className="p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20 space-y-3 animate-in zoom-in-95">
                       <div className="flex items-center gap-2 text-primary">
                          <Workflow className="h-5 w-5" />
                          <h4 className="font-black text-sm uppercase">{isRtl ? 'المرحلة النشطة حالياً' : 'Active Stage'}</h4>
                       </div>
                       <p className="text-xl font-black text-slate-900">{activeStage.name}</p>
                       <Badge className="bg-primary text-white border-0 font-black text-[9px] px-3 h-5">IN PROGRESS</Badge>
                    </div>
                  ) : selectedProjectId && (
                    <div className="p-6 bg-rose-50 rounded-3xl border-2 border-dashed border-rose-200 text-center space-y-3">
                       <ShieldAlert className="h-8 w-8 text-rose-500 mx-auto" />
                       <p className="text-xs font-black text-rose-700">{isRtl ? 'لا توجد مرحلة نشطة لهذا المشروع حالياً. يرجى تفعيل المرحلة من رادار المشروع أولاً.' : 'No active stage found. Please start a stage from project radar first.'}</p>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.date')}</Label>
                     <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="h-12 rounded-xl border-2 font-bold" />
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50/50 p-6 border-b text-start">
                  <CardTitle className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                     <Users className="h-4 w-4 text-primary" /> {isRtl ? 'الموارد البشرية في الموقع' : 'Site Labor'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6 text-start">
                  <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border-2 border-white shadow-inner mb-4">
                     <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{t('common.loadFromGroup')}</Label>
                     <Select onValueChange={handleApplyGroup}>
                        <SelectTrigger className="h-10 rounded-xl border-2 bg-white font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">{workGroups?.map(g => <SelectItem key={g.id} value={g.id!} className="font-bold py-2">{g.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-3">
                    {laborDetails.map((l, i) => (
                      <div key={i} className="flex gap-2 items-end group animate-in slide-in-from-right-2">
                         <div className="flex-1">
                            <Select value={l.trade} onValueChange={v => {
                               const emp = employees?.find(x => x.fullName === v);
                               const nl = [...laborDetails];
                               nl[i].trade = v;
                               nl[i].hourlyCostRef = (emp?.basicSalary || 0) / 26 / 8;
                               setLaborDetails(nl);
                            }}>
                               <SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  {employees?.map(e => <SelectItem key={e.id} value={e.fullName} className="font-bold">{e.fullName}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <Input type="number" value={l.count} onChange={e => { const nl = [...laborDetails]; nl[i].count = Number(e.target.value); setLaborDetails(nl); }} className="h-10 w-16 text-center font-black rounded-xl border-2" />
                         <Button variant="ghost" size="icon" onClick={() => setLaborDetails(laborDetails.filter((_, idx) => idx !== i))} className="h-10 w-10 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1, hours: 8, hourlyCostRef: 0 }])} className="w-full h-10 rounded-xl border-dashed border-2 font-black text-[10px] gap-2"><Plus className="h-3 w-3" /> {isRtl ? 'إضافة عامل' : 'Add Labor'}</Button>
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row justify-between items-center">
                  <div className="text-start">
                     <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3"><LayoutGrid className="h-6 w-6 text-primary" /> {t('construction.siteProgress')}</CardTitle>
                     <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{isRtl ? 'بنود المرحلة النشطة حصراً' : 'Active Stage Items Only'}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setGridRows([...gridRows, { boqItemId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }])} className="rounded-xl h-11 px-6 font-black gap-2 border-2 bg-white hover:bg-slate-50 shadow-sm">
                     <Plus className="h-4 w-4" /> {isRtl ? 'إضافة بند تنفيذ' : 'Add Item'}
                  </Button>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-0">
                           <TableHead className="py-6 ps-8 text-start text-[10px] font-black uppercase tracking-widest text-slate-500">{tSafe('inline.work.item', 'بند العمل', 'Work Item')}</TableHead>
                           <TableHead className="text-center w-[120px] text-[10px] font-black uppercase tracking-widest text-slate-500">{t('common.quantity')}</TableHead>
                           <TableHead className="text-center w-[120px] text-[10px] font-black uppercase tracking-widest text-slate-500">{t('common.photos')}</TableHead>
                           <TableHead className="pe-8"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {gridRows.map((row, idx) => (
                           <TableRow key={idx} className="border-b-slate-100 group transition-colors hover:bg-primary/[0.01]">
                              <TableCell className="ps-8 py-5 text-start">
                                 <Select value={row.boqItemId} onValueChange={v => updateRow(idx, 'boqItemId', v)}>
                                    <SelectTrigger className="h-12 rounded-xl border-2 font-black text-sm bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-0 shadow-2xl z-[160]">
                                       {filteredBoqItems.length === 0 ? (
                                         <div className="p-4 text-center text-[10px] font-bold text-slate-400 italic">لا توجد بنود مربوطة بهذه المرحلة.</div>
                                       ) : filteredBoqItems.map(i => (
                                          <SelectItem key={i.id} value={i.id!} className="font-bold py-3 border-b last:border-0 border-slate-50">
                                             <div className="flex flex-col text-start">
                                                <span>{i.referenceTitle}</span>
                                                <span className="text-[8px] text-slate-400 font-mono uppercase">#{i.referenceCode} • المتبقي: {(i.plannedQuantity || 0) - (i.executedQuantity || 0)}</span>
                                             </div>
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                                 <Input value={row.notes} onChange={e => updateRow(idx, 'notes', e.target.value)} className="h-9 text-[10px] mt-2 border-transparent hover:border-slate-100 bg-slate-50/50 font-medium" placeholder={isRtl ? "ملاحظات فنية عن التنفيذ..." : "Technical notes..."} />
                              </TableCell>
                              <TableCell className="py-5">
                                 <div className="flex flex-col items-center gap-1">
                                    <Input type="number" step="0.01" value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} className="h-12 w-24 text-center font-black text-xl rounded-xl border-2 bg-white text-primary" />
                                 </div>
                              </TableCell>
                              <TableCell className="py-5 text-center">
                                 <div className="flex items-center justify-center gap-2">
                                    <label className="h-12 w-12 rounded-xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center cursor-pointer hover:bg-white hover:border-primary/40 transition-all shadow-inner group-hover:scale-110">
                                       {row.isUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary/30" /> : <Camera className="h-6 w-6 text-slate-300 group-hover:text-primary transition-colors" />}
                                       <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(idx, e)} disabled={row.isUploading} />
                                    </label>
                                    {row.photoUrls?.length > 0 && <Badge className="bg-emerald-500 text-white font-black h-6 w-6 p-0 flex items-center justify-center rounded-lg shadow-lg">{row.photoUrls.length}</Badge>}
                                 </div>
                              </TableCell>
                              <TableCell className="pe-8 text-end">
                                 <Button variant="ghost" size="icon" onClick={() => setGridRows(gridRows.filter((_, i) => i !== idx))} className="h-10 w-10 text-rose-200 hover:text-rose-600 transition-colors"><Trash2 className="h-5 w-5" /></Button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
                  {gridRows.length === 0 && (
                    <div className="py-32 text-center flex flex-col items-center gap-4 opacity-30">
                       <Hammer className="h-16 w-16 text-slate-200" />
                       <p className="font-black text-slate-400">{isRtl ? 'لا يوجد بنود مسجلة في التقرير' : 'No items logged'}</p>
                    </div>
                  )}
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden relative">
               <div className="absolute top-0 right-0 p-10 opacity-5"><Sparkles className="h-40 w-40 text-primary" /></div>
               <CardContent className="p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10 text-start">
                  <div className="space-y-2">
                     <h3 className="text-2xl font-black font-headline text-primary">{isRtl ? 'الربط السيادي المباشر' : 'Sovereign Live Sync'}</h3>
                     <p className="text-sm font-bold text-slate-400 leading-relaxed max-w-md">
                        {isRtl 
                          ? 'عند اعتماد هذا التقرير، سيقوم النظام تلقائياً بتحديث كميات المقايسة، توثيق الإنجاز في التايملاين، وفحص استحقاق الدفعات المالية المرتبطة بهذه المرحلة.'
                          : 'Upon commitment, the system will auto-update BOQ quantities, document the timeline, and trigger milestone payments associated with this stage.'}
                     </p>
                  </div>
                  <div className="h-24 w-[1.5px] bg-white/10 hidden md:block" />
                  <div className="text-center md:text-end space-y-1">
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">{isRtl ? 'إجمالي البنود الموثقة' : 'Total Items'}</p>
                     <h2 className="text-5xl font-black">{gridRows.filter(r => r.boqItemId).length}</h2>
                  </div>
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
