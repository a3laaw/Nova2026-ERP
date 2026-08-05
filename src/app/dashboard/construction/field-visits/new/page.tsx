
'use client';

import { useState, useMemo, useEffect } from 'react';
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
  HardHat, Save, Loader2, ArrowRight,
  MapPin, Camera, Users, Target,
  Plus, CheckCircle2, Trash2,
  Truck, LayoutGrid, Sparkles,
  Building2, Briefcase, ExternalLink,
  Info, Image as ImageIcon, X,
  Activity
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Employee, WorkGroup } from '@/types/hr';
import { Transaction, StageInstance } from '@/types/transaction';
import { Equipment } from '@/types/equipment';
import { Department } from '@/types/reference';

export default function NewStructuredFieldVisitPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // --- States ---
  const [loading, setLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Labor States
  const [laborMode, setLaborSelectionMode] = useState<'group' | 'individual'>('group');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [laborList, setLaborList] = useState<any[]>([]);
  
  // Equipment State
  const [equipmentList, setEquipmentUsed] = useState<any[]>([]);

  // The Execution Grid State
  const [gridRows, setGridRows] = useState<any[]>([
    { stageId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }
  ]);

  // --- Queries ---

  // 1. Get Construction Activity Code ID
  const activitiesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.activityTypes(companyId))) : null, [db, companyId]);
  const { data: activityTypes } = useCollection<any>(activitiesQuery);
  const constructionActivityId = useMemo(() => 
    activityTypes?.find(a => a.code === 'CONSTRUCTION' || a.name.includes('مقاولات'))?.id, [activityTypes]);

  // 2. Filtered Clients (Construction Only)
  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, [db, companyId]);
  const { data: allClients } = useCollection<any>(clientsQuery);
  const constructionClients = useMemo(() => 
    allClients?.filter(c => c.activityTypeId === constructionActivityId || c.status === 'contracted'), [allClients, constructionActivityId]);

  // 3. Projects for Selected Client
  const projectsQuery = useMemo(() => 
    companyId && db && selectedClientId ? query(collection(db, paths.transactions(companyId)), where('clientId', '==', selectedClientId)) : null, 
  [db, companyId, selectedClientId]);
  const { data: clientProjects } = useCollection<Transaction>(projectsQuery);

  // 4. Stages for Selected Project (for Progress & Selection)
  const stagesQuery = useMemo(() => 
    companyId && db && selectedProjectId ? query(collection(db, paths.transactionStages(companyId, selectedProjectId)), orderBy('order')) : null,
  [db, companyId, selectedProjectId]);
  const { data: projectStages } = useCollection<StageInstance>(stagesQuery);

  // 5. Resources Data
  const groupsQuery = useMemo(() => companyId && db ? query(collection(db, paths.workGroups(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, [db, companyId]);
  const equipQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  
  const { data: workGroups } = useCollection<WorkGroup>(groupsQuery);
  const { data: departments } = useCollection<Department>(deptsQuery);
  const { data: equipmentRegistry } = useCollection<Equipment>(equipQuery);

  const availableEquip = useMemo(() => equipmentRegistry?.filter(e => e.status === 'available' || e.status === 'in_use'), [equipmentRegistry]);

  const jobsQuery = useMemo(() => 
    companyId && db && selectedDeptId ? query(collection(db, paths.jobs(companyId, selectedDeptId))) : null, 
  [db, companyId, selectedDeptId]);
  const { data: availableJobs } = useCollection<any>(jobsQuery);

  // --- Computations ---
  const selectedClient = useMemo(() => constructionClients?.find(c => c.id === selectedClientId), [constructionClients, selectedClientId]);
  
  const progressPercent = useMemo(() => {
    if (!projectStages || projectStages.length === 0) return 0;
    const completed = projectStages.filter(s => s.status === 'completed').length;
    return Math.round((completed / projectStages.length) * 100);
  }, [projectStages]);

  const availableStagesForGrid = useMemo(() => 
    projectStages?.filter(s => s.status !== 'completed'), [projectStages]);

  // --- Handlers ---
  const handleAddRow = () => {
    setGridRows([...gridRows, { stageId: '', quantity: '', notes: '', photoUrls: [], isUploading: false }]);
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

  const handleAddTrade = (job: any) => {
    if (!job) return;
    setLaborList([...laborList, { 
      trade: job.name, 
      count: 1, 
      hours: 8, 
      hourlyCostRef: job.hourlyCost || 0 
    }]);
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !selectedProjectId) return;
    
    // Validation
    if (gridRows.some(r => !r.stageId || !r.notes)) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يجب اختيار البند وكتابة ملاحظة لكل سطر في الجدول." });
      return;
    }

    setLoading(true);
    try {
      const project = clientProjects?.find(p => p.id === selectedProjectId);

      // إنشاء سجلات التنفيذ الفنية (Snapshot)
      for (const row of gridRows) {
        const stage = projectStages?.find(s => s.id === row.stageId);
        
        const payload = {
          companyId,
          transactionId: selectedProjectId,
          transactionNumber: project?.transactionNumber,
          clientId: selectedClientId,
          clientName: selectedClient?.nameAr,
          visitDate,
          technicalStageId: stage?.technicalStageId,
          stageInstanceId: row.stageId,
          quantity: Number(row.quantity) || 1,
          notes: row.notes,
          photoUrls: row.photoUrls,
          laborDetails: laborList,
          equipmentUsed: equipmentList,
          status: 'pending_review',
          recordedBy: user.uid,
          recordedByName: globalUser?.fullName || user.displayName || 'Engineer',
          createdAt: serverTimestamp()
        };

        await addDoc(collection(db, paths.executions(companyId)), payload);
      }

      toast({ title: isRtl ? "تم تسجيل الإنجاز الميداني" : "Site Progress Committed" });
      router.push('/dashboard/construction/field-visits');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-primary/20 pb-8">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تسجيل إنجاز ميداني هيكلي' : 'Structured Progress Log'}</h1>
           <p className="text-muted-foreground font-bold mt-1 uppercase text-[10px] tracking-widest opacity-60">Construction Unit Control</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={() => router.back()} className="h-16 px-8 rounded-2xl border-2 font-black">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading || !selectedProjectId} className="h-16 px-12 rounded-2xl bg-primary text-white font-black text-xl shadow-2xl shadow-primary/20 border-b-8 border-orange-700 hover:scale-105 transition-all gap-3">
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-7 w-7" />}
              {isRtl ? 'حفظ الزيارة والنتائج' : 'Commit Visit'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         
         {/* Sidebar Inputs */}
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
                     <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedProjectId(''); }}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl z-[150]">
                           {constructionClients?.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.nameAr}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">المشروع المستهدف</Label>
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
                          <span>{isRtl ? 'إجمالي الإنجاز الفني' : 'Technical Progress'}</span>
                          <span>{progressPercent}%</span>
                       </div>
                       <Progress value={progressPercent} className="h-2 bg-blue-100" />
                    </div>
                  )}
                  
                  <div className="p-4 bg-slate-50 rounded-2xl border-2 border-white shadow-sm space-y-3">
                     <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-primary" />
                        <div className="text-start">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Site Location</p>
                           {selectedClient?.locationUrl ? (
                             <a href={selectedClient.locationUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1">
                                {isRtl ? 'فتح في خرائط جوجل' : 'Open in Google Maps'} <ExternalLink className="h-2.5 w-2.5" />
                             </a>
                           ) : <p className="text-xs font-bold text-slate-400 italic">{isRtl ? 'لا يوجد موقع مسجل' : 'No location saved'}</p>}
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ التنفيذ</Label>
                     <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="h-11 rounded-xl border-2 font-black text-center" />
                  </div>
               </CardContent>
            </Card>

            {/* Labor Section */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {isRtl ? 'القوى العاملة الموزعة' : 'Labor Allocation'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6">
                  <Tabs value={laborMode} onValueChange={(v:any) => setLaborSelectionMode(v)} className="w-full">
                     <TabsList className="grid grid-cols-2 h-10 rounded-lg p-1 bg-slate-100">
                        <TabsTrigger value="group" className="text-[9px] font-black uppercase">{isRtl ? 'طاقم كامل' : 'By Crew'}</TabsTrigger>
                        <TabsTrigger value="individual" className="text-[9px] font-black uppercase">{isRtl ? 'بالقسم' : 'By Dept'}</TabsTrigger>
                     </TabsList>
                     <TabsContent value="group" className="pt-4 space-y-4">
                        <Select value={selectedGroupId} onValueChange={v => {
                           const group = workGroups?.find(g => g.id === v);
                           setSelectedGroupId(v);
                           if (group) setLaborList([...laborList, { trade: group.name, count: group.memberCount || 1, hours: 8, hourlyCostRef: 0 }]);
                        }}>
                           <SelectTrigger className="h-10 border-2 font-bold"><SelectValue placeholder={isRtl ? "اختيار طاقم..." : "Choose Crew..."} /></SelectTrigger>
                           <SelectContent className="rounded-xl border-2 shadow-2xl z-[150]">{workGroups?.map((g) => <SelectItem key={g.id} value={g.id!} className="font-bold">{g.name}</SelectItem>)}</SelectContent>
                        </Select>
                     </TabsContent>
                     <TabsContent value="individual" className="pt-4 space-y-4">
                        <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                           <SelectTrigger className="h-10 border-2 font-bold"><SelectValue placeholder={isRtl ? "اختر القسم..." : "Select Dept..."} /></SelectTrigger>
                           <SelectContent className="rounded-xl border-2 shadow-2xl z-[150]">{departments?.map((d) => <SelectItem key={d.id} value={d.id!}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {selectedDeptId && (
                           <div className="flex flex-wrap gap-2 pt-1">
                              {availableJobs?.map(job => (
                                 <Badge key={job.id} onClick={() => handleAddTrade(job)} className="cursor-pointer bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-[8px] font-black">+ {job.name}</Badge>
                              ))}
                           </div>
                        )}
                     </TabsContent>
                  </Tabs>
                  
                  <div className="space-y-2 border-t pt-4">
                     {laborList.map((l, i) => (
                        <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border shadow-inner">
                           <span className="text-[10px] font-black flex-1 truncate">{l.trade}</span>
                           <Input type="number" value={l.count} onChange={e => { const nl = [...laborList]; nl[i].count = Number(e.target.value); setLaborList(nl); }} className="h-7 w-12 text-center text-[10px] font-black" />
                           <X className="h-4 w-4 text-rose-300 cursor-pointer" onClick={() => setLaborList(laborList.filter((_, idx) => idx !== i))} />
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>

            {/* Equipment Section */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Equipment'}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-4">
                  <Select onValueChange={v => {
                     const item = availableEquip?.find(x => x.id === v);
                     if (item) setEquipmentUsed([...equipmentList, { equipmentId: v, name: item.name, hoursUsed: 4, actualCost: 0 }]);
                  }}>
                     <SelectTrigger className="h-10 border-2 font-bold text-xs"><SelectValue placeholder={isRtl ? "إضافة معدة..." : "Add Gear..."} /></SelectTrigger>
                     <SelectContent className="rounded-xl border-2 shadow-2xl z-[150]">{availableEquip?.map((x) => <SelectItem key={x.id} value={x.id!}>{x.name} (#{x.code})</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="space-y-2">
                     {equipmentList.map((e, i) => (
                        <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border">
                           <span className="text-[10px] font-black flex-1 truncate">{e.name}</span>
                           <div className="flex items-center gap-1">
                              <Input type="number" value={e.hoursUsed} onChange={v => { const ne = [...equipmentList]; ne[i].hoursUsed = Number(v.target.value); setEquipmentUsed(ne); }} className="h-7 w-12 text-center text-[10px] font-black" />
                              <span className="text-[8px] font-bold text-slate-400">HRS</span>
                           </div>
                           <Trash2 className="h-3.5 w-3.5 text-rose-300 cursor-pointer" onClick={() => setEquipmentUsed(equipmentList.filter((_, idx) => idx !== i))} />
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         </div>

         {/* The Main Execution Grid */}
         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 min-h-[600px] flex flex-col">
               <CardHeader className="bg-slate-900 text-white p-8 border-b text-start shrink-0">
                  <div className="flex justify-between items-center">
                     <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg"><LayoutGrid className="h-6 w-6" /></div>
                        <div>
                           <CardTitle className="text-xl font-black">{isRtl ? 'الأعمال المنجزة اليوم' : 'Daily Work Items'}</CardTitle>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Multi-Line Execution Log</p>
                        </div>
                     </div>
                     <Button onClick={handleAddRow} disabled={!selectedProjectId} className="h-10 px-6 rounded-xl bg-white/10 text-white hover:bg-white/20 font-black text-xs gap-2">
                        <Plus className="h-4 w-4" /> {isRtl ? 'إضافة بند عمل' : 'Add Item'}
                     </Button>
                  </div>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto flex-1">
                  {!selectedProjectId ? (
                     <div className="py-40 text-center opacity-30 flex flex-col items-center gap-6">
                        <Sparkles className="h-16 w-16 text-slate-200" />
                        <p className="text-xl font-black text-slate-400">{isRtl ? 'يرجى اختيار المشروع لتفعيل الجدول' : 'Select Project to enable grid'}</p>
                     </div>
                  ) : (
                     <Table>
                        <TableHeader className="bg-slate-50">
                           <TableRow>
                              <TableHead className="ps-8 text-start w-[200px]">{isRtl ? 'البند / المرحلة' : 'Stage/Item'}</TableHead>
                              <TableHead className="text-center w-[120px]">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                              <TableHead className="text-start">{isRtl ? 'الملاحظة' : 'Note'}</TableHead>
                              <TableHead className="pe-8 w-[100px] text-center">{isRtl ? 'صورة' : 'Evidence'}</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {gridRows.map((row, idx) => (
                             <TableRow key={idx} className="hover:bg-primary/[0.01] border-b-slate-50 group">
                                <TableCell className="ps-8 py-6">
                                   <Select value={row.stageId} onValueChange={v => updateRow(idx, 'stageId', v)}>
                                      <SelectTrigger className="h-10 border-2 font-bold text-[11px]"><SelectValue placeholder="..." /></SelectTrigger>
                                      <SelectContent className="rounded-xl border-2 shadow-2xl z-[150]">
                                         {availableStagesForGrid?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-[11px]">{s.name}</SelectItem>)}
                                      </SelectContent>
                                   </Select>
                                </TableCell>
                                <TableCell>
                                   <Input 
                                      value={row.quantity} 
                                      onChange={e => updateRow(idx, 'quantity', e.target.value)} 
                                      className="h-10 border-2 font-black text-center text-lg bg-slate-50/50" 
                                      placeholder="1"
                                   />
                                </TableCell>
                                <TableCell>
                                   <Input 
                                      value={row.notes} 
                                      onChange={e => updateRow(idx, 'notes', e.target.value)} 
                                      className="h-10 border-2 text-xs font-bold bg-white" 
                                      placeholder={isRtl ? "وصف العمل المنجز..." : "Describe work..."} 
                                   />
                                </TableCell>
                                <TableCell className="pe-8 text-center relative">
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
                                   {idx > 0 && <button onClick={() => removeRow(idx)} className="absolute -right-2 top-1/2 -translate-y-1/2 text-rose-300 hover:text-rose-500"><X className="h-4 w-4" /></button>}
                                </TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  )}
               </CardContent>
            </Card>

            <div className="p-8 rounded-[3rem] bg-amber-50 border-4 border-dashed border-amber-200 flex items-start gap-4">
               <Info className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
               <div className="text-start space-y-1">
                  <h4 className="font-black text-sm text-amber-900">{isRtl ? 'سياسة التدقيق المزدوج' : 'Double-Audit Policy'}</h4>
                  <p className="text-[10px] text-amber-800/80 font-bold leading-relaxed">
                     سيتم حفظ هذا السجل بحالة "قيد المراجعة". لن يتم ترحيله للمطالبة المالية إلا بعد اعتماد المدير للكميات الموثقة بالصور.
                     * تنبيه: `hourlyCostRef` سيتم تركه فارغاً بانتظار تفعيل مصفوفة التعرفة الكاملة.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
