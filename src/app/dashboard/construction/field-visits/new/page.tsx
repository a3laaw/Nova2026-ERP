
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
  Link as LinkIcon, Info, Image as ImageIcon,
  X
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisitService } from '@/services/field-visit-service';
import { BOQExecutionService } from '@/services/boq-execution-service';
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
  
  // 1. Context Selections
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeBoqId, setActiveBoqId] = useState('');
  
  // 2. Report Data
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [loggedItems, setLoggedItems] = useState<any[]>([]);
  const [laborMode, setLaborSelectionMode] = useState<'group' | 'individual'>('group');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [laborList, setLaborList] = useState<any[]>([]);
  const [equipmentList, setEquipmentUsed] = useState<any[]>([]);

  // 3. Metadata for UI
  const [currentClientData, setCurrentClientData] = useState<any>(null);

  // Queries
  const transQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId)), where('activityTypeName', 'in', [isRtl ? 'أعمال المقاولات والإنشاءات' : 'Construction Works', 'أعمال المقاولات', 'Construction'])) : null, 
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

  const jobsQuery = useMemo(() => 
    companyId && db && selectedDeptId ? query(collection(db, paths.jobs(companyId, selectedDeptId))) : null, 
  [db, companyId, selectedDeptId]);
  const { data: availableJobs } = useCollection<any>(jobsQuery);

  // Auto-fill client metadata
  useEffect(() => {
    if (selectedClientId && db && companyId) {
      getDocs(query(collection(db, paths.clients(companyId)), where('id', '==', selectedClientId)))
        .then(snap => {
           if (!snap.empty) setCurrentClientData(snap.docs[0].data());
        });
    } else {
      setCurrentClientData(null);
    }
  }, [selectedClientId, db, companyId]);

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
        setLoggedItems(items.filter((i: any) => i.plannedQuantity > 0).map(i => ({
           boqItemId: i.id,
           itemName: i.referenceTitle,
           quantity: 0,
           unit: i.unitSymbol || 'unit',
           notes: '',
           photoUrls: [],
           technicalStageId: i.technicalStageId || ''
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

  const handleAddTrade = (jobName: string, rate: number) => {
    if (!jobName) return;
    setLaborList([...laborList, { trade: jobName, count: 1, hours: 8, hourlyCostRef: rate }]);
  };

  const handleSubmit = async () => {
    if (!db || !companyId || !user || !selectedProjectId) return;
    setLoading(true);
    try {
      const service = new FieldVisitService(db, companyId);
      const boqExecService = new BOQExecutionService(db, companyId);
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

      // 1. Submit the high-level summary report
      const visitId = await service.submitFieldLog(payload, user.uid);

      // 2. Individual BOQ Item Execution Records for Progress Tracking
      for (const item of loggedItems.filter(i => i.quantity > 0)) {
         await boqExecService.recordBOQItemExecution(
            activeBoqId, 
            item.boqItemId, 
            item.technicalStageId, 
            item.quantity, 
            user.uid, 
            globalUser?.fullName || 'Engineer', 
            item.notes, 
            '', // stageInstanceId logic would go here if specific stages were selected
            false,
            '', // appointmentId if this came from a scheduled appt
            { laborDetails: laborList, equipmentUsed: equipmentList }
         );
      }

      toast({ title: isRtl ? "تم اعتماد تقرير الإنجاز الميداني" : "Field Report Committed" });
      router.push('/dashboard/construction/field-visits');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-primary/20 pb-8">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تقرير إنجاز ميداني متكامل' : 'Structured Site Progress'}</h1>
           <p className="text-muted-foreground font-bold mt-1 uppercase text-[10px] tracking-widest opacity-60">Verified Execution & Resource Control</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={() => router.back()} className="h-16 px-8 rounded-2xl border-2 font-black">إلغاء</Button>
           <Button onClick={handleSubmit} disabled={loading || !selectedProjectId} className="h-16 px-12 rounded-2xl bg-primary text-white font-black text-xl shadow-2xl shadow-primary/20 border-b-8 border-orange-700 hover:scale-105 transition-all gap-3">
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-7 w-7" />}
              {isRtl ? 'اعتماد التقرير الميداني' : 'Commit Site Log'}
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
                     <Label className="text-[10px] font-black uppercase text-slate-400">العميل (عقود المقاولات فقط)</Label>
                     <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {constructionClients.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">المشروع / المعاملة</Label>
                     <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={handleProjectSelect}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {clientProjects.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.subServiceName} (#{p.transactionNumber})</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  
                  {currentClientData && (
                    <div className="p-4 bg-blue-50/50 rounded-2xl border-2 border-white shadow-inner space-y-3 animate-in fade-in">
                       <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Location Verified</p>
                             <p className="text-xs font-black text-slate-700">{currentClientData.governorateName} / {currentClientData.areaName}</p>
                          </div>
                       </div>
                       {currentClientData.locationUrl && (
                          <Button variant="link" onClick={() => window.open(currentClientData.locationUrl, '_blank')} className="h-auto p-0 text-[10px] font-bold text-blue-600 gap-1">
                             <ExternalLink className="h-3 w-3" /> عرض إحداثيات الموقع
                          </Button>
                       )}
                    </div>
                  )}

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ التنفيذ الميداني</Label>
                     <SmartDateInput value={visitDate} onChange={setVisitDate} />
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {isRtl ? 'القوى العاملة المستخدمة' : 'Labor Allocation'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6">
                  <Tabs value={laborMode} onValueChange={(v:any) => setLaborSelectionMode(v)} className="w-full">
                     <TabsList className="grid grid-cols-2 h-10 rounded-lg p-1 bg-slate-100">
                        <TabsTrigger value="group" className="text-[9px] font-black uppercase">{isRtl ? 'طاقم عمل' : 'Work Crew'}</TabsTrigger>
                        <TabsTrigger value="individual" className="text-[9px] font-black uppercase">{isRtl ? 'اختيار بالأقسام' : 'By Dept'}</TabsTrigger>
                     </TabsList>
                     <TabsContent value="group" className="pt-4 space-y-4">
                        <Select value={selectedGroupId} onValueChange={v => {
                           const group = workGroups?.find(g => g.id === v);
                           setSelectedGroupId(v);
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
                        {selectedDeptId && (
                           <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-1">
                              {availableJobs?.map(job => (
                                 <Badge 
                                   key={job.id} 
                                   onClick={() => handleAddTrade(job.name, job.hourlyCost || 0)}
                                   className="cursor-pointer bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all text-[9px] font-bold"
                                 >
                                    + {job.name}
                                 </Badge>
                              ))}
                           </div>
                        )}
                        <div className="space-y-2 max-h-40 overflow-y-auto pt-2">
                           {laborList.map((l, i) => (
                              <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border">
                                 <span className="text-[10px] font-black flex-1 truncate">{l.trade}</span>
                                 <Input type="number" value={l.count} onChange={e => { const nl = [...laborList]; nl[i].count = Number(e.target.value); setLaborList(nl); }} className="h-7 w-12 text-center text-[10px]" />
                                 <X className="h-3.5 w-3.5 text-rose-300 cursor-pointer" onClick={() => setLaborList(laborList.filter((_, idx) => idx !== i))} />
                              </div>
                           ))}
                        </div>
                     </TabsContent>
                  </Tabs>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Equipment'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-4">
                  <Select onValueChange={v => {
                     const item = equipmentRegistry?.find(x => x.id === v);
                     if (item) setEquipmentUsed([...equipmentList, { equipmentId: v, name: item.name, hoursUsed: 4, hourlyRateRef: item.hourlyRentalRate || item.hourlyDepreciationRate || 0 }]);
                  }}>
                     <SelectTrigger className="h-10 border-2 font-bold text-xs"><SelectValue placeholder={isRtl ? "إضافة معدة من السجل..." : "Add gear..."} /></SelectTrigger>
                     <SelectContent>{equipmentRegistry?.map((x:any) => <SelectItem key={x.id} value={x.id!}>{x.name} ({x.code})</SelectItem>)}</SelectContent>
                  </Select>
                  
                  <div className="space-y-2">
                     {equipmentList.map((e, i) => (
                        <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border">
                           <span className="text-[10px] font-black flex-1 truncate">{e.name}</span>
                           <div className="flex items-center gap-1">
                              <Input type="number" value={e.hoursUsed} onChange={v => { const ne = [...equipmentList]; ne[i].hoursUsed = Number(v.target.value); setEquipmentUsed(ne); }} className="h-7 w-12 text-center text-[10px]" />
                              <span className="text-[8px] font-bold text-slate-400">HRS</span>
                           </div>
                           <Trash2 className="h-3.5 w-3.5 text-rose-300 cursor-pointer hover:text-rose-600" onClick={() => setEquipmentUsed(equipmentList.filter((_, idx) => idx !== i))} />
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 min-h-[600px] flex flex-col">
               <CardHeader className="bg-slate-900 text-white p-8 border-b text-start shrink-0">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                     <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg"><LayoutGrid className="h-6 w-6" /></div>
                        <div>
                           <CardTitle className="text-xl font-black">{isRtl ? 'جدول بنود الأعمال المنجزة' : 'Work Execution Grid'}</CardTitle>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Integrated BOQ Logging</p>
                        </div>
                     </div>
                     {!selectedProjectId && <Badge className="bg-white/10 text-primary border-0 font-black px-6 py-2 rounded-xl animate-pulse uppercase">Waiting for Project selection</Badge>}
                  </div>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto flex-1">
                  {fetchingData ? (
                     <div className="py-40 text-center flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin h-10 w-10 text-primary/30" />
                        <p className="text-xs font-black text-slate-300 uppercase">Synchronizing Project BOQ...</p>
                     </div>
                  ) : !selectedProjectId ? (
                     <div className="py-40 text-center opacity-30 flex flex-col items-center gap-6">
                        <Sparkles className="h-16 w-16 text-slate-200" />
                        <p className="text-xl font-black text-slate-400">{isRtl ? 'يرجى اختيار المشروع لبدء تسجيل الإنجاز' : 'Select a project to enable grid'}</p>
                     </div>
                  ) : (
                     <Table>
                        <TableHeader className="bg-slate-50">
                           <TableRow>
                              <TableHead className="ps-8 text-start w-[250px]">{isRtl ? 'بند المقايسة' : 'BOQ Item'}</TableHead>
                              <TableHead className="text-center w-[120px]">{isRtl ? 'الكمية المنفذة' : 'Executed Qty'}</TableHead>
                              <TableHead className="text-start">{isRtl ? 'الملاحظة الفنية والعوائق' : 'Technical Notes & Obstacles'}</TableHead>
                              <TableHead className="pe-8 w-[100px] text-center">{isRtl ? 'إثبات مصور' : 'Photos'}</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {loggedItems.map((item, idx) => (
                             <TableRow key={idx} className="hover:bg-primary/[0.01] border-b-slate-50 group">
                                <TableCell className="ps-8 py-6 text-start">
                                   <div className="text-start">
                                      <p className="font-black text-sm text-slate-800 leading-tight">{item.itemName}</p>
                                      <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-400 border-slate-100 mt-1">{item.unit}</Badge>
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={item.quantity === 0 ? '' : item.quantity} 
                                      onChange={e => { const ni = [...loggedItems]; ni[idx].quantity = e.target.value === '' ? 0 : Number(e.target.value); setLoggedItems(ni); }} 
                                      className="h-12 border-2 font-black text-center text-lg bg-slate-50 shadow-inner group-hover:bg-white transition-all" 
                                   />
                                </TableCell>
                                <TableCell>
                                   <Input 
                                      value={item.notes} 
                                      onChange={e => { const ni = [...loggedItems]; ni[idx].notes = e.target.value; setLoggedItems(ni); }} 
                                      className="h-11 border-2 text-xs font-bold bg-white" 
                                      placeholder={isRtl ? "سجل ملاحظاتك هنا..." : "Add tech notes..."} 
                                   />
                                </TableCell>
                                <TableCell className="pe-8 text-center">
                                   <div className="flex flex-col items-center gap-2">
                                      <label className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-all border-2 border-white shadow-sm ring-1 ring-slate-100">
                                         <Camera className="h-4 w-4 text-slate-400" />
                                         <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(idx, e)} />
                                      </label>
                                      {item.photoUrls.length > 0 && <Badge className="bg-emerald-500 text-white font-black text-[8px] px-1.5 h-4 shadow-sm">{item.photoUrls.length}</Badge>}
                                   </div>
                                </TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  )}
               </CardContent>
            </Card>

            <div className="p-8 rounded-[3rem] bg-amber-50 border-4 border-dashed border-amber-200 flex items-start gap-4">
               <Info className="h-6 w-6 text-amber-600 mt-1 shrink-0" />
               <div className="text-start space-y-1">
                  <h4 className="font-black text-sm text-amber-900">{isRtl ? 'بروتوكول الاعتماد الميداني' : 'Field Validation Protocol'}</h4>
                  <p className="text-xs font-bold text-amber-700/80 leading-relaxed">
                     {isRtl 
                       ? 'تنبيه: سيتم ترحيل هذه الكميات فوراً لعداد الإنجاز الفني للمشروع. يرجى التأكد من مطابقة الصور المرفقة للكميات المسجلة لتسهيل عملية الاعتماد المالي من قبل الإدارة.' 
                       : 'Notice: Quantities logged will update the project progress counter immediately. Ensure photos match the quantities for faster billing approval.'}
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

