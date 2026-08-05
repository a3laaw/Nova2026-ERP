'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  HardHat, Save, Loader2, ArrowRight,
  MapPin, Camera, Users, Target,
  Plus, CheckCircle2, Trash2,
  Truck, LayoutGrid, Sparkles,
  Building2, UserCheck, Briefcase,
  Link as LinkIcon, Info, Image as ImageIcon
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisitService } from '@/services/field-visit-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function NewStructuredFieldVisitPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  
  // 1. اختيار العميل والمشروع
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeBoqId, setActiveBoqId] = useState('');
  
  // 2. بيانات التقرير
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [loggedItems, setLoggedItems] = useState<any[]>([]);
  const [laborMode, setLaborSelectionMode] = useState<'group' | 'individual'>('group');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [laborList, setLaborList] = useState<any[]>([]);
  const [equipmentList, setEquipmentUsed] = useState<any[]>([]);

  // Queries
  // فلترة العملاء الذين لديهم معاملات "مقاولات" فقط
  const transQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId)), where('activityTypeName', '>=', isRtl ? 'أعمال المقاولات' : 'Construction')) : null, 
  [db, companyId, isRtl]);
  const { data: allTransactions } = useCollection<any>(transQuery);

  const constructionClients = useMemo(() => {
    const clients = new Map();
    allTransactions?.forEach(t => {
      if (!clients.has(t.clientId)) clients.set(t.clientId, { id: t.clientId, name: t.clientName });
    });
    return Array.from(clients.values());
  }, [allTransactions]);

  const clientProjects = useMemo(() => {
    return allTransactions?.filter(t => t.clientId === selectedClientId) || [];
  }, [allTransactions, selectedClientId]);

  const groupsQuery = useMemo(() => companyId && db ? query(collection(db, paths.workGroups(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, [db, companyId]);
  const equipQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('status', '==', 'available')) : null, [db, companyId]);

  const { data: workGroups } = useCollection<any>(groupsQuery);
  const { data: departments } = useCollection<any>(deptsQuery);
  const { data: equipmentRegistry } = useCollection<any>(equipQuery);

  // جلب بنود المقايسة عند اختيار المشروع
  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setFetchingData(true);
    try {
      const boqsSnap = await getDocs(query(collection(db!, paths.boqs(companyId!)), where('transactionId', '==', projectId)));
      if (!boqsSnap.empty) {
        const boq = boqsSnap.docs[0];
        setActiveBoqId(boq.id);
        const itemsSnap = await getDocs(collection(db!, paths.boqItems(companyId!, boq.id)));
        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // تصفية البنود المخططة فقط
        setLoggedItems(items.filter((i: any) => i.plannedQuantity > 0).map(i => ({
           boqItemId: i.id,
           itemName: i.referenceTitle,
           quantity: 0,
           unit: i.unitSymbol || 'unit',
           notes: '',
           photoUrls: []
        })));
      }
    } finally {
      setFetchingData(false);
    }
  };

  const handlePhotoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !companyId) return;
    const storage = getStorage();
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
       const sRef = ref(storage, `site_logs/${companyId}/${Date.now()}_${files[i].name}`);
       const snap = await uploadBytes(sRef, files[i]);
       urls.push(await getDownloadURL(snap.ref));
    }
    const newItems = [...loggedItems];
    newItems[idx].photoUrls = [...newItems[idx].photoUrls, ...urls];
    setLoggedItems(newItems);
  };

  const handleSubmit = async () => {
    if (!db || !companyId || !user || !selectedProjectId) return;
    setLoading(true);
    try {
      const service = new FieldVisitService(db, companyId);
      const project = allTransactions?.find(t => t.id === selectedProjectId);
      const client = constructionClients.find(c => c.id === selectedClientId);
      
      const payload: any = {
        transactionId: selectedProjectId,
        transactionNumber: project?.transactionNumber,
        clientId: selectedClientId,
        clientName: client?.name,
        visitDate,
        engineerId: user.uid,
        engineerName: globalUser?.fullName || user.displayName || 'Engineer',
        items: loggedItems.filter(i => i.quantity > 0),
        laborSelectionMode: laborMode,
        laborDetails: laborList,
        equipmentUsed: equipmentList,
        status: 'submitted'
      };

      await service.submitFieldLog(payload, user.uid);
      toast({ title: isRtl ? "تم اعتماد تقرير الإنجاز" : "Field Report Committed" });
      router.push('/dashboard/construction/field-visits');
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-primary/20 pb-8">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تسجيل إنجاز ميداني هيكلي' : 'Structured Site Progress'}</h1>
           <p className="text-muted-foreground font-bold mt-1 uppercase text-[10px] tracking-widest opacity-60">Verified Execution & Resource Control</p>
        </div>
        <Button onClick={handleSubmit} disabled={loading || !selectedProjectId} className="h-16 px-12 rounded-2xl bg-primary text-white font-black text-xl shadow-2xl shadow-primary/20 border-b-8 border-orange-700 hover:scale-105 transition-all gap-3">
           {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-7 w-7" />}
           {isRtl ? 'اعتماد التقرير الميداني' : 'Commit Site Log'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-primary/5 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> {isRtl ? 'سياق العمل' : 'Project Context'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">العميل (مقاولات)</Label>
                     <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {constructionClients.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">المشروع</Label>
                     <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={handleProjectSelect}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {clientProjects.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.subServiceName}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ الإنجاز</Label>
                     <SmartDateInput value={visitDate} onChange={setVisitDate} />
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {isRtl ? 'توزيع القوى العاملة' : 'Labor Allocation'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6">
                  <Tabs value={laborMode} onValueChange={(v:any) => setLaborSelectionMode(v)} className="w-full">
                     <TabsList className="grid grid-cols-2 h-10 rounded-lg p-1 bg-slate-100">
                        <TabsTrigger value="group" className="text-[9px] font-black uppercase">{isRtl ? 'طاقم عمل' : 'Work Crew'}</TabsTrigger>
                        <TabsTrigger value="individual" className="text-[9px] font-black uppercase">{isRtl ? 'تعيين يدوي' : 'Pick Staff'}</TabsTrigger>
                     </TabsList>
                     <TabsContent value="group" className="pt-4 space-y-4">
                        <Select value={selectedGroupId} onValueChange={v => {
                           const group = workGroups?.find(g => g.id === v);
                           setSelectedGroupId(v);
                           // محاكاة إضافة أعضاء المجموعة
                           setLaborList([{ trade: group?.name || '', count: group?.memberCount || 0, hours: 8, hourlyCostRef: 0 }]);
                        }}>
                           <SelectTrigger className="h-10 border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{workGroups?.map((g:any) => <SelectItem key={g.id} value={g.id!}>{g.name}</SelectItem>)}</SelectContent>
                        </Select>
                     </TabsContent>
                     <TabsContent value="individual" className="pt-4 space-y-4">
                        <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                           <SelectTrigger className="h-10 border-2 font-bold"><SelectValue placeholder={isRtl ? "اختر القسم..." : "Select Dept..."} /></SelectTrigger>
                           <SelectContent>{departments?.map((d:any) => <SelectItem key={d.id} value={d.id!}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => setLaborList([...laborList, { trade: '', count: 1, hours: 8, hourlyCostRef: 0 }])} className="w-full text-[10px] font-black"><Plus className="h-3 w-3" /> أضف مهنة</Button>
                        {laborList.map((l, i) => (
                           <div key={i} className="flex gap-2 items-center"><Input placeholder="المهنة" value={l.trade} onChange={e => { const nl = [...laborList]; nl[i].trade = e.target.value; setLaborList(nl); }} className="h-8 text-[10px]" /><Input type="number" value={l.count} onChange={e => { const nl = [...laborList]; nl[i].count = Number(e.target.value); setLaborList(nl); }} className="h-8 w-12 text-center" /></div>
                        ))}
                     </TabsContent>
                  </Tabs>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Equipment'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-4">
                  <Button variant="outline" size="sm" onClick={() => setEquipmentUsed([...equipmentList, { equipmentId: '', hoursUsed: 4 }])} className="w-full text-[10px] font-black"><Plus className="h-3 w-3" /> أضف معدة</Button>
                  {equipmentList.map((e, i) => (
                     <div key={i} className="flex gap-2 items-center">
                        <Select value={e.equipmentId} onValueChange={v => { const ne = [...equipmentList]; ne[i].equipmentId = v; setEquipmentUsed(ne); }}>
                           <SelectTrigger className="h-8 border-2 text-[10px]"><SelectValue /></SelectTrigger>
                           <SelectContent>{equipmentRegistry?.map((x:any) => <SelectItem key={x.id} value={x.id!}>{x.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" value={e.hoursUsed} onChange={v => { const ne = [...equipmentList]; ne[i].hoursUsed = Number(v.target.value); setEquipmentUsed(ne); }} className="h-8 w-14 text-center" />
                        <Trash2 className="h-4 w-4 text-rose-300 cursor-pointer" onClick={() => setEquipmentUsed(equipmentList.filter((_, idx) => idx !== i))} />
                     </div>
                  ))}
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 min-h-[600px] flex flex-col">
               <CardHeader className="bg-slate-900 text-white p-8 border-b text-start shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg"><LayoutGrid className="h-6 w-6" /></div>
                     <div>
                        <CardTitle className="text-xl font-black">{isRtl ? 'جدول الأعمال المنجزة اليوم' : 'Daily Work Execution Grid'}</CardTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Direct BOQ-linked Logging</p>
                     </div>
                  </div>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto flex-1">
                  {fetchingData ? (
                     <div className="py-40 text-center flex flex-col items-center gap-4"><Loader2 className="animate-spin h-10 w-10 text-primary/30" /><p className="text-xs font-black text-slate-300 uppercase">Fetching Project Items...</p></div>
                  ) : !selectedProjectId ? (
                     <div className="py-40 text-center opacity-30 flex flex-col items-center gap-6"><Sparkles className="h-16 w-16 text-slate-200" /><p className="text-xl font-black text-slate-400">{isRtl ? 'يرجى اختيار المشروع أولاً' : 'Select a project to start'}</p></div>
                  ) : (
                     <Table>
                        <TableHeader className="bg-slate-50">
                           <TableRow>
                              <TableHead className="ps-8 text-start">{isRtl ? 'بند العمل' : 'Work Item'}</TableHead>
                              <TableHead className="text-center w-[120px]">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                              <TableHead className="text-start">{isRtl ? 'الملاحظة الفنية' : 'Engineering Note'}</TableHead>
                              <TableHead className="pe-8 w-[100px] text-center">{isRtl ? 'الصور' : 'Photos'}</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {loggedItems.map((item, idx) => (
                             <TableRow key={idx} className="hover:bg-primary/[0.01] border-b-slate-50">
                                <TableCell className="ps-8 py-6 text-start">
                                   <div className="text-start">
                                      <p className="font-black text-sm text-slate-800">{item.itemName}</p>
                                      <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-400 border-slate-100">{item.unit}</Badge>
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <Input type="number" step="0.01" value={item.quantity === 0 ? '' : item.quantity} onChange={e => { const ni = [...loggedItems]; ni[idx].quantity = e.target.value === '' ? 0 : Number(e.target.value); setLoggedItems(ni); }} className="h-12 border-2 font-black text-center text-lg bg-slate-50 shadow-inner" />
                                </TableCell>
                                <TableCell>
                                   <Input value={item.notes} onChange={e => { const ni = [...loggedItems]; ni[idx].notes = e.target.value; setLoggedItems(ni); }} className="h-10 border-2 text-xs font-bold" placeholder="..." />
                                </TableCell>
                                <TableCell className="pe-8 text-center">
                                   <div className="flex flex-col items-center gap-2">
                                      <label className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors border-2 border-white shadow-sm">
                                         <Camera className="h-4 w-4 text-slate-400" />
                                         <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(idx, e)} />
                                      </label>
                                      {item.photoUrls.length > 0 && <Badge className="bg-emerald-500 text-white font-black text-[8px] px-1.5 h-4">{item.photoUrls.length}</Badge>}
                                   </div>
                                </TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  )}
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}
