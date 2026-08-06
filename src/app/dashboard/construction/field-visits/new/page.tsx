
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  HardHat, Save, Loader2, ArrowRight,
  MapPin, Camera, Users, Target,
  Plus, CheckCircle2, Trash2,
  Truck, LayoutGrid, Sparkles,
  Building2, Briefcase, Globe, 
  ShieldCheck, UserCircle, X,
  AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Employee, WorkGroup } from '@/types/hr';
import { Transaction, StageInstance } from '@/types/transaction';
import { Equipment } from '@/types/equipment';
import { Department } from '@/types/reference';
import { BOQ, BOQItem } from '@/types/documents';
import { BOQExecutionService } from '@/services/boq-execution-service';

function NewFieldVisitForm() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const cloneId = searchParams.get('cloneId');

  // --- States ---
  const [loading, setLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [selectedGroups, setSelectedGroups] = useState<any[]>([]);
  const [individualLabor, setIndividualLabor] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [equipmentList, setEquipmentList] = useState<any[]>([]);

  const [gridRows, setGridRows] = useState<any[]>([
    { boqItemId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }
  ]);

  // --- Logic for Cloning (Comprehensive Protocol) ---
  useEffect(() => {
    async function fetchCloneData() {
      if (!cloneId || !db || !companyId) return;
      const snap = await getDoc(doc(db, paths.fieldVisits(companyId), cloneId));
      if (snap.exists()) {
        const data = snap.data();
        
        // 1. الأساسيات
        setSelectedClientId(data.clientId);
        setSelectedProjectId(data.transactionId);
        
        // 2. استنساخ العمالة المزدوج (Crews & Individuals)
        if (data.laborDetails) {
           const groups = data.laborDetails.filter((l: any) => l.type === 'group').map((g: any) => ({
              id: g.id,
              name: g.trade,
              memberCount: g.count
           }));
           setSelectedGroups(groups);

           const individuals = data.laborDetails.filter((l: any) => l.type === 'individual').map((i: any) => ({
              employeeId: i.employeeId,
              employeeName: i.employeeName || '---',
              trade: i.trade,
              hours: i.hours || 8,
              hourlyCostRef: i.hourlyCostRef || 0
           }));
           setIndividualLabor(individuals);
        }

        // 3. استنساخ المعدات
        setEquipmentList(data.equipmentUsed || []);

        // 4. استنساخ جدول الإنجاز (BOQ Rows)
        if (data.items) {
           setGridRows(data.items.map((i: any) => ({
              boqItemId: i.boqItemId,
              quantity: i.quantity,
              notes: i.notes,
              photoUrls: i.photoUrls || [],
              isUploading: false
           })));
        }

        toast({ title: isRtl ? "تم استنساخ كافة بيانات الزيارة" : "Full visit data cloned" });
      }
    }
    fetchCloneData();
  }, [cloneId, db, companyId, isRtl]);

  // --- Queries ---
  const dayExecutionsQuery = useMemo(() => 
    companyId && db && visitDate ? query(collection(db, paths.attendance(companyId)), where('date', '==', visitDate)) : null,
  [db, companyId, visitDate]);
  const { data: dayExecutions } = useCollection<any>(dayExecutionsQuery);

  const busyResourceSets = useMemo(() => {
    const workerIds = new Set<string>();
    const equipIds = new Set<string>();
    dayExecutions?.forEach(ex => {
      if (ex.employeeId) workerIds.add(ex.employeeId);
    });
    return { workerIds, equipIds };
  }, [dayExecutions]);

  const activityTypesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.activityTypes(companyId))) : null, [db, companyId]);
  const { data: activityTypes } = useCollection<any>(activityTypesQuery);
  
  const constructionActivityId = useMemo(() => 
    activityTypes?.find(a => a.code === 'CONSTRUCTION' || a.name.includes('مقاولات'))?.id, [activityTypes]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, [db, companyId]);
  const { data: allClients } = useCollection<any>(clientsQuery);
  const constructionClients = useMemo(() => 
    allClients?.filter(c => c.activityTypeId === constructionActivityId || c.status === 'contracted'), [allClients, constructionActivityId]);

  const projectsQuery = useMemo(() => 
    companyId && db && selectedClientId ? query(collection(db, paths.transactions(companyId)), where('clientId', '==', selectedClientId)) : null, 
  [db, companyId, selectedClientId]);
  const { data: clientProjects } = useCollection<Transaction>(projectsQuery);

  const stagesQuery = useMemo(() => 
    companyId && db && selectedProjectId ? query(collection(db, paths.transactionStages(companyId, selectedProjectId)), orderBy('order')) : null,
  [db, companyId, selectedProjectId]);
  const { data: projectStages } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => 
    companyId && db && selectedProjectId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', selectedProjectId)) : null,
  [db, companyId, selectedProjectId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => 
    companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null,
  [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const groupsQuery = useMemo(() => companyId && db ? query(collection(db, paths.workGroups(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, [db, companyId]);
  const equipQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  
  const { data: workGroups } = useCollection<WorkGroup>(groupsQuery);
  const { data: departments } = useCollection<Department>(deptsQuery);
  const { data: equipmentRegistry } = useCollection<Equipment>(equipQuery);

  const employeesInDeptQuery = useMemo(() => 
    companyId && db && selectedDeptId ? query(collection(db, paths.employees(companyId)), where('departmentId', '==', selectedDeptId), where('status', '==', 'active')) : null, 
  [db, companyId, selectedDeptId]);
  const { data: deptEmployees } = useCollection<Employee>(employeesInDeptQuery);

  const selectedClient = useMemo(() => constructionClients?.find(c => c.id === selectedClientId), [constructionClients, selectedClientId]);
  
  const progressPercent = useMemo(() => {
    if (!projectStages || projectStages.length === 0) return 0;
    const completed = projectStages.filter(s => s.status === 'completed').length;
    return Math.round((completed / projectStages.length) * 100);
  }, [projectStages]);

  const activeSelectedMemberIds = useMemo(() => {
    const ids = new Set<string>();
    selectedGroups.forEach(g => g.memberIds?.forEach((id: string) => ids.add(id)));
    individualLabor.forEach(i => ids.add(i.employeeId));
    return ids;
  }, [selectedGroups, individualLabor]);

  // --- Handlers ---
  const handleAddRow = () => {
    setGridRows([...gridRows, { boqItemId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }]);
  };

  const removeRow = (idx: number) => {
    setGridRows(gridRows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: string, val: any) => {
    const newRows = [...gridRows];
    newRows[idx][field] = val;
    setGridRows(newRows);
  };

  const handlePhotoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !companyId) return;
    
    updateRow(idx, 'isUploading', true);
    const storage = getStorage();
    const urls: string[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const sRef = ref(storage, `site_logs/${companyId}/${Date.now()}_${files[i].name}`);
        const snap = await uploadBytes(sRef, files[i]);
        const url = await getDownloadURL(snap.ref);
        urls.push(url);
      }
      const newPhotos = [...gridRows[idx].photoUrls, ...urls];
      updateRow(idx, 'photoUrls', newPhotos);
    } catch (err) {
      toast({ variant: "destructive", title: "فشل الرفع" });
    } finally {
      updateRow(idx, 'isUploading', false);
    }
  };

  const handleAddGroup = (v: string) => {
    const group = workGroups?.find(g => g.id === v);
    if (!group) return;
    if (!selectedGroups.find(g => g.id === v)) {
      setSelectedGroups([...selectedGroups, group]);
    }
  };

  const handleAddEmployee = (v: string) => {
    const emp = deptEmployees?.find(e => e.id === v);
    if (!emp) return;
    if (activeSelectedMemberIds.has(v)) return;
    setIndividualLabor([...individualLabor, {
      employeeId: emp.id,
      employeeName: emp.fullName,
      trade: emp.jobTitle,
      hours: 8,
      hourlyCostRef: 0 
    }]);
  };

  const handleAddEquipment = (v: string) => {
    const equip = equipmentRegistry?.find(e => e.id === v);
    if (!equip) return;
    if (equipmentList.find(e => e.equipmentId === v)) return;
    setEquipmentList([...equipmentList, {
      equipmentId: v,
      name: equip.name,
      code: equip.code,
      hoursUsed: 4,
      isMultiSite: false,
      hourlyRateRef: 0
    }]);
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !selectedProjectId || !activeBoq) return;
    if (gridRows.some(r => !r.boqItemId || !r.notes)) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يجب اختيار البند وكتابة ملاحظة لكل سطر." });
      return;
    }

    setLoading(true);
    try {
      const project = clientProjects?.find(p => p.id === selectedProjectId);
      const executionService = new BOQExecutionService(db, companyId);
      
      const laborDetails = [
        ...selectedGroups.map(g => ({ type: 'group', id: g.id, trade: g.name, count: g.memberCount, employeeId: null })),
        ...individualLabor.map(i => ({ type: 'individual', employeeId: i.employeeId, trade: i.trade, employeeName: i.employeeName, count: 1 }))
      ];

      const visitRef = doc(collection(db, paths.fieldVisits(companyId)));
      const visitId = visitRef.id;

      const itemsForReport = [];
      for (const row of gridRows) {
        const boqItem = boqItems?.find(i => i.id === row.boqItemId);
        if (!boqItem) continue;

        const stageInstance = projectStages?.find(s => 
          s.technicalStageId === boqItem.technicalStageId || 
          boqItem.technicalStageIds?.includes(s.technicalStageId)
        );

        if (Number(row.quantity) > 0) {
            await executionService.recordBOQItemExecution(
              activeBoq.id,
              row.boqItemId,
              boqItem.technicalStageId || '',
              Number(row.quantity) || 1,
              user.uid,
              globalUser?.fullName || user.displayName || 'Engineer',
              row.notes,
              stageInstance?.id || '',
              false,
              undefined,
              { laborDetails, equipmentUsed: equipmentList }
            );
        }

        itemsForReport.push({
          boqItemId: row.boqItemId,
          itemName: boqItem.referenceTitle,
          quantity: Number(row.quantity) || 0,
          unit: boqItem.unitSymbol,
          notes: row.notes,
          photoUrls: row.photoUrls,
          executionStatus: 'pending'
        });
      }

      await setDoc(visitRef, {
        id: visitId,
        companyId,
        transactionId: selectedProjectId,
        transactionNumber: project?.transactionNumber,
        clientId: selectedClientId,
        clientName: selectedClient?.nameAr,
        visitDate,
        items: itemsForReport,
        laborDetails,
        equipmentUsed: equipmentList,
        progressPercentage: progressPercent,
        engineerName: globalUser?.fullName || user.displayName || 'Engineer',
        status: 'submitted',
        createdBy: user.uid,
        clonedFromId: cloneId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({ title: isRtl ? "تم توثيق الزيارة بنجاح" : "Visit Logged Successfully" });
      router.push('/dashboard/construction/field-visits');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-primary/20 pb-8">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline text-slate-900">
             {cloneId ? (isRtl ? 'استنساخ تقرير زيارة' : 'Clone Field Report') : (isRtl ? 'توثيق الموارد والإنجاز الميداني' : 'Resource & Progress Log')}
           </h1>
           <p className="text-muted-foreground font-bold mt-1 uppercase text-[10px] tracking-widest opacity-60">Sovereign Asset Control Unit</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={() => router.back()} className="h-16 px-8 rounded-2xl border-2 font-black">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading || !selectedProjectId} className="h-16 px-12 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 border-b-8 border-orange-700 hover:scale-105 transition-all gap-3">
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-7 w-7" />}
              {isRtl ? 'اعتماد الموارد والحفظ' : 'Commit Visit'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-primary/5 border-b p-6">
                  <CardTitle className="text-sm font-black flex items-center gap-2">
                     <Target className="h-4 w-4 text-primary" /> {isRtl ? 'سياق العمل والجغرافيا' : 'Project Context'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">العميل المالك</Label>
                     <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedProjectId(''); }}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl z-[150]">
                           {constructionClients?.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.nameAr}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">المشروع</Label>
                     <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl z-[150]">
                           {clientProjects?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.subServiceName} (#{p.transactionNumber})</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  {selectedProjectId && (
                    <div className="p-5 bg-blue-50/50 rounded-2xl border-2 border-white shadow-inner space-y-3 animate-in fade-in">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-blue-600">
                          <span>{isRtl ? 'الإنجاز الفني للمسار' : 'Path Progress'}</span>
                          <span>{progressPercent}%</span>
                       </div>
                       <Progress value={progressPercent} className="h-2 bg-blue-100" />
                    </div>
                  )}
                  
                  <div className="p-4 bg-slate-50 rounded-2xl border-2 border-white shadow-sm space-y-2">
                     <p className="text-[10px] font-black text-slate-400 uppercase">GPS Location</p>
                     {selectedClient?.locationUrl ? (
                       <a href={selectedClient.locationUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {isRtl ? 'عرض موقع العميل' : 'Open Map'}
                       </a>
                     ) : <p className="text-xs font-bold text-slate-300 italic">No location.</p>}
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ التنفيذ</Label>
                     <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="h-11 rounded-xl border-2 font-black text-center" />
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {isRtl ? 'توزيع القوى العاملة' : 'Labor Hub'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">إضافة طاقم عمل (Crew)</Label>
                     <Select onValueChange={handleAddGroup}>
                        <SelectTrigger className="h-10 border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="z-[151]">{workGroups?.map(g => <SelectItem key={g.id} value={g.id!}>{g.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                     <div className="grid grid-cols-1 gap-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">إضافة موظف منفرد</Label>
                        <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                           <SelectTrigger className="h-9 border-2 text-[10px] font-black"><SelectValue placeholder="اختر القسم..." /></SelectTrigger>
                           <SelectContent className="z-[151]">{departments?.map(d => <SelectItem key={d.id} value={d.id!}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select disabled={!selectedDeptId} onValueChange={handleAddEmployee}>
                           <SelectTrigger className="h-10 border-2 font-bold"><SelectValue placeholder="اختيار الموظف..." /></SelectTrigger>
                           <SelectContent className="z-[151]">
                              {deptEmployees?.map(e => (
                                <SelectItem key={e.id} value={e.id!} disabled={activeSelectedMemberIds.has(e.id!)}>
                                   <div className="flex justify-between items-center w-full gap-4">
                                      <span>{e.fullName}</span>
                                      {busyResourceSets.workerIds.has(e.id!) && <Badge variant="destructive" className="text-[7px] h-4">BUSY</Badge>}
                                   </div>
                                </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                     {selectedGroups.map((g, i) => (
                        <div key={`g-${i}`} className="flex gap-2 items-center bg-primary/5 p-3 rounded-xl border border-primary/20">
                           <Users className="h-3.5 w-3.5 text-primary" />
                           <div className="flex-1 text-start">
                              <p className="text-[10px] font-black text-slate-800">{g.name}</p>
                              <p className="text-[8px] font-bold text-slate-400">{g.memberCount} Members</p>
                           </div>
                           <X className="h-4 w-4 text-rose-300 cursor-pointer" onClick={() => setSelectedGroups(selectedGroups.filter((_, idx) => idx !== i))} />
                        </div>
                     ))}
                     {individualLabor.map((l, i) => (
                        <div key={`l-${i}`} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                           <UserCircle className="h-3.5 w-3.5 text-blue-500" />
                           <div className="flex-1 text-start">
                              <p className="text-[10px] font-black text-slate-800">{l.employeeName}</p>
                              <p className="text-[8px] font-bold text-slate-400">{l.trade}</p>
                           </div>
                           <X className="h-4 w-4 text-rose-300 cursor-pointer" onClick={() => setIndividualLabor(individualLabor.filter((_, idx) => idx !== i))} />
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Equipment Fleet'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-4">
                  <Select onValueChange={handleAddEquipment}>
                     <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder={isRtl ? "إضافة معدة للموقع..." : "Add Gear..."} /></SelectTrigger>
                     <SelectContent className="z-[151]">
                        {equipmentRegistry?.map(e => (
                           <SelectItem key={e.id} value={e.id!} disabled={equipmentList.some(x => x.equipmentId === e.id)}>
                              <div className="flex justify-between items-center w-full gap-4">
                                 <span>{e.name} (#{e.code})</span>
                              </div>
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
                  
                  <div className="space-y-3">
                     {equipmentList.map((e, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-50 border-2 border-white shadow-sm space-y-3">
                           <div className="flex justify-between items-center">
                              <div className="text-start">
                                 <p className="text-[10px] font-black text-slate-800">{e.name}</p>
                                 <p className="text-[8px] font-mono text-slate-400">#{e.code}</p>
                              </div>
                              <Trash2 className="h-4 w-4 text-rose-300 cursor-pointer" onClick={() => setEquipmentList(equipmentList.filter((_, idx) => idx !== i))} />
                           </div>
                           <div className="flex items-center gap-2 text-start">
                              <Label className="text-[8px] font-black uppercase text-slate-400">Hours</Label>
                              <Input type="number" value={e.hoursUsed} onChange={v => { const nl = [...equipmentList]; nl[i].hoursUsed = Number(v.target.value); setEquipmentList(nl); }} className="h-7 w-20 text-center font-black text-[10px]" />
                           </div>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 min-h-[600px] flex flex-col">
               <CardHeader className="bg-slate-900 text-white p-8 border-b text-start shrink-0">
                  <div className="flex justify-between items-center">
                     <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg"><LayoutGrid className="h-6 w-6" /></div>
                        <div>
                           <CardTitle className="text-xl font-black">{isRtl ? 'الأعمال المنجزة اليوم' : 'Daily Work Grid'}</CardTitle>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sovereign Progress Tracking</p>
                        </div>
                     </div>
                     <Button onClick={handleAddRow} disabled={!selectedProjectId} className="h-10 px-6 rounded-xl bg-white/10 text-white hover:bg-white/20 font-black text-xs gap-2">
                        <Plus className="h-4 w-4" /> {isRtl ? 'إضافة سطر إنجاز' : 'Add Work Line'}
                     </Button>
                  </div>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto flex-1">
                  {!selectedProjectId ? (
                     <div className="py-40 text-center opacity-30 flex flex-col items-center gap-6">
                        <Sparkles className="h-16 w-16 text-slate-200" />
                        <p className="text-xl font-black text-slate-400">{isRtl ? 'يرجى اختيار المشروع أولاً' : 'Select Project to enable grid'}</p>
                     </div>
                  ) : (
                     <Table>
                        <TableHeader className="bg-slate-50">
                           <TableRow>
                              <TableHead className="ps-8 text-start w-[300px]">{isRtl ? 'البند من المقايسة' : 'BOQ Item'}</TableHead>
                              <TableHead className="text-center w-[100px]">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                              <TableHead className="text-start">{isRtl ? 'ملاحظة الموقع' : 'Field Note'}</TableHead>
                              <TableHead className="pe-8 w-[100px] text-center">{isRtl ? 'إثبات' : 'Img'}</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {gridRows.map((row, idx) => (
                             <TableRow key={idx} className="hover:bg-primary/[0.01] border-b-slate-50 group">
                                <TableCell className="ps-8 py-6">
                                   <Select value={row.boqItemId} onValueChange={v => updateRow(idx, 'boqItemId', v)}>
                                      <SelectTrigger className="h-10 border-2 font-bold text-[10px]"><SelectValue placeholder="..." /></SelectTrigger>
                                      <SelectContent className="z-[151]">
                                         {boqItems?.filter(i => (i.plannedQuantity || 0) > 0).map(i => (
                                           <SelectItem key={i.id} value={i.id!} className="font-bold text-[11px] py-3 border-b last:border-0 border-slate-50">
                                              <div className="flex flex-col text-start">
                                                <span className="font-black text-slate-800">{i.referenceTitle}</span>
                                                <span className="text-[8px] text-slate-400 uppercase">#{i.referenceCode}</span>
                                              </div>
                                           </SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </TableCell>
                                <TableCell>
                                   <Input 
                                      value={row.quantity} 
                                      onChange={e => updateRow(idx, 'quantity', e.target.value)} 
                                      className="h-10 border-2 font-black text-center text-lg bg-slate-50/50" 
                                      placeholder="0"
                                   />
                                </TableCell>
                                <TableCell>
                                   <Input 
                                      value={row.notes} 
                                      onChange={e => updateRow(idx, 'notes', e.target.value)} 
                                      className="h-10 border-2 text-xs font-bold bg-white" 
                                      placeholder={isRtl ? "ملاحظة المهندس الميداني..." : "Note..."} 
                                   />
                                </TableCell>
                                <TableCell className="pe-8 text-center">
                                   <div className="flex flex-col items-center gap-2">
                                      {row.isUploading ? (
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                      ) : (
                                        <label className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-all shadow-sm ring-1 ring-slate-200">
                                           <Camera className="h-4 w-4 text-slate-400" />
                                           <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(idx, e)} />
                                        </label>
                                      )}
                                      {row.photoUrls.length > 0 && <Badge className="bg-emerald-500 text-white font-black text-[8px] h-4 px-1.5">{row.photoUrls.length}</Badge>}
                                   </div>
                                </TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  )}
               </CardContent>
            </Card>

            <div className="p-8 rounded-[3rem] bg-blue-50/50 border-4 border-dashed border-blue-100 flex items-start gap-4">
               <ShieldCheck className="h-8 w-8 text-blue-600 shrink-0 mt-1" />
               <div className="text-start space-y-1">
                  <h4 className="font-black text-sm text-blue-900 uppercase">دورة الاعتماد السيادي</h4>
                  <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
                     يتم تسجيل هذا التقرير كـ "بيان إنجاز خام". سيقوم المهندس المسؤول لاحقاً بمراجعة البنود وتقديم الرد الفني (تم/جزئي/لم يتم) لكل بند على حدة لاعتماده مالياً.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

export default function NewStructuredFieldVisitPage() {
   return (
     <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
        <NewFieldVisitForm />
     </Suspense>
   );
}
