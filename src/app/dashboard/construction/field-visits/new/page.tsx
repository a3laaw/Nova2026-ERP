'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Trash2, Loader2, Save, Hammer, 
  Users, Truck, HardHat, Camera,
  ArrowRight, CheckCircle2, Workflow,
  Search, Check, ChevronDown, Landmark,
  AlertTriangle, Handshake, CalendarDays,
  LayoutGrid, UserCircle, ShieldCheck,
  User, UsersRound, Zap, ListChecks,
  Briefcase, X
} from "lucide-react";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisitService } from '@/services/field-visit-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { BOQItem } from '@/types/documents';

function SearchablePicker({ value, onSelect, items, search, onSearchChange, icon: Icon, placeholder, isRtl, isLoading = false, disabled = false }: any) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-full">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full h-10 rounded-xl border-2 font-bold justify-between bg-white px-4 shadow-sm text-start"
      >
        <div className="flex items-center gap-3 overflow-hidden text-start">
           <Icon className="h-4 w-4 text-primary opacity-40" />
           <span className="truncate text-xs">{isLoading ? '...' : (value || placeholder)}</span>
        </div>
        <ChevronDown className="h-4 w-4 opacity-20" />
      </Button>

      {open && (
        <div className="absolute z-[999] mt-2 w-full bg-white border-2 border-slate-100 rounded-2xl shadow-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 bg-slate-50 border-b border-slate-100 relative">
            <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ابحث..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
              className="h-10 ps-10 rounded-xl border-2 font-bold focus:border-primary"
            />
          </div>
          <ScrollArea className="max-h-[300px] overflow-y-auto p-2">
            <div className="space-y-1">
              {isLoading ? (
                <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/20" /></div>
              ) : items.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-slate-400 italic">لا توجد نتائج</div>
              ) : (
                items.map((item: any) => (
                  <div 
                    key={item.id} 
                    onClick={() => { onSelect(item); setOpen(false); }}
                    className={cn(
                      "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                      (value === (item.nameAr || item.subServiceName)) ? "bg-primary/5 text-primary border-primary/10" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex flex-col text-start">
                      <span className="font-bold text-sm">{item.nameAr || item.subServiceName}</span>
                      <span className="text-[10px] text-slate-400">#{item.fileNumber || item.transactionNumber}</span>
                    </div>
                    {(value === (item.nameAr || item.subServiceName)) && <Check className="h-4 w-4" />}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export default function NewStructuredFieldVisitPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [transSearch, setTransSearch] = useState("");

  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    transactionId: '',
    transactionNumber: '',
    transactionName: '',
    activeStageId: '',
    activeStageName: '',
    visitDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [staffRows, setStaffRows] = useState<any[]>([]);
  const [equipRows, setEquipRows] = useState<any[]>([]);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [linkedSubcontractors, setLinkedSubcontractors] = useState<any[]>([]);

  const clientsQuery = useMemo(() => companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, [db, companyId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active'), orderBy('fullName')) : null, [db, companyId]);
  const equipQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  const groupsQuery = useMemo(() => companyId && db ? query(collection(db, paths.workGroups(companyId)), where('isActive', '==', true)) : null, [db, companyId]);

  const { data: allClients, loading: clientsLoading } = useCollection<any>(clientsQuery);
  const { data: allEmployees } = useCollection<any>(empsQuery);
  const { data: allEquipment } = useCollection<any>(equipQuery);
  const { data: workGroups } = useCollection<any>(groupsQuery);

  const [clientTransactions, setClientTransactions] = useState<any[]>([]);
  const [transLoadingLocal, setTransLoadingLocal] = useState(false);

  useEffect(() => {
    async function fetchTrans() {
      if (!db || !companyId || !formData.clientId) {
        setClientTransactions([]);
        return;
      }
      setTransLoadingLocal(true);
      try {
        const q = query(collection(db, paths.transactions(companyId)), where('clientId', '==', formData.clientId));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClientTransactions(list.filter(t => t.status !== 'completed'));
      } finally {
        setTransLoadingLocal(false);
      }
    }
    fetchTrans();
  }, [db, companyId, formData.clientId]);

  const filteredClients = useMemo(() => (allClients || []).filter(c => c.nameAr?.toLowerCase().includes(clientSearch.toLowerCase()) || c.fileNumber?.includes(clientSearch)), [allClients, clientSearch]);
  
  const filteredTrans = useMemo(() => {
    return (clientTransactions || []).filter(t => (t.subServiceName || "").toLowerCase().includes(transSearch.toLowerCase()) || (t.transactionNumber || "").toLowerCase().includes(transSearch.toLowerCase()));
  }, [clientTransactions, transSearch]);

  const [stages, setStages] = useState<any[]>([]);

  useEffect(() => {
    if (db && companyId && formData.transactionId) {
      getDocs(query(collection(db, paths.subconContracts(companyId)), where('transactionId', '==', formData.transactionId)))
        .then(snap => {
           const list = snap.docs.map(d => ({ id: d.data().subcontractorId, name: d.data().subcontractorName }));
           setLinkedSubcontractors(list);
        });

      getDocs(query(collection(db, paths.transactionStages(companyId, formData.transactionId)), where('status', '==', 'in-progress')))
        .then(snap => setStages(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
        .catch(() => setStages([]));
    } else {
      setLinkedSubcontractors([]);
      setStages([]);
    }
  }, [db, companyId, formData.transactionId]);

  useEffect(() => {
    if (db && companyId && formData.transactionId && formData.activeStageId) {
      const stage = stages.find(s => s.id === formData.activeStageId);
      if (stage) {
        getDocs(query(collection(db, paths.boqs(companyId)), where('transactionId', '==', formData.transactionId)))
          .then(async boqSnap => {
             if (boqSnap.empty) return;
             const boqId = boqSnap.docs[0].id;
             const itemsSnap = await getDocs(collection(db, paths.boqItems(companyId, boqId)));
             const items = itemsSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as BOQItem))
                .filter(i => (i.technicalStageIds?.includes(stage.technicalStageId) || i.technicalStageId === stage.technicalStageId))
                .map(i => ({ boqId, boqItemId: i.id, itemName: i.referenceTitle, quantity: 0, unit: i.unitSymbol || 'unit', notes: '' }));
             setBoqItems(items);
          });
      }
    }
  }, [db, companyId, formData.transactionId, formData.activeStageId, stages]);

  const addCompanyStaffRow = () => setStaffRows([...staffRows, { resourceType: 'work_group', resourceId: '', resourceName: '', count: 1, notes: '' }]);
  const addSubconRow = () => setStaffRows([...staffRows, { resourceType: 'subcontractor', resourceId: '', resourceName: '', count: 1, notes: '' }]);
  const addEquipRow = () => setEquipRows([...equipRows, { equipmentId: '', equipmentName: '', count: 1, hours: 8 }]);

  const isResourceAdded = (id: string, type: string) => staffRows.some(r => r.resourceId === id && r.resourceType === type);

  const updateStaffRow = (idx: number, selectionId: string) => {
    const newRows = [...staffRows];
    if (selectionId.startsWith('GROUP_')) {
      const id = selectionId.replace('GROUP_', '');
      const g = workGroups?.find((x:any) => x.id === id);
      newRows[idx] = { ...newRows[idx], resourceType: 'work_group', resourceId: id, resourceName: g?.name || '', count: g?.memberCount || 1 };
    } else if (selectionId.startsWith('EMP_')) {
      const id = selectionId.replace('EMP_', '');
      const e = allEmployees?.find((x:any) => x.id === id);
      newRows[idx] = { ...newRows[idx], resourceType: 'employee', resourceId: id, resourceName: e?.fullName || '', count: 1 };
    } else if (selectionId.startsWith('SUB_')) {
      const id = selectionId.replace('SUB_', '');
      const s = linkedSubcontractors?.find((x:any) => x.id === id);
      newRows[idx] = { ...newRows[idx], resourceType: 'subcontractor', resourceId: id, resourceName: s?.name || '', count: 1 };
    }
    setStaffRows(newRows);
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !formData.transactionId || !formData.activeStageId) return;
    setLoading(true);
    try {
      const service = new FieldVisitService(db, companyId);
      const visitData = {
        ...formData,
        items: boqItems.filter(i => i.quantity > 0),
        staffDetails: staffRows.map(r => ({ type: r.resourceType, id: r.resourceId, name: r.resourceName, count: r.count, notes: r.notes })),
        equipmentUsed: equipRows.filter(r => r.equipmentId),
        engineerId: user.uid,
        engineerName: globalUser?.fullName || 'Engineer'
      };
      await service.submitFieldLog(visitData, user.uid);
      toast({ title: tSafe('inline.visit.recorded', 'تم حفظ السجل وتحديث المقايسة بنجاح', 'Visit Recorded Successfully') });
      router.push('/dashboard/construction/field-visits');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-start bg-[#fdfaf3] min-h-screen w-full max-w-[1600px] mx-auto" dir={dir}>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white/90 backdrop-blur-md px-8 shadow-sm">
        <div className="flex items-center gap-4 text-start">
           <button onClick={() => router.back()} className="h-10 w-10 border-2 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400 shrink-0">
             <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </button>
           <h1 className="text-xl font-black font-headline text-slate-900">{isRtl ? 'توثيق سجل ميداني سيادي' : 'Sovereign Field Documentation'}</h1>
        </div>
        <Button onClick={handleSave} disabled={loading || !formData.transactionId || !formData.activeStageId} className="h-12 px-10 rounded-xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 border-b-4 border-orange-700">
           {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('common.confirm')}
        </Button>
      </header>

      <div className="px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 p-6 border-b text-start">
                  <div className="flex items-center gap-4">
                     <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm"><LayoutGrid className="h-5 w-5" /></div>
                     <CardTitle className="text-base font-black uppercase tracking-tight">{tSafe('inline.site.context', 'سياق المعاملة والموقع', 'Site Context')}</CardTitle>
                  </div>
               </CardHeader>
               <CardContent className="p-6 space-y-6 text-start">
                  <div className="space-y-4">
                     <div className="space-y-1.5 text-start">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.client')}</Label>
                        <SearchablePicker 
                          value={formData.clientName}
                          onSelect={(c: any) => setFormData({...formData, clientName: c.nameAr, clientId: c.id, transactionId: '', transactionNumber: '', transactionName: '', activeStageId: '', activeStageName: ''})}
                          items={filteredClients}
                          search={clientSearch}
                          onSearchChange={setClientSearch}
                          icon={UserCircle}
                          isLoading={clientsLoading}
                          placeholder={tSafe('inline.choose.client', 'اختر العميل...', 'Select Client')}
                          isRtl={isRtl}
                        />
                     </div>
                     <div className="space-y-1.5 text-start">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.transaction')}</Label>
                        <SearchablePicker 
                          disabled={!formData.clientId}
                          value={formData.transactionName}
                          onSelect={(t_row: any) => setFormData({...formData, transactionName: t_row.subServiceName, transactionId: t_row.id, transactionNumber: t_row.transactionNumber, activeStageId: '', activeStageName: ''})}
                          items={filteredTrans}
                          search={transSearch}
                          onSearchChange={setTransSearch}
                          icon={Workflow}
                          isLoading={transLoadingLocal}
                          placeholder={tSafe('inline.choose.project', 'اختر المشروع...', 'Select Project')}
                          isRtl={isRtl}
                        />
                     </div>
                     <div className="space-y-1.5 text-start">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><Zap className="h-3 w-3" /> {tSafe('inline.target.stage', 'المرحلة الجارية المستهدفة', 'Target Active Stage')}</Label>
                        <Select disabled={!formData.transactionId} value={formData.activeStageId} onValueChange={v => {
                           const s = stages.find(x => x.id === v);
                           setFormData({...formData, activeStageId: v, activeStageName: s?.name || ''});
                        }}>
                           <SelectTrigger className="h-10 rounded-xl border-2 font-black bg-primary/5 border-primary/20 text-primary">
                              <SelectValue placeholder="..." />
                           </SelectTrigger>
                           <SelectContent>
                              {stages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold py-3 border-b last:border-0 border-slate-50">{s.name}</SelectItem>)}
                              {stages.length === 0 && <div className="p-4 text-center text-xs font-bold text-slate-400 italic">لا توجد مراحل نشطة (قيد التنفيذ) في رادار المشاريع حالياً.</div>}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
                  <div className="space-y-1.5 pt-4 border-t text-start">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.date')}</Label>
                     <SmartDateInput value={formData.visitDate} onChange={v => setFormData({...formData, visitDate: v})} />
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2rem] bg-slate-900 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5"><Landmark className="h-40 w-40" /></div>
               <CardContent className="p-8 space-y-4 relative z-10 text-start">
                  <div className="flex items-center gap-3 text-primary mb-2">
                     <ShieldCheck className="h-6 w-6" />
                     <h4 className="font-black text-lg uppercase tracking-tight">{tSafe('inline.field.integrity', 'بروتوكول النزاهة الميدانية', 'Field Integrity')}</h4>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">سيقوم النظام بتحديث نسب إنجاز المقايسة والمسار الفني آلياً فور الحفظ.</p>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8 space-y-8">
            <div className="space-y-4 text-start">
               <h3 className="text-xl font-black font-headline text-slate-900 flex items-center gap-3 border-b-2 pb-3 border-primary/10">
                  <Hammer className="h-6 w-6 text-primary" /> {tSafe('inline.boq.execution', 'إنجاز بنود المقايسة (BOQ)', 'BOQ Work Execution')}
               </h3>
               <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
                  <Table>
                     <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-0">
                           <TableHead className="py-5 ps-8 text-slate-500 font-black uppercase text-[10px] tracking-widest">{tSafe('inline.item.desc', 'وصف بند العمل', 'Work Item')}</TableHead>
                           <TableHead className="text-center text-primary font-black uppercase text-[10px] tracking-widest w-[140px]">{tSafe('common.quantity', 'الكمية المنفذة', 'Executed Qty')}</TableHead>
                           <TableHead className="pe-8 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('common.notes')}</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {boqItems.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="py-20 text-center text-slate-300 font-bold italic">يرجى اختيار المرحلة أولاً لعرض البنود المرتبطة بها في المقايسة.</TableCell></TableRow>
                        ) : boqItems.map((item, idx) => (
                           <TableRow key={idx} className="border-b-slate-50 hover:bg-slate-50/30 transition-colors">
                              <td className="py-6 ps-8 font-black text-slate-800 text-sm">{item.itemName}</td>
                              <td className="py-4">
                                 <div className="relative">
                                    <Input 
                                      type="number" 
                                      step="0.01"
                                      className="h-10 rounded-xl border-2 text-center font-black text-primary text-xl bg-white shadow-inner" 
                                      onChange={e => {
                                        const newItems = [...boqItems];
                                        newItems[idx].quantity = Number(e.target.value) || 0;
                                        setBoqItems(newItems);
                                      }}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300 uppercase">{item.unit}</span>
                                 </div>
                              </td>
                              <td className="pe-8"><Input value={item.notes} onChange={e => { const ni = [...boqItems]; ni[idx].notes = e.target.value; setBoqItems(ni); }} className="h-10 border-2 rounded-xl bg-slate-50/30 text-xs font-bold" placeholder="..." /></td>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </Card>
            </div>

            <div className="space-y-4 text-start">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                  <h3 className="text-xl font-black font-headline text-slate-900 flex items-center gap-3">
                     <Users className="h-6 w-6 text-primary" /> الموارد البشرية والعمالة
                  </h3>
                  <div className="flex gap-2 w-full md:w-auto">
                     <button onClick={addCompanyStaffRow} type="button" className="rounded-xl border-2 font-black text-[10px] h-10 gap-2 shadow-sm bg-white hover:bg-primary/5 px-4 flex items-center">
                        <UsersRound className="h-4 w-4 text-primary" /> عمالة الشركة / مجموعة
                     </button>
                     <button onClick={addSubconRow} type="button" disabled={!formData.transactionId} className="rounded-xl border-2 font-black text-[10px] h-10 gap-2 shadow-sm bg-white hover:bg-orange-50 border-orange-200 text-orange-600 px-4 flex items-center">
                        <Handshake className="h-4 w-4" /> عمالة مقاول باطن
                     </button>
                  </div>
               </div>
               
               <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
                  <Table>
                     <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-0">
                           <TableHead className="py-5 ps-8 text-slate-500 font-black uppercase text-[10px] tracking-widest">المورد / الجهة المنفذة</TableHead>
                           <TableHead className="text-center text-slate-900 font-black uppercase text-[10px] tracking-widest w-[100px]">{isRtl ? 'العدد' : 'Count'}</TableHead>
                           <TableHead className="text-start text-slate-500 font-black uppercase text-[10px] tracking-widest">بيان العمل المنفذ</TableHead>
                           <TableHead className="pe-8 w-[60px]"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {staffRows.length === 0 ? (
                           <TableRow><TableCell colSpan={4} className="py-16 text-center text-slate-300 font-bold italic">لا توجد عمالة مسجلة في هذا السجل.</TableCell></TableRow>
                        ) : staffRows.map((row, idx) => (
                           <TableRow key={idx} className="border-b last:border-0 hover:bg-slate-50/30 transition-colors">
                              <TableCell className="ps-8 py-4">
                                 <Select value={`${row.resourceType === 'work_group' ? 'GROUP_' : row.resourceType === 'employee' ? 'EMP_' : 'SUB_'}${row.resourceId}`} onValueChange={v => updateStaffRow(idx, v)}>
                                    <SelectTrigger className={cn(
                                      "h-10 rounded-xl border-2 font-black text-xs",
                                      row.resourceType === 'employee' ? "bg-blue-50 text-blue-600 border-blue-100" : (row.resourceType === 'subcontractor' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-white")
                                    )}>
                                       <SelectValue placeholder="اختر المورد..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px] overflow-y-auto">
                                       {row.resourceType === 'subcontractor' ? (
                                          <SelectGroup>
                                             <SelectLabel className="font-black text-[10px] text-slate-400 uppercase bg-slate-50 py-2">مقاولون مرتبطون مالياً بالمشروع</SelectLabel>
                                             {linkedSubcontractors.map(s => {
                                                const isDuplicate = isResourceAdded(s.id, 'subcontractor');
                                                return (
                                                  <SelectItem key={s.id} value={`SUB_${s.id}`} disabled={isDuplicate} className="font-bold py-3 text-xs border-b last:border-0 border-slate-50 text-start">
                                                     <div className="flex items-center gap-2">
                                                        <Handshake className={cn("h-4 w-4", isDuplicate ? "text-slate-200" : "text-orange-500")} /> 
                                                        <span>{s.name} {isDuplicate && `(${isRtl ? 'مختار' : 'Added'})`}</span>
                                                     </div>
                                                  </SelectItem>
                                                );
                                             })}
                                          </SelectGroup>
                                       ) : (
                                          <>
                                             <SelectGroup>
                                                <SelectLabel className="font-black text-[10px] text-slate-400 uppercase bg-slate-50 py-2">فرق العمل المعتمدة (Crews)</SelectLabel>
                                                {workGroups?.map((g: any) => {
                                                   const isDuplicate = isResourceAdded(g.id, 'work_group');
                                                   return (
                                                     <SelectItem key={g.id} value={`GROUP_${g.id}`} disabled={isDuplicate} className="font-black text-xs py-3 border-b last:border-0 border-slate-50 text-start">
                                                        <span className="flex items-center gap-2">
                                                           <UsersRound className={cn("h-4 w-4", isDuplicate ? "text-slate-200" : "text-primary")} /> 
                                                           {g.name} {isDuplicate && `(${isRtl ? 'مختار' : 'Added'})`}
                                                        </span>
                                                     </SelectItem>
                                                   );
                                                })}
                                             </SelectGroup>
                                             <SelectGroup>
                                                <SelectLabel className="font-black text-[10px] text-slate-400 uppercase bg-slate-50 py-2 mt-2">موظفون من كافة الأقسام (Individual)</SelectLabel>
                                                {allEmployees?.map((e: any) => {
                                                   const isDuplicate = isResourceAdded(e.id, 'employee');
                                                   return (
                                                     <SelectItem key={e.id} value={`EMP_${e.id}`} disabled={isDuplicate} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50 text-start">
                                                        <div className="flex items-center gap-2">
                                                           <User className={cn("h-4 w-4", isDuplicate ? "text-slate-200" : "text-blue-500")} /> 
                                                           <span>{e.fullName} {isDuplicate && `(${isRtl ? 'مختار' : 'Added'})`}</span>
                                                        </div>
                                                     </SelectItem>
                                                   );
                                                })}
                                             </SelectGroup>
                                          </>
                                       )}
                                    </SelectContent>
                                 </Select>
                              </TableCell>
                              <TableCell className="py-4">
                                 <Input 
                                   type="number" 
                                   readOnly={row.resourceType === 'employee'}
                                   value={row.count} 
                                   onChange={e => {
                                      const nr = [...staffRows];
                                      nr[idx].count = Number(e.target.value) || 0;
                                      setStaffRows(nr);
                                   }} 
                                   className={cn("h-10 rounded-xl border-2 text-center font-black text-lg", row.resourceType === 'employee' ? "bg-slate-100 text-slate-400 border-0" : "bg-slate-50 shadow-inner")} 
                                 />
                              </TableCell>
                              <TableCell className="py-4 text-start">
                                 <Input 
                                   value={row.notes} 
                                   onChange={e => {
                                      const nr = [...staffRows];
                                      nr[idx].notes = e.target.value;
                                      setStaffRows(nr);
                                   }}
                                   placeholder={isRtl ? "بيان العمل (نظافة، فك، صب...)" : "Work desc..."}
                                   className="h-10 rounded-xl border-2 font-bold text-xs bg-white" 
                                 />
                              </TableCell>
                              <TableCell className="pe-8">
                                 <Button variant="ghost" size="icon" onClick={() => setStaffRows(staffRows.filter((_, i) => i !== idx))} className="h-10 w-10 text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </Card>
            </div>

            <div className="space-y-4 text-start">
               <div className="flex justify-between items-center px-1">
                  <h3 className="text-xl font-black font-headline text-slate-900 flex items-center gap-3">
                     <Truck className="h-6 w-6 text-primary" /> {tSafe('inline.equipment.usage', 'المعدات والآليات الميدانية', 'Equipment Usage')}
                  </h3>
                  <Button onClick={addEquipRow} variant="outline" size="sm" className="rounded-xl border-2 font-black text-[10px] h-9 gap-2 shadow-sm bg-white">
                     <Plus className="h-3.5 w-3.5" /> {isRtl ? 'إضافة معدة' : 'Add Equipment'}
                  </Button>
               </div>
               <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
                  <Table>
                     <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-0">
                           <TableHead className="py-5 ps-8 text-slate-500 font-black uppercase text-[10px] tracking-widest">{tSafe('inline.machine.type', 'المعدة / الآلية', 'Machine')}</TableHead>
                           <TableHead className="text-center text-primary font-black uppercase text-[10px] tracking-widest w-[100px]">{tSafe('common.count', 'العدد', 'Qty')}</TableHead>
                           <TableHead className="text-center text-primary font-black uppercase text-[10px] tracking-widest w-[100px]">{tSafe('inline.hours', 'ساعات التشغيل', 'Hours')}</TableHead>
                           <TableHead className="pe-8 w-[60px]"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {equipRows.length === 0 ? (
                           <TableRow><TableCell colSpan={4} className="py-16 text-center text-slate-300 font-bold italic">لا توجد آليات مسجلة.</TableCell></TableRow>
                        ) : equipRows.map((row: any, idx: number) => (
                           <TableRow key={idx} className="border-b last:border-0 hover:bg-slate-50/30 transition-colors">
                              <TableCell className="ps-6 py-3 text-start">
                                 <Select value={row.equipmentId} onValueChange={v => {
                                    const eq = allEquipment?.find((x:any) => x.id === v);
                                    const nr = [...equipRows];
                                    nr[idx] = { ...nr[idx], equipmentId: v, equipmentName: eq?.name || '' };
                                    setEquipRows(nr);
                                 }}>
                                    <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="max-h-[300px] overflow-y-auto">
                                       {allEquipment?.map((e: any) => {
                                          const isDuplicate = equipRows.some((er, i) => er.equipmentId === e.id && i !== idx);
                                          return (
                                             <SelectItem key={e.id} value={e.id!} disabled={isDuplicate} className="font-bold py-3 text-xs border-b last:border-0 text-start">
                                                {e.name} ({e.code}) {isDuplicate && `(${isRtl ? 'مختارة' : 'Added'})`}
                                             </SelectItem>
                                          );
                                       })}
                                    </SelectContent>
                                 </Select>
                              </TableCell>
                              <TableCell className="py-3">
                                 <Input 
                                    type="number" 
                                    value={row.count} 
                                    onChange={e => { const nr = [...equipRows]; nr[idx].count = Number(e.target.value); setEquipRows(nr); }}
                                    className="h-10 rounded-xl border-2 text-center font-black bg-slate-50 shadow-inner" 
                                 />
                              </TableCell>
                              <TableCell className="py-3">
                                 <Input 
                                    type="number" 
                                    value={row.hours} 
                                    onChange={e => { const nr = [...equipRows]; nr[idx].hours = Number(e.target.value); setEquipRows(nr); }}
                                    className="h-10 rounded-xl border-2 text-center font-black bg-primary/5 text-primary" 
                                 />
                              </TableCell>
                              <TableCell className="pe-8">
                                 <Button variant="ghost" size="icon" onClick={() => setEquipRows(equipRows.filter((_, i) => i !== idx))} className="h-10 w-10 text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </Card>
            </div>
         </div>
      </div>
    </div>
  );
}