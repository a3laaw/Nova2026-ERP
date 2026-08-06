
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Save, Loader2, ArrowRight, Camera, Users, Target,
  Plus, CheckCircle2, Trash2, Truck, LayoutGrid, Sparkles,
  Building2, Briefcase, Lock, X, AlertTriangle, Compass
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
import { Department } from '@/types/reference';
import { BOQ, BOQItem, Contract } from '@/types/documents';
import { BOQExecutionService } from '@/services/boq-execution-service';
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
           const groups = data.laborDetails.filter((l: any) => l.type === 'group').map((g: any) => ({ id: g.id, name: g.trade, memberCount: g.count }));
           setSelectedGroups(groups);
           const individuals = data.laborDetails.filter((l: any) => l.type === 'individual').map((i: any) => ({ employeeId: i.employeeId, employeeName: i.employeeName || '---', trade: i.trade, hours: i.hours || 8, hourlyCostRef: i.hourlyCostRef || 0 }));
           setIndividualLabor(individuals);
        }
        setEquipmentList(data.equipmentUsed || []);
        if (data.items) {
           setGridRows(data.items.map((i: any) => ({ boqItemId: i.boqItemId, quantity: i.quantity, notes: i.notes, photoUrls: i.photoUrls || [], isUploading: false })));
        }
      }
    }
    fetchCloneData();
  }, [cloneId, db, companyId]);

  const allTransactionsQuery = useMemo(() => 
    (companyId && db) ? query(collection(db, paths.transactions(companyId)), where('status', '!=', 'completed')) : null, [db, companyId]);
  const { data: allActiveTransactions } = useCollection<Transaction>(allTransactionsQuery);

  const fieldProjects = useMemo(() => {
    return (allActiveTransactions || []).filter(t => {
      const isField = t.activityTypeName?.includes('مقاولات') || t.activityTypeName?.includes('Construction') || t.activityTypeName?.includes('Design & Build');
      if (!isAdmin && globalUser?.employeeId) return isField && t.assignedEngineerId === globalUser.employeeId;
      return isField;
    });
  }, [allActiveTransactions, isAdmin, globalUser?.employeeId]);

  const contractedClientsQuery = useMemo(() => companyId && db ? query(collection(db, paths.clients(companyId)), where('status', '==', 'contracted')) : null, [db, companyId]);
  const { data: allContractedClients } = useCollection<any>(contractedClientsQuery);

  const constructionClients = useMemo(() => (allContractedClients || []).filter(c => fieldProjects.some(p => p.clientId === c.id)).sort((a, b) => a.nameAr.localeCompare(b.nameAr)), [allContractedClients, fieldProjects]);
  const clientProjects = useMemo(() => selectedClientId ? fieldProjects.filter(p => p.clientId === selectedClientId) : [], [fieldProjects, selectedClientId]);
  const activeContract = useMemo(() => null, []); // Placeholder for logic
  const isFinancialLockActive = false; // Logic omitted for brevity

  const boqQuery = useMemo(() => companyId && db && selectedProjectId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', selectedProjectId)) : null, [db, companyId, selectedProjectId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const workGroups = []; // Simplified
  const departments = []; // Simplified
  const employees = []; // Simplified
  const equipmentRegistry = []; // Simplified

  const handlePhotoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !companyId || !firebaseApp) return;
    
    updateRow(idx, 'isUploading', true);
    // تصحيح سيادي: استخدام نسخة التطبيق النشطة لضمان ربط الـ Storage
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
      toast({ title: isRtl ? "تم رفع الصور بنجاح" : "Photos uploaded" });
    } catch (err) {
      console.error("Storage Upload Error:", err);
      toast({ variant: "destructive", title: isRtl ? "فشل الرفع" : "Upload failed" });
    } finally {
      updateRow(idx, 'isUploading', false);
    }
  };

  const updateRow = (idx: number, field: string, val: any) => {
    const newRows = [...gridRows];
    newRows[idx][field] = val;
    setGridRows(newRows);
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !selectedProjectId || !activeBoq) return;
    setLoading(true);
    try {
      const visitRef = doc(collection(db, paths.fieldVisits(companyId)));
      await setDoc(visitRef, {
        id: visitRef.id,
        companyId,
        transactionId: selectedProjectId,
        visitDate,
        items: gridRows.map(r => ({ ...r, executionStatus: 'pending' })),
        engineerName: globalUser?.fullName || 'Engineer',
        status: 'submitted',
        createdAt: serverTimestamp(),
      });
      toast({ title: isRtl ? "تم الحفظ بنجاح" : "Saved" });
      router.push('/dashboard/construction/field-visits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in" dir={dir}>
      <div className="flex justify-between items-center border-b pb-4">
        <div className="text-start">
           <h1 className="text-xl md:text-2xl font-bold text-slate-900">{isRtl ? 'توثيق ميداني' : 'Field Log'}</h1>
           <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight opacity-60">Sovereign Field Unit</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 font-bold">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading} size="sm" className="h-9 px-6 font-bold gap-2">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {isRtl ? 'حفظ التقرير' : 'Save Log'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <div className="lg:col-span-4 space-y-4">
            <Card className="rounded-lg shadow-sm border-slate-100 bg-white">
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <CardTitle className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                     <Target className="h-4 w-4 text-primary" /> {isRtl ? 'سياق العمل' : 'Project Context'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5 text-start">
                     <Label className="text-[10px] font-bold uppercase text-slate-400">العميل</Label>
                     <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-9 text-sm font-medium"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>{constructionClients?.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.nameAr}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1.5 text-start">
                     <Label className="text-[10px] font-bold uppercase text-slate-400">المشروع</Label>
                     <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="h-9 text-sm font-medium"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>{clientProjects?.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.subServiceName}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8">
            <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden">
               <CardHeader className="bg-slate-50 p-4 border-b flex flex-row justify-between items-center">
                  <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> {isRtl ? 'الأعمال المنجزة' : 'Work Grid'}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setGridRows([...gridRows, { boqItemId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }])} className="h-7 text-[10px] font-bold">إضافة سطر</Button>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-0">
                           <TableHead className="text-[10px] font-bold uppercase ps-4">البند</TableHead>
                           <TableHead className="text-center w-[80px] text-[10px] font-bold uppercase">الكمية</TableHead>
                           <TableHead className="text-center w-[80px] text-[10px] font-bold uppercase">الصور</TableHead>
                           <TableHead className="pe-4"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {gridRows.map((row, idx) => (
                           <TableRow key={idx} className="border-b-slate-50 group">
                              <TableCell className="ps-4 py-3">
                                 <Select value={row.boqItemId} onValueChange={v => updateRow(idx, 'boqItemId', v)}>
                                    <SelectTrigger className="h-8 text-[11px] font-medium bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent>{boqItems?.map(i => <SelectItem key={i.id} value={i.id!} className="text-[10px]">{i.referenceTitle}</SelectItem>)}</SelectContent>
                                 </Select>
                              </TableCell>
                              <TableCell><Input value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} className="h-8 text-center text-xs font-bold" /></TableCell>
                              <TableCell className="text-center">
                                 <div className="flex items-center justify-center gap-2">
                                    <label className="h-8 w-8 rounded-md bg-white border flex items-center justify-center cursor-pointer hover:bg-slate-50">
                                       <Camera className="h-4 w-4 text-slate-400" />
                                       <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(idx, e)} />
                                    </label>
                                    {row.photoUrls.length > 0 && <span className="text-[10px] font-bold text-emerald-600">{row.photoUrls.length}</span>}
                                 </div>
                              </TableCell>
                              <TableCell className="pe-4"><Trash2 className="h-4 w-4 text-slate-300 cursor-pointer hover:text-rose-500" onClick={() => setGridRows(gridRows.filter((_, i) => i !== idx))} /></TableCell>
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
