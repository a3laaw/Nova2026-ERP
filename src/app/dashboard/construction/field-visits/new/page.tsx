'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  LayoutGrid, UserCircle, ShieldCheck
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
  SelectValue 
} from "@/components/ui/select";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisitService } from '@/services/field-visit-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { BOQItem } from '@/types/documents';

/**
 * مكون البحث الذكي للعملاء والمشاريع
 */
function SearchablePicker({ value, onSelect, items, search, onSearchChange, icon: Icon, placeholder, isRtl, isLoading = false }: any) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full h-12 rounded-xl border-2 font-bold justify-between bg-white px-4 shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden text-start">
             <Icon className="h-4 w-4 text-primary opacity-40" />
             <span className="truncate">{isLoading ? '...' : (value || placeholder)}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-20" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 rounded-2xl shadow-3xl border-2 z-[200]" align="start">
         <div className="p-3 bg-slate-50 border-b">
            <div className="relative">
               <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
               <Input 
                 placeholder="بحث..." 
                 className="h-9 ps-9 rounded-lg border-2 bg-white text-xs font-bold"
                 value={search}
                 onChange={e => onSearchChange(e.target.value)}
               />
            </div>
         </div>
         <ScrollArea className="h-64">
            <div className="p-2 space-y-1">
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
                       (value === (item.nameAr || item.subServiceName)) ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                     )}
                   >
                      <div className="text-start">
                         <p className="font-black text-xs text-slate-900">{item.nameAr || item.subServiceName}</p>
                         <p className="text-[8px] font-mono text-slate-400 mt-1 uppercase">#{item.fileNumber || item.transactionNumber}</p>
                      </div>
                      {(value === (item.nameAr || item.subServiceName)) && <Check className="h-3.5 w-3.5" />}
                   </div>
                 ))
               )}
            </div>
         </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function NewStructuredFieldVisitPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
  const { permissions } = usePermissions();
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

  const [staffRows, setStaffRows] = useState<any[]>([{ subcontractorId: '', subcontractorName: '', count: 1 }]);
  const [equipRows, setEquipRows] = useState<any[]>([{ equipmentId: '', equipmentName: '', count: 1, hours: 8 }]);
  const [boqItems, setBoqItems] = useState<any[]>([]);

  // استعلامات البيانات المرجعية
  const clientsQuery = useMemo(() => companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, [db, companyId]);
  
  const transQuery = useMemo(() => 
    companyId && db && formData.clientId 
      ? query(collection(db, paths.transactions(companyId)), where('clientId', '==', formData.clientId)) 
      : null, 
  [db, companyId, formData.clientId]);

  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const equipQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('status', '==', 'available')) : null, [db, companyId]);
  const subsQuery = useMemo(() => companyId && db ? query(collection(db, paths.subcontractors(companyId)), where('status', '==', 'active')) : null, [db, companyId]);

  const { data: allClients, loading: clientsLoading } = useCollection<any>(clientsQuery);
  const { data: allTransactionsRaw, loading: transLoading } = useCollection<any>(transQuery);
  const { data: allEmployees } = useCollection<any>(empsQuery);
  const { data: allEquipment } = useCollection<any>(equipQuery);
  const { data: subcontractors } = useCollection<any>(subsQuery);

  const filteredClients = useMemo(() => (allClients || []).filter(c => c.nameAr?.toLowerCase().includes(clientSearch.toLowerCase()) || c.fileNumber?.includes(clientSearch)), [allClients, clientSearch]);
  
  const filteredTrans = useMemo(() => {
    return (allTransactionsRaw || [])
      .filter(t => t.status !== 'completed')
      .filter(t => {
        const name = (t.subServiceName || "").toLowerCase();
        const num = (t.transactionNumber || "").toLowerCase();
        const search = transSearch.toLowerCase();
        return name.includes(search) || num.includes(search);
      });
  }, [allTransactionsRaw, transSearch]);

  const [stages, setStages] = useState<any[]>([]);

  const getAvailableEquipment = (currentIndex: number) => {
    const selectedIds = equipRows.filter((_, i) => i !== currentIndex).map(r => r.equipmentId);
    return (allEquipment || []).filter(e => !selectedIds.includes(e.id));
  };

  useEffect(() => {
    if (db && companyId && formData.transactionId) {
      getDocs(query(collection(db, paths.transactionStages(companyId, formData.transactionId)), where('status', '==', 'in-progress')))
        .then(snap => setStages(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
        .catch(() => setStages([]));
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
                .map(i => ({ boqItemId: i.id, itemName: i.referenceTitle, quantity: 0, unit: i.unitSymbol || 'unit', notes: '' }));
             setBoqItems(items);
          });
      }
    }
  }, [db, companyId, formData.transactionId, formData.activeStageId, stages]);

  const addStaffRow = () => setStaffRows([...staffRows, { subcontractorId: '', subcontractorName: '', count: 1 }]);
  const addEquipRow = () => setEquipRows([...equipRows, { equipmentId: '', equipmentName: '', count: 1, hours: 8 }]);

  const updateBoqQty = (idx: number, val: string) => {
     const newItems = [...boqItems];
     newItems[idx].quantity = Number(val) || 0;
     setBoqItems(newItems);
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !formData.transactionId || !formData.activeStageId) return;
    setLoading(true);
    try {
      const service = new FieldVisitService(db, companyId);
      const visitData = {
        ...formData,
        items: boqItems.filter(i => i.quantity > 0),
        staffDetails: staffRows.filter(r => r.subcontractorId),
        equipmentUsed: equipRows.filter(r => r.equipmentId),
        engineerId: user.uid,
        engineerName: globalUser?.fullName || 'Engineer'
      };
      
      await service.submitFieldLog(visitData, user.uid);
      toast({ title: tSafe('inline.visit.recorded', 'تم حفظ السجل الميداني بنجاح', 'Visit Recorded Successfully') });
      router.push('/dashboard/construction/field-visits');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-full mx-auto pb-20 animate-in fade-in duration-500 text-start bg-white" dir={dir}>
      
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white/95 backdrop-blur-md px-8 shadow-sm">
        <div className="flex items-center gap-4 text-start">
           <button onClick={() => router.back()} className="h-10 w-10 border-2 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400 shadow-sm shrink-0">
             <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
              <h1 className="text-xl font-black font-headline text-slate-900">{isRtl ? 'توثيق سجل ميداني سيادي' : 'Sovereign Field Documentation'}</h1>
              <Badge className="bg-primary/10 text-primary border-0 text-[8px] font-black uppercase px-2 h-4">Quality & Integrity Control</Badge>
           </div>
        </div>
        <Button onClick={handleSave} disabled={loading || !formData.transactionId || !formData.activeStageId} className="h-12 px-10 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-4 border-orange-700">
           {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
           {tSafe('inline.commit.log', 'اعتماد السجل الميداني', 'Commit Field Log')}
        </Button>
      </header>

      <div className="max-w-full px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         
         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 p-6 border-b text-start">
                  <div className="flex items-center gap-4">
                     <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10"><LayoutGrid className="h-5 w-5" /></div>
                     <CardTitle className="text-base font-black uppercase tracking-tight">{tSafe('inline.site.context', 'سياق المعاملة والموقع', 'Site Context')}</CardTitle>
                  </div>
               </CardHeader>
               <CardContent className="p-8 space-y-6 text-start">
                  <div className="space-y-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('common.client', 'العميل', 'Client')}</Label>
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
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('common.transaction', 'المشروع / المعاملة', 'Transaction')}</Label>
                        <SearchablePicker 
                          disabled={!formData.clientId}
                          value={formData.transactionName}
                          onSelect={(t_row: any) => setFormData({...formData, transactionName: t_row.subServiceName, transactionId: t_row.id, transactionNumber: t_row.transactionNumber, activeStageId: '', activeStageName: ''})}
                          items={filteredTrans}
                          search={transSearch}
                          onSearchChange={setTransSearch}
                          icon={Workflow}
                          isLoading={transLoading}
                          placeholder={tSafe('inline.choose.project', 'اختر المشروع...', 'Select Project')}
                          isRtl={isRtl}
                        />
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{tSafe('inline.target.stage', 'المرحلة الجارية المستهدفة', 'Target Active Stage')}</Label>
                        <Select disabled={!formData.transactionId} value={formData.activeStageId} onValueChange={v => {
                           const s = stages.find(x => x.id === v);
                           setFormData({...formData, activeStageId: v, activeStageName: s?.name || ''});
                        }}>
                           <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-primary/5 border-primary/20 text-primary">
                              <SelectValue placeholder="..." />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl border shadow-2xl z-[160]">
                              {stages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold py-3 border-b last:border-0 border-slate-50">{s.name}</SelectItem>)}
                              {stages.length === 0 && formData.transactionId && <div className="p-4 text-center text-xs font-bold text-slate-400 italic">لا توجد مراحل نشطة للمباشرة.</div>}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
                  
                  <div className="space-y-1.5 pt-4 border-t">
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
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">
                     {tSafe('inline.field.integrity.desc', 'عند حفظ هذا السجل، سيتم تحديث نسب إنجاز المقايسة آلياً، وستظهر المطالبات المالية المستحقة للمقاولين في المركز المالي بناءً على توثيقك.', 'System will auto-update BOQ progress and trigger payables based on your log.')}
                  </p>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-8 space-y-8">
            
            {/* 1. إنجاز بنود المقايسة */}
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
                          <TableRow><TableCell colSpan={3} className="py-20 text-center text-slate-300 font-bold italic">{tSafe('inline.select.stage.first', 'يرجى اختيار المرحلة أولاً لعرض البنود.', 'Select stage to see work items.')}</TableCell></TableRow>
                        ) : boqItems.map((item, idx) => (
                           <TableRow key={idx} className="border-b-slate-50 hover:bg-slate-50/30 transition-colors">
                              <td className="py-6 ps-8 font-black text-slate-800 text-sm">{item.itemName}</td>
                              <td className="py-4">
                                 <div className="relative">
                                    <Input 
                                      type="number" 
                                      step="0.01"
                                      className="h-12 rounded-xl border-2 text-center font-black text-primary text-xl bg-white shadow-inner" 
                                      onChange={e => updateBoqQty(idx, e.target.value)}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300 uppercase">{item.unit}</span>
                                 </div>
                              </td>
                              <td className="pe-8"><Input className="h-10 border-2 rounded-xl bg-slate-50/30 text-xs font-bold" placeholder="..." /></td>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </Card>
            </div>

            {/* 2. الموارد البشرية والعمالة (Simplified) */}
            <div className="space-y-4 text-start">
               <div className="flex justify-between items-center px-1">
                  <h3 className="text-xl font-black font-headline text-slate-900 flex items-center gap-3">
                     <Users className="h-6 w-6 text-primary" /> {isRtl ? 'عمالة الموقع (باطن / شركة)' : 'Site Labor (SubCon / Internal)'}
                  </h3>
                  <Button onClick={addStaffRow} variant="outline" size="sm" className="rounded-xl border-2 font-black text-[10px] h-9 gap-2 shadow-sm">
                     <Plus className="h-3.5 w-3.5" /> {isRtl ? 'إضافة سجل عمالة' : 'Add Labor Row'}
                  </Button>
               </div>
               <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
                  <Table>
                     <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-0">
                           <TableHead className="py-5 ps-8 text-slate-500 font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المقاول / الجهة المنفذة' : 'Subcontractor / Entity'}</TableHead>
                           <TableHead className="text-center text-slate-900 font-black uppercase text-[10px] tracking-widest w-[120px]">{isRtl ? 'عدد العمالة' : 'No. of Workers'}</TableHead>
                           <TableHead className="pe-8 w-[60px]"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {staffRows.map((row: any, idx: number) => (
                           <TableRow key={idx} className="border-b last:border-0 hover:bg-slate-50/30 transition-colors">
                              <TableCell className="ps-8 py-4">
                                 <Select value={row.subcontractorId} onValueChange={v => {
                                    const sub = v === 'INTERNAL' ? { name: isRtl ? 'عمالة المنشأة (الشركة)' : 'Company Crew' } : subcontractors?.find((s:any) => s.id === v);
                                    const nr = [...staffRows];
                                    nr[idx] = { ...nr[idx], subcontractorId: v, subcontractorName: sub?.name || '' };
                                    setStaffRows(nr);
                                 }}>
                                    <SelectTrigger className={cn("h-11 rounded-xl border-2 font-black text-sm", row.subcontractorId === 'INTERNAL' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-white")}>
                                       <SelectValue placeholder={isRtl ? 'اختر المقاول المسؤول...' : 'Select Contractor...'} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border shadow-2xl z-[160]">
                                       <SelectItem value="INTERNAL" className="font-black text-xs py-3 border-b text-blue-600">
                                          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {isRtl ? 'عمالة المنشأة (الشركة)' : 'Internal Company Crew'}</span>
                                       </SelectItem>
                                       {subcontractors?.map((s: any) => (
                                          <SelectItem key={s.id} value={s.id!} className="font-bold py-3 text-xs border-b last:border-0 border-slate-50">
                                             <span className="flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" /> {s.name}</span>
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </TableCell>
                              <TableCell className="py-4">
                                 <Input 
                                   type="number" 
                                   value={row.count} 
                                   onChange={e => { const nr = [...staffRows]; nr[idx].count = Number(e.target.value); setStaffRows(nr); }} 
                                   className="h-11 rounded-xl border-2 text-center font-black text-xl bg-slate-50 shadow-inner" 
                                 />
                              </TableCell>
                              <TableCell className="pe-8">
                                 <Button variant="ghost" size="icon" onClick={() => setStaffRows(staffRows.filter((_: any, i: number) => i !== idx))} className="h-10 w-10 text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </Card>
            </div>

            {/* 3. المعدات والآليات */}
            <div className="space-y-4 text-start">
               <div className="flex justify-between items-center px-1">
                  <h3 className="text-xl font-black font-headline text-slate-900 flex items-center gap-3">
                     <Truck className="h-6 w-6 text-primary" /> {tSafe('inline.equipment.usage', 'المعدات والآليات الميدانية', 'Equipment Usage')}
                  </h3>
                  <Button onClick={addEquipRow} variant="outline" size="sm" className="rounded-xl border-2 font-black text-[10px] h-9 gap-2 shadow-sm">
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
                        {equipRows.map((row: any, idx: number) => {
                           const availableEquip = getAvailableEquipment(idx);
                           return (
                             <TableRow key={idx} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                                <TableCell className="ps-6 py-3 text-start">
                                   <Select onValueChange={v => {
                                      const eq = allEquipment?.find((x:any) => x.id === v);
                                      const nr = [...equipRows];
                                      nr[idx] = { ...nr[idx], equipmentId: v, equipmentName: eq?.name || '' };
                                      setEquipRows(nr);
                                   }}>
                                      <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                                      <SelectContent className="rounded-xl border shadow-2xl z-[160]">
                                         {availableEquip.map((e: any) => <SelectItem key={e.id} value={e.id!} className="font-bold py-3 text-xs border-b last:border-0">{e.name} ({e.code})</SelectItem>)}
                                      </SelectContent>
                                   </Select>
                                </TableCell>
                                <TableCell className="py-3">
                                   <Input type="number" defaultValue={1} className="h-10 rounded-xl border-2 text-center font-black bg-slate-50 shadow-inner" />
                                </TableCell>
                                <TableCell className="py-3">
                                   <Input type="number" defaultValue={8} className="h-10 rounded-xl border-2 text-center font-black bg-primary/5 text-primary" />
                                </TableCell>
                                <TableCell className="pe-8">
                                   <Button variant="ghost" size="icon" onClick={() => setEquipRows(equipRows.filter((_: any, i: number) => i !== idx))} className="h-10 w-10 text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                             </TableRow>
                           );
                        })}
                     </TableBody>
                  </Table>
               </Card>
            </div>

         </div>
      </div>
    </div>
  );
}
