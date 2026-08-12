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
  CalendarDays, PlusCircle, X
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Employee } from '@/types/hr';
import { Transaction, StageInstance } from '@/types/transaction';
import { BOQ, BOQItem } from '@/types/documents';
import { usePermissions } from '@/hooks/use-permissions';
import { BOQExecutionService } from '@/services/boq-execution-service';
import { SmartDateInput } from '@/components/ui/smart-date-input';

/**
 * شاشة تسجيل تقرير ميداني جديد - نسخة المساحة الكاملة (Full Width).
 * تم تصميمها لاستيعاب بيانات كثيفة (15+ صنف) دون الحاجة للسحب الجانبي.
 */
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

  // جداول الموارد (The 2x2 Sovereign Grid Data)
  const [staffRows, setStaffDetails] = useState<any[]>([{ position: '', count: 1 }]);
  const [laborRows, setLaborDetails] = useState<any[]>([{ trade: '', area: '', count: 1 }]);
  const [equipRows, setEquipmentUsed] = useState<any[]>([{ type: '', count: 1, hours: 8 }]);
  const [materialRows, setMaterialRows] = useState<any[]>([{ type: '', unit: '', quantity: 0 }]);

  // بنود التنفيذ المرتبطة بالمرحلة (The Execution DNA)
  const [executionRows, setExecutionRows] = useState<any[]>([{ boqItemId: '', quantity: '', notes: '' }]);

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

      // 1. تسجيل الحركات الفنية في المقايسة والتايملاين
      for (const row of executionRows.filter(r => r.boqItemId && Number(r.quantity) > 0)) {
         await execService.recordBOQItemExecution(
           activeBoq.id, row.boqItemId, activeStage.technicalStageId, Number(row.quantity),
           user.uid, officialName, row.notes || '', activeStage.id!, false, '', 
           { laborDetails: laborRows.filter(l => l.trade), equipmentUsed: [] }
         );
      }

      // 2. حفظ التقرير الموحد
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
        staffDetails: staffRows.filter(s => s.position),
        laborDetails: laborRows.filter(l => l.trade),
        equipmentUsed: equipRows.filter(e => e.type),
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

  const ResourceTable = ({ title, columns, data, setData, addRow }: any) => (
    <Card className="border-2 shadow-sm rounded-2xl overflow-hidden bg-white h-full transition-all hover:border-primary/20">
      <CardHeader className="bg-slate-50 border-b py-3 px-6 flex flex-row items-center justify-between">
        <CardTitle className="text-[11px] font-black uppercase text-slate-500 tracking-widest">{title}</CardTitle>
        <button type="button" onClick={addRow} className="text-primary hover:scale-125 transition-transform p-1 rounded-full hover:bg-primary/5">
           <PlusCircle className="h-5 w-5" />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="w-full">
          <TableHeader className="bg-white">
            <TableRow className="hover:bg-transparent border-b-2">
              {columns.map((col: string, i: number) => (
                <TableHead key={i} className="h-10 text-[10px] font-black text-slate-400 uppercase text-center border-e last:border-0">{col}</TableHead>
              ))}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any, idx: number) => (
              <TableRow key={idx} className="border-b last:border-0 hover:bg-slate-50/50">
                {Object.keys(row).map((key, i) => (
                  <TableCell key={i} className="p-1.5 border-e last:border-0">
                    <Input 
                      value={row[key]} 
                      onChange={e => {
                        const newData = [...data];
                        newData[idx][key] = e.target.value;
                        setData(newData);
                      }}
                      className="h-9 border-0 shadow-none text-center font-bold text-xs focus-visible:ring-0 bg-transparent"
                    />
                  </TableCell>
                ))}
                <TableCell className="p-0 text-center">
                   <button onClick={() => setData(data.filter((_:any, i:number) => i !== idx))} className="text-slate-300 hover:text-rose-500 transition-colors p-2">
                      <X className="h-4 w-4" />
                   </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 w-full max-w-full pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      
      <header className="sticky top-0 z-50 flex justify-between items-center gap-6 border-b bg-white/95 backdrop-blur-md px-8 py-5 shadow-sm border-primary/10">
        <div className="flex items-center gap-5 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/5 shadow-inner">
            <PlusCircle className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'تسجيل تقرير ميداني جديد' : 'New Field Report'}</h1>
            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-black uppercase mt-1 tracking-widest px-3">Standard Wide Grid</Badge>
          </div>
        </div>

        <div className="flex gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-xl font-black h-12 px-8 border-2 border-slate-100 bg-white hover:bg-slate-50 transition-all">{t('common.cancel')}</Button>
           <Button onClick={handleSave} disabled={loading || !activeStage} className="h-12 px-12 rounded-xl bg-primary text-white font-black shadow-2xl shadow-primary/20 gap-3 border-b-8 border-orange-700 hover:scale-[1.02] active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} 
              {isRtl ? 'اعتماد التقرير الآن' : 'Commit Report Now'}
           </Button>
        </div>
      </header>

      <div className="px-8 space-y-10">
         {/* Context Bar - Full Width */}
         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden w-full">
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-4 gap-10 items-center">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.clients')}</Label>
                   <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedProjectId(''); }}>
                      <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50 hover:bg-white transition-all shadow-inner"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl z-[150] shadow-3xl border-0">{contractedClients.map(c => <SelectItem key={c.id} value={c.id} className="font-bold py-4 border-b last:border-0">{c.name}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.projects')}</Label>
                   <Select disabled={!selectedClientId} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50/50 hover:bg-white transition-all shadow-inner"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl z-[150] shadow-3xl border-0">{clientProjects.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-4 border-b last:border-0">{p.subServiceName}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><Workflow className="h-3 w-3" /> {isRtl ? 'المرحلة النشطة' : 'Active Stage'}</Label>
                   {loadingStage ? <div className="h-14 flex items-center animate-pulse"><Loader2 className="h-5 w-5 animate-spin text-primary/30" /></div> : activeStage ? (
                     <div className="h-14 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex items-center px-6 gap-4 shadow-sm group">
                        <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110"><Workflow className="h-4 w-4" /></div>
                        <span className="text-sm font-black text-emerald-800 truncate">{activeStage.name}</span>
                     </div>
                   ) : (
                     <div className="h-14 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center px-6 text-slate-300">
                        <ShieldAlert className="h-4 w-4 me-3" />
                        <span className="text-[11px] font-bold italic">---</span>
                     </div>
                   )}
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.date')}</Label>
                   <SmartDateInput value={visitDate} onChange={setVisitDate} className="h-14" />
                </div>
            </CardContent>
         </Card>

         {/* BOQ Work Progress - Wide Section */}
         <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row justify-between items-center">
               <div className="text-start">
                  <CardTitle className="text-xl font-black font-headline flex items-center gap-4 text-slate-800"><Hammer className="h-7 w-7 text-primary" /> {isRtl ? 'إنجاز بنود المقايسة (BOQ)' : 'Work Items Execution Grid'}</CardTitle>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Direct linkage to Technical Path & Billing Triggers</p>
               </div>
               <Button variant="outline" onClick={() => setExecutionRows([...executionRows, { boqItemId: '', quantity: '', notes: '' }])} className="rounded-xl h-11 px-8 font-black border-2 gap-3 bg-white hover:bg-primary/5 transition-all">
                  <Plus className="h-5 w-5 text-primary" /> {isRtl ? 'إضافة بند تنفيذ' : 'Add Work Item'}
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
                                 <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">UNIT</span>
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

         {/* The Ultra-Wide 2x2 Resource Grid */}
         <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 pb-20">
            {/* Table 1: Staff */}
            <ResourceTable 
               title="I. STAFF RESOURCES" 
               columns={[isRtl ? 'الوظيفة الإدارية' : 'ADMIN POSITION', isRtl ? 'العدد' : 'NO']} 
               data={staffRows}
               setData={setStaffDetails}
               addRow={() => setStaffDetails([...staffRows, { position: '', count: 1 }])}
            />

            {/* Table 2: Labour */}
            <ResourceTable 
               title="II. LABOUR RESOURCES" 
               columns={[isRtl ? 'التخصص الفني' : 'TECHNICAL TRADE', isRtl ? 'المنطقة' : 'AREA / ZONE', isRtl ? 'العدد' : 'NO']} 
               data={laborRows}
               setData={setLaborDetails}
               addRow={() => setLaborDetails([...laborRows, { trade: '', area: '', count: 1 }])}
            />

            {/* Table 3: Equipment */}
            <ResourceTable 
               title="III. EQUIPMENT (STATIONARY & MOBILE)" 
               columns={[isRtl ? 'نوع المعدة' : 'EQUIPMENT TYPE', isRtl ? 'العدد' : 'NO', isRtl ? 'ساعات العمل' : 'HOURS']} 
               data={equipRows}
               setData={setEquipmentUsed}
               addRow={() => setEquipmentUsed([...equipRows, { type: '', count: 1, hours: 8 }])}
            />

            {/* Table 4: Material */}
            <ResourceTable 
               title="IV. MATERIALS (DELIVERED TO SITE)" 
               columns={[isRtl ? 'نوع المادة' : 'MATERIAL TYPE', isRtl ? 'الوحدة' : 'UOM', isRtl ? 'الكمية' : 'QTY']} 
               data={materialRows}
               setData={setMaterialRows}
               addRow={() => setMaterialRows([...materialRows, { type: '', unit: '', quantity: 0 }])}
            />
         </div>
      </div>
    </div>
  );
}

export default function NewSovereignGridReportPage() {
   return <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin text-primary" /></div>}><NewFieldVisitForm /></Suspense>;
}
