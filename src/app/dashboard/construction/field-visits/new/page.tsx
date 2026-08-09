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
  Building2, Briefcase, Lock, X, AlertTriangle, Compass,
  UserPlus
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
import { Transaction } from '@/types/transaction';
import { Equipment } from '@/types/equipment';
import { BOQ, BOQItem } from '@/types/documents';
import { usePermissions } from '@/hooks/use-permissions';

function NewFieldVisitForm() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin } = usePermissions();
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
  
  const [laborDetails, setLaborDetails] = useState<any[]>([{ trade: '', count: 1, hours: 8, hourlyCostRef: 0 }]);
  const [equipmentUsed, setEquipmentUsed] = useState<any[]>([{ equipmentId: '', name: '', hoursUsed: 4, hourlyRateRef: 0 }]);

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
        if (data.laborDetails) setLaborDetails(data.laborDetails);
        if (data.equipmentUsed) setEquipmentUsed(data.equipmentUsed);
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

  const clientsQuery = useMemo(() => companyId && db ? query(collection(db, paths.clients(companyId)), where('status', '==', 'contracted')) : null, [db, companyId]);
  const { data: contractedClients } = useCollection<any>(clientsQuery);

  const clientProjects = useMemo(() => selectedClientId ? fieldProjects.filter(p => p.clientId === selectedClientId) : [], [fieldProjects, selectedClientId]);

  const boqQuery = useMemo(() => companyId && db && selectedProjectId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', selectedProjectId)) : null, [db, companyId, selectedProjectId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

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
      const newPhotos = [...gridRows[idx].photoUrls, ...urls];
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

     // إضافة المشرف أيضاً
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
    if (!db || !companyId || !user || !selectedProjectId || !activeBoq) return;
    setLoading(true);
    try {
      const visitRef = doc(collection(db, paths.fieldVisits(companyId)));
      const project = allTransactions?.find(t => t.id === selectedProjectId);
      
      await setDoc(visitRef, {
        id: visitRef.id,
        companyId,
        transactionId: selectedProjectId,
        transactionNumber: project?.transactionNumber || '',
        clientId: selectedClientId,
        clientName: contractedClients?.find(c => c.id === selectedClientId)?.nameAr || '',
        visitDate,
        items: gridRows.map(r => {
           const boqItem = boqItems?.find(i => i.id === r.boqItemId);
           return { ...r, itemName: boqItem?.referenceTitle || '', executionStatus: 'pending' };
        }),
        laborDetails: laborDetails.filter(l => l.trade),
        equipmentUsed: equipmentUsed.filter(e => e.equipmentId),
        engineerId: globalUser?.employeeId || user.uid,
        engineerName: globalUser?.fullName || 'Engineer',
        status: 'submitted',
        createdAt: serverTimestamp(),
      });
      toast({ title: t('construction.visitCreated') });
      router.push('/dashboard/construction/field-visits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in" dir={dir}>
      <div className="flex justify-between items-center border-b pb-4">
        <div className="text-start">
           <h1 className="text-xl md:text-2xl font-bold text-slate-900">{t('construction.reports')}</h1>
           <p className="text-xs text-muted-foreground font-medium opacity-60 uppercase tracking-tighter">Sovereign Field Unit</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 font-bold">{t('common.cancel')}</Button>
           <Button onClick={handleSave} disabled={loading || !selectedProjectId} size="sm" className="h-9 px-6 font-bold gap-2 shadow-sm">
              {loading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {t('common.saveReport')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <div className="lg:col-span-4 space-y-4">
            <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden">
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                     <Target className="h-4 w-4 text-primary" /> {t('construction.context')}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-4 text-start">
                  <div className="space-y-1.5">
                     <Label className="text-[9px] font-bold uppercase text-slate-400">{t('common.clients')}</Label>
                     <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-9 text-xs font-medium border-slate-200"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-lg">{contractedClients?.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.nameAr}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1.5">
                     <Label className="text-[9px] font-bold uppercase text-slate-400">{t('common.projects')}</Label>
                     <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="h-9 text-xs font-medium border-slate-200"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-lg">{clientProjects?.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.subServiceName}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1.5">
                     <Label className="text-[9px] font-bold uppercase text-slate-400">{t('common.date')}</Label>
                     <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="h-9 text-xs" />
                  </div>
               </CardContent>
            </Card>

            {/* قسم العمالة مع استعادة المجموعات */}
            <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden">
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <div className="flex justify-between items-center w-full">
                     <CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" /> {t('common.labor')}
                     </CardTitle>
                  </div>
               </CardHeader>
               <CardContent className="p-4 space-y-4 text-start">
                  <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-dashed mb-2">
                     <Label className="text-[9px] font-black uppercase text-primary tracking-widest">{t('common.loadFromGroup')}</Label>
                     <Select onValueChange={handleApplyGroup}>
                        <SelectTrigger className="h-8 text-[10px] font-bold bg-white border-primary/20"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-lg">{workGroups?.map(g => <SelectItem key={g.id} value={g.id!} className="text-xs">{g.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-[9px] font-bold text-slate-400 uppercase">قائمة الموظفين</span>
                     <Button variant="ghost" size="sm" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1, hours: 8, hourlyCostRef: 0 }])} className="h-6 text-[9px]"><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="space-y-2">
                    {laborDetails.map((l, i) => (
                      <div key={i} className="flex gap-2 items-end group">
                         <div className="flex-1">
                            <Select value={l.trade} onValueChange={v => {
                               const emp = employees?.find(x => x.fullName === v);
                               const nl = [...laborDetails];
                               nl[i].trade = v;
                               nl[i].hourlyCostRef = (emp?.basicSalary || 0) / 26 / 8;
                               setLaborDetails(nl);
                            }}>
                               <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="..." /></SelectTrigger>
                               <SelectContent className="rounded-lg">
                                  {employees?.map(e => <SelectItem key={e.id} value={e.fullName} className="text-[10px]">{e.fullName}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <Input type="number" value={l.count} onChange={e => { const nl = [...laborDetails]; nl[i].count = Number(e.target.value); setLaborDetails(nl); }} className="h-8 w-12 text-center text-[10px] font-bold" />
                         <Trash2 className="h-4 w-4 text-slate-200 cursor-pointer hover:text-rose-500 mb-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setLaborDetails(laborDetails.filter((_, idx) => idx !== i))} />
                      </div>
                    ))}
                  </div>
               </CardContent>
            </Card>

            <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden">
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                     <Truck className="h-4 w-4 text-primary" /> {t('common.equipment')}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-4 text-start">
                  <div className="flex justify-between items-center">
                     <span className="text-[9px] font-bold text-slate-400 uppercase">{t('common.equipment')}</span>
                     <Button variant="ghost" size="sm" onClick={() => setEquipmentUsed([...equipmentUsed, { equipmentId: '', name: '', hoursUsed: 4, hourlyRateRef: 0 }])} className="h-6 text-[9px]"><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="space-y-2">
                    {equipmentUsed.map((e, i) => (
                      <div key={i} className="flex gap-2 items-center group">
                         <div className="flex-1">
                            <Select value={e.equipmentId} onValueChange={v => {
                               const eq = equipmentRegistry?.find(x => x.id === v);
                               const ne = [...equipmentUsed];
                               ne[i].equipmentId = v;
                               ne[i].name = eq?.name || '';
                               ne[i].hourlyRateRef = eq?.hourlyRentalRate || eq?.hourlyDepreciationRate || 0;
                               setEquipmentUsed(ne);
                            }}>
                               <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="..." /></SelectTrigger>
                               <SelectContent className="rounded-lg">
                                  {equipmentRegistry?.map(eq => <SelectItem key={eq.id} value={eq.id!} className="text-[10px]">{eq.name}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <Input type="number" value={e.hoursUsed} onChange={v => { const ne = [...equipmentUsed]; ne[i].hoursUsed = Number(v.target.value); setEquipmentUsed(ne); }} className="h-8 w-12 text-center text-[10px] font-bold" />
                         <Trash2 className="h-4 w-4 text-slate-200 cursor-pointer hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEquipmentUsed(equipmentUsed.filter((_, idx) => idx !== i))} />
                      </div>
                    ))}
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8">
            <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden">
               <CardHeader className="bg-slate-50 p-4 border-b flex flex-row justify-between items-center">
                  <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> {t('construction.siteProgress')}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setGridRows([...gridRows, { boqItemId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }])} className="h-7 text-[10px] font-bold gap-2">
                     <Plus className="h-3 w-3" /> {t('common.addLabel')}
                  </Button>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-0">
                           <TableHead className="text-[10px] font-bold uppercase ps-4">{t('common.addLabel')}</TableHead>
                           <TableHead className="text-center w-[100px] text-[10px] font-bold uppercase">{t('common.quantity')}</TableHead>
                           <TableHead className="text-center w-[100px] text-[10px] font-bold uppercase">{t('common.photos')}</TableHead>
                           <TableHead className="pe-4"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {gridRows.map((row, idx) => (
                           <TableRow key={idx} className="border-b-slate-50 group">
                              <TableCell className="ps-4 py-3 text-start">
                                 <Select value={row.boqItemId} onValueChange={v => updateRow(idx, 'boqItemId', v)}>
                                    <SelectTrigger className="h-8 text-[11px] font-medium bg-white border-slate-200"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="rounded-lg">{boqItems?.map(i => <SelectItem key={i.id} value={i.id!} className="text-[10px]">{i.referenceTitle}</SelectItem>)}</SelectContent>
                                 </Select>
                                 <Input value={row.notes} onChange={e => updateRow(idx, 'notes', e.target.value)} className="h-7 text-[10px] mt-1.5 border-transparent hover:border-slate-100 bg-slate-50/50" placeholder={t('common.notes')} />
                              </TableCell>
                              <TableCell><Input value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} className="h-8 text-center text-xs font-bold border-slate-200" /></TableCell>
                              <TableCell className="text-center">
                                 <div className="flex items-center justify-center gap-2">
                                    <label className="h-8 w-8 rounded-md bg-white border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50">
                                       {row.isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-4 w-4 text-slate-400" />}
                                       <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(idx, e)} disabled={row.isUploading} />
                                    </label>
                                    {row.photoUrls.length > 0 && <span className="text-[10px] font-black text-emerald-600">{row.photoUrls.length}</span>}
                                 </div>
                              </TableCell>
                              <TableCell className="pe-4"><Trash2 className="h-4 w-4 text-slate-200 cursor-pointer hover:text-rose-500 opacity-0 group-hover:opacity-100" onClick={() => setGridRows(gridRows.filter((_, i) => i !== idx))} /></TableCell>
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
   return <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}><NewFieldVisitForm /></Suspense>;
}
