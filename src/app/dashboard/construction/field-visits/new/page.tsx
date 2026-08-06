
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
  AlertTriangle, Lock, Gavel,
  Zap, Compass, ShieldAlert
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
import { BOQ, BOQItem, Contract } from '@/types/documents';
import { BOQExecutionService } from '@/services/boq-execution-service';
import { usePermissions } from '@/hooks/use-permissions';

function NewFieldVisitForm() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const cloneId = searchParams.get('cloneId');

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

  useEffect(() => {
    async function fetchCloneData() {
      if (!cloneId || !db || !companyId) return;
      const snap = await getDoc(doc(db, paths.fieldVisits(companyId), cloneId));
      if (snap.exists()) {
        const data = snap.data();
        setSelectedClientId(data.clientId);
        setSelectedProjectId(data.transactionId);
        
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

        setEquipmentList(data.equipmentUsed || []);

        if (data.items) {
           setGridRows(data.items.map((i: any) => ({
              boqItemId: i.boqItemId,
              quantity: i.quantity,
              notes: i.notes,
              photoUrls: i.photoUrls || [],
              isUploading: false
           })));
        }
      }
    }
    fetchCloneData();
  }, [cloneId, db, companyId]);

  const allTransactionsQuery = useMemo(() => 
    (companyId && db) ? query(collection(db, paths.transactions(companyId)), where('status', '!=', 'completed')) : null,
  [db, companyId]);
  const { data: allActiveTransactions } = useCollection<Transaction>(allTransactionsQuery);

  const fieldProjects = useMemo(() => {
    return (allActiveTransactions || []).filter(t => {
      const isField = t.activityTypeName?.includes('مقاولات') || 
                      t.activityTypeName?.includes('Construction') || 
                      t.activityTypeName?.includes('Design & Build');
      
      if (!isAdmin && globalUser?.employeeId) {
        return isField && t.assignedEngineerId === globalUser.employeeId;
      }
      return isField;
    });
  }, [allActiveTransactions, isAdmin, globalUser?.employeeId]);

  const contractedClientsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(collection(db, paths.clients(companyId)), where('status', '==', 'contracted'));
  }, [db, companyId]);
  const { data: allContractedClients } = useCollection<any>(contractedClientsQuery);

  const constructionClients = useMemo(() => {
    return (allContractedClients || []).filter(c => 
      fieldProjects.some(p => p.clientId === c.id)
    ).sort((a, b) => a.nameAr.localeCompare(b.nameAr));
  }, [allContractedClients, fieldProjects]);

  const clientProjects = useMemo(() => {
    if (!selectedClientId) return [];
    return fieldProjects.filter(p => p.clientId === selectedClientId);
  }, [fieldProjects, selectedClientId]);

  const contractsQuery = useMemo(() => 
    companyId && db && selectedProjectId ? query(collection(db, paths.contracts(companyId)), where('transactionId', '==', selectedProjectId)) : null,
  [db, companyId, selectedProjectId]);
  const { data: contracts, loading: contractsLoading } = useCollection<Contract>(contractsQuery);

  const activeContract = useMemo(() => 
    contracts?.find(c => ['approved', 'paid', 'active', 'signed'].includes(c.status || '') || c.isPaid),
  [contracts]);

  const isFinancialLockActive = useMemo(() => {
     if (!selectedProjectId) return false;
     if (contractsLoading) return false;
     return !activeContract;
  }, [selectedProjectId, activeContract, contractsLoading]);

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
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const equipQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  
  const { data: workGroups } = useCollection<WorkGroup>(groupsQuery);
  const { data: departments } = useCollection<Department>(deptsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);
  const { data: equipmentRegistry } = useCollection<Equipment>(equipQuery);

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

  const handleAddRow = () => {
    if (isFinancialLockActive) return;
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
    const emp = (employees || [])?.find(e => e.id === v);
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
      hourlyRateRef: equip.hourlyRentalRate || equip.hourlyDepreciationRate || 0
    }]);
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !selectedProjectId || !activeBoq) return;
    if (isFinancialLockActive) {
       toast({ variant: "destructive", title: isRtl ? "تنبيه سيادي" : "Sovereign Alert", description: isRtl ? "لا يمكن حفظ التقرير لمشروع غير معتمد مالياً." : "Cannot save logs for non-contracted projects." });
       return;
    }
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
              visitId,
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
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in duration-500 text-start" dir={dir}>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="text-start">
           <h1 className="text-xl md:text-2xl font-bold text-slate-900">
             {cloneId ? (isRtl ? 'استنساخ تقرير الميدان' : 'Clone Field Report') : (isRtl ? 'توثيق الموارد والإنجاز الميداني' : 'Resource & Progress Log')}
           </h1>
           <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider opacity-60">Sovereign Field Unit - Construction & Build</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 px-4 rounded-md font-bold">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading || !selectedProjectId || isFinancialLockActive} size="sm" className="h-9 px-6 rounded-md font-bold gap-2">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {isRtl ? 'اعتماد الموارد والحفظ' : 'Commit Visit'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <div className="lg:col-span-4 space-y-6">
            <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden text-start">
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <CardTitle className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                     <Target className="h-4 w-4 text-primary" /> {isRtl ? 'سياق العمل والنشاط' : 'Project Context'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-bold uppercase text-slate-400">{isRtl ? 'العميل المالك' : 'Client Owner'}</Label>
                     <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedProjectId(''); }}>
                        <SelectTrigger className="h-9 rounded-md border-slate-200 font-medium text-sm"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="z-[150]">
                           {constructionClients?.map(c => <SelectItem key={c.id} value={c.id} className="text-xs font-medium">{c.nameAr}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-bold uppercase text-slate-400">المشروع الميداني المستهدف</Label>
                     <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="h-9 rounded-md border-slate-200 font-medium text-sm">
                           <SelectValue placeholder="..." />
                        </SelectTrigger>
                        <SelectContent className="z-[150]">
                           {clientProjects?.map(p => (
                             <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                                {p.subServiceName} (#{p.transactionNumber})
                             </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  {isFinancialLockActive && (
                     <div className="p-4 bg-rose-50 border border-rose-100 rounded-md text-center space-y-3">
                        <Lock className="h-5 w-5 text-rose-500 mx-auto" />
                        <div className="space-y-1">
                           <h4 className="font-bold text-xs text-rose-900">{isRtl ? 'المشروع مغلق مالياً' : 'Project Locked'}</h4>
                           <p className="text-[9px] font-medium text-rose-600 leading-relaxed">
                              {isRtl ? 'مطلوب عقد معتمد لبدء التوثيق.' : 'Contract required to log visits.'}
                           </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/clients/${selectedClientId}`)} className="h-7 text-[9px] font-bold">مراجعة العقود</Button>
                     </div>
                  )}

                  {selectedProjectId && !isFinancialLockActive && (
                    <div className="p-3 bg-slate-50 rounded-md border space-y-2">
                       <div className="flex justify-between items-center text-[9px] font-bold uppercase text-slate-500">
                          <span>{isRtl ? 'الإنجاز الفني' : 'Progress'}</span>
                          <span>{progressPercent}%</span>
                       </div>
                       <Progress value={progressPercent} className="h-1" />
                    </div>
                  )}
                  
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-bold uppercase text-slate-400">{isRtl ? 'تاريخ التنفيذ' : 'Visit Date'}</Label>
                     <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="h-9 rounded-md border-slate-200 font-medium text-xs" />
                  </div>
               </CardContent>
            </Card>

            <Card className={cn("rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden text-start transition-all", isFinancialLockActive && "opacity-30 pointer-events-none")}>
               <CardHeader className="bg-slate-50 p-4 border-b"><CardTitle className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {isRtl ? 'توزيع القوى العاملة' : 'Labor Hub'}</CardTitle></CardHeader>
               <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-bold uppercase text-slate-400">إضافة طاقم عمل (Crew)</Label>
                     <Select onValueChange={handleAddGroup}>
                        <SelectTrigger className="h-8 rounded-md border-slate-200 text-xs font-medium"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="z-[151]">{workGroups?.map(g => <SelectItem key={g.id} value={g.id!} className="text-xs">{g.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t">
                     <Label className="text-[10px] font-bold uppercase text-slate-400">إضافة موظف منفرد</Label>
                     <div className="grid grid-cols-1 gap-2">
                        <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                           <SelectTrigger className="h-8 rounded-md border-slate-200 text-xs"><SelectValue placeholder="القسم..." /></SelectTrigger>
                           <SelectContent className="z-[151]">{departments?.map(d => <SelectItem key={d.id} value={d.id!} className="text-xs">{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select disabled={!selectedDeptId} onValueChange={handleAddEmployee}>
                           <SelectTrigger className="h-8 rounded-md border-slate-200 text-xs"><SelectValue placeholder="الموظف..." /></SelectTrigger>
                           <SelectContent className="z-[151]">
                              {employees?.filter((e:any) => e.departmentId === selectedDeptId && e.status === 'active').map((e:any) => (
                                <SelectItem key={e.id} value={e.id!} disabled={activeSelectedMemberIds.has(e.id!)} className="text-xs">{e.fullName}</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                     {selectedGroups.map((g, i) => (
                        <div key={`g-${i}`} className="flex gap-2 items-center bg-slate-50 p-2 rounded-md border border-slate-100">
                           <Users className="h-3 w-3 text-primary" />
                           <div className="flex-1 text-[10px] font-bold text-slate-700">{g.name} ({g.memberCount})</div>
                           <X className="h-3 w-3 text-slate-300 cursor-pointer hover:text-rose-500" onClick={() => setSelectedGroups(selectedGroups.filter((_, idx) => idx !== i))} />
                        </div>
                     ))}
                     {individualLabor.map((l, i) => (
                        <div key={`l-${i}`} className="flex gap-2 items-center bg-slate-50 p-2 rounded-md border border-slate-100">
                           <UserCircle className="h-3 w-3 text-blue-500" />
                           <div className="flex-1 text-[10px] font-bold text-slate-700">{l.employeeName}</div>
                           <X className="h-3 w-3 text-slate-300 cursor-pointer hover:text-rose-500" onClick={() => setIndividualLabor(individualLabor.filter((_, idx) => idx !== i))} />
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>

            <Card className={cn("rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden text-start transition-all", isFinancialLockActive && "opacity-30 pointer-events-none")}>
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <CardTitle className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Equipment'}</CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-bold uppercase text-slate-400">إضافة معدة</Label>
                     <Select onValueChange={handleAddEquipment}>
                        <SelectTrigger className="h-8 rounded-md border-slate-200 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="z-[151]">
                           {equipmentRegistry?.filter(e => e.status === 'available').map(e => (
                              <SelectItem key={e.id} value={e.id!} className="text-xs">{e.name} (#{e.code})</SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                     {equipmentList.map((e, i) => (
                        <div key={i} className="flex gap-3 items-center bg-slate-50 p-2 rounded-md border border-slate-100">
                           <div className="flex-1 text-start">
                              <p className="text-[10px] font-bold text-slate-700">{e.name}</p>
                              <p className="text-[8px] font-medium text-slate-400">Ref: {e.code}</p>
                           </div>
                           <div className="flex items-center gap-1.5">
                              <Input 
                                type="number" 
                                value={e.hoursUsed} 
                                onChange={v => { const ne = [...equipmentList]; ne[i].hoursUsed = Number(v.target.value); setEquipmentList(ne); }} 
                                className="h-7 w-12 text-center text-[10px] font-bold" 
                              />
                              <X className="h-3 w-3 text-slate-300 cursor-pointer hover:text-rose-500" onClick={() => setEquipmentList(equipmentList.filter((_, idx) => idx !== i))} />
                           </div>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8 space-y-6">
            <Card className={cn("rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden flex flex-col transition-all", isFinancialLockActive && "opacity-30 grayscale")}>
               <CardHeader className="bg-slate-50 p-4 border-b flex flex-row justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary shadow-sm"><LayoutGrid className="h-4 w-4" /></div>
                     <CardTitle className="text-sm font-bold text-slate-700">{isRtl ? 'الأعمال المنجزة (BOQ)' : 'Daily Work Grid'}</CardTitle>
                  </div>
                  <Button onClick={handleAddRow} disabled={!selectedProjectId || isFinancialLockActive} variant="outline" size="sm" className="h-8 px-3 rounded-md text-[10px] font-bold gap-1.5">
                     <Plus className="h-3 w-3" /> {isRtl ? 'إضافة سطر' : 'Add Line'}
                  </Button>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto flex-1">
                  {!selectedProjectId ? (
                     <div className="py-32 text-center opacity-30 flex flex-col items-center gap-4">
                        <Compass className="h-10 w-10 text-slate-300" />
                        <p className="text-sm font-bold text-slate-400">{isRtl ? 'يرجى اختيار العميل والمشروع' : 'Select Project to enable grid'}</p>
                     </div>
                  ) : (
                     <Table>
                        <TableHeader className="bg-slate-50/50">
                           <TableRow className="border-0">
                              <TableHead className="ps-6 text-start w-[300px] text-[10px] font-bold uppercase text-slate-500">البند من المقايسة</TableHead>
                              <TableHead className="text-center w-[100px] text-[10px] font-bold uppercase text-slate-500">الكمية</TableHead>
                              <TableHead className="text-start text-[10px] font-bold uppercase text-slate-500">ملاحظة</TableHead>
                              <TableHead className="pe-6 w-[80px] text-center text-[10px] font-bold uppercase text-slate-500">إثبات</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {gridRows.map((row, idx) => (
                             <TableRow key={idx} className="hover:bg-slate-50/50 border-b-slate-100 group">
                                <TableCell className="ps-6 py-3">
                                   <Select value={row.boqItemId} onValueChange={v => updateRow(idx, 'boqItemId', v)}>
                                      <SelectTrigger className="h-8 border-slate-200 text-[11px] font-medium bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                      <SelectContent className="z-[151]">
                                         {boqItems?.filter(i => (i.plannedQuantity || 0) > 0).map(i => (
                                           <SelectItem key={i.id} value={i.id!} className="text-[10px] font-medium py-2">
                                              {i.referenceTitle} ({i.unitSymbol})
                                           </SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </TableCell>
                                <TableCell>
                                   <Input 
                                      type="number"
                                      value={row.quantity} 
                                      onChange={e => updateRow(idx, 'quantity', e.target.value)} 
                                      className="h-8 border-slate-200 text-center text-sm font-bold" 
                                   />
                                </TableCell>
                                <TableCell>
                                   <Input 
                                      value={row.notes} 
                                      onChange={e => updateRow(idx, 'notes', e.target.value)} 
                                      className="h-8 border-slate-200 text-[10px] font-medium" 
                                      placeholder="..." 
                                   />
                                </TableCell>
                                <TableCell className="pe-6 text-center">
                                   <div className="flex items-center justify-center gap-2">
                                      {row.isUploading ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                      ) : (
                                        <label className="h-8 w-8 rounded-md bg-white border flex items-center justify-center cursor-pointer hover:bg-slate-50">
                                           <Camera className="h-3.5 w-3.5 text-slate-400" />
                                           <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(idx, e)} />
                                        </label>
                                      )}
                                      {row.photoUrls.length > 0 && <span className="text-[10px] font-bold text-emerald-600">{row.photoUrls.length}</span>}
                                   </div>
                                </TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  )}
               </CardContent>
            </Card>

            <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100 flex items-start gap-3">
               <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
               <p className="text-[10px] text-blue-800 font-medium leading-relaxed text-start">
                  هذا التقرير هو مستند رسمي يثبت استهلاك العمالة والمعدات والإنجاز المادي. سيقوم المهندس المسؤول بمراجعة هذه الكميات فنياً قبل اعتمادها للاستحقاق المالي.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}

export default function NewStructuredFieldVisitPage() {
   return (
     <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin text-primary" /></div>}>
        <NewFieldVisitForm />
     </Suspense>
   );
}
