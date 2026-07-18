'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Calculator, Trash2, Loader2, Save, X, 
  PlusCircle, LayoutGrid, Workflow,
  CheckCircle2, Plus, ArrowRight,
  Settings2, Clock, Info, Sparkles,
  AlertTriangle, GitBranch, Pencil, Zap
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore } from '@/firebase';
import { BOQItem, BOQVariationItem, VOStageMode } from '@/types/documents';
import { VariationService } from '@/services/variation-service';
import { BOQReferenceSelector } from '@/components/settings/checklists/boq-reference/boq-reference-selector';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Switch } from '@/components/ui/switch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  boqId: string;
  transactionId: string;
  boqNumber: string;
  boqItems: BOQItem[];
}

export function VOManagerDialog({ isOpen, onClose, boqId, transactionId, boqNumber, boqItems }: Props) {
  const { lang, dir, t } = useLanguage();
  const { user, globalUser } = useAuthContext();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<Partial<BOQVariationItem>[]>([]);
  const [availableStages, setAvailableStages] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && db && globalUser?.companyId) {
       getDocs(query(collection(db, paths.transactionStages(globalUser.companyId, transactionId)), orderBy('order', 'asc')))
         .then(snap => setAvailableStages(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
         .catch(() => setAvailableStages([]));
       
       setItems([]);
       setTitle("");
       setReason("");
    }
  }, [isOpen, transactionId, db, globalUser?.companyId]);

  const addItem = () => {
    setItems([...items, { 
      type: 'increase_quantity', 
      stageMode: 'existing_stage',
      description: '', 
      quantityDelta: "", 
      rate: "",         
      total: 0,
      insertAfterStageId: '',
      isComplementary: false,
      localStageName: '',
      localStageCode: '',
      targetSectionId: '',
      technicalStageId: ''
    } as any]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof BOQVariationItem, val: any) => {
    const newItems = [...items];
    const item = { ...newItems[idx], [field]: val };
    
    if (field === 'sourceBoqItemId' && val && item.type !== 'new_item') {
      const source = boqItems.find(i => i.id === val);
      if (source) {
        item.description = source.referenceTitle;
        item.unitName = source.unitName;
        item.unitSymbol = source.unitSymbol;
        item.rate = source.estimatedRate ?? "";
        item.sourcePlannedQuantity = source.plannedQuantity || 0;
        item.technicalStageId = source.technicalStageId;
      }
    }

    if (field === 'boqReferenceNodeId' && val) {
       const node = val as any;
       item.boqReferenceNodeId = node.id;
       item.description = node.title; 
       item.unitName = node.unitName;
       item.unitSymbol = node.unitSymbol;
       item.rate = node.estimatedRate ?? "";
       item.technicalStageId = node.technicalStageId || '';
       item.technicalStageIds = node.technicalStageIds || [];
    }

    if (field === 'quantityDelta' || field === 'rate' || field === 'type' || field === 'sourceBoqItemId') {
      const type = (field === 'type' ? val : item.type) || 'increase_quantity';
      let q = field === 'quantityDelta' ? (val === "" ? 0 : Math.abs(Number(val))) : Math.abs(Number(item.quantityDelta) || 0);
      const r = field === 'rate' ? (val === "" ? 0 : Number(val)) : (Number(item.rate) || 0);
      const multiplier = (type === 'decrease_quantity' || type === 'omit_item') ? -1 : 1;
      item.total = q * r * multiplier;
    }

    newItems[idx] = item;
    setItems(newItems);
  };

  const netTotal = useMemo(() => items.reduce((acc, i) => acc + (Number(i.total) || 0), 0), [items]);

  const boqSections = useMemo(() => {
    const sections = new Map<string, string>();
    boqItems.forEach(i => {
       if (i.ancestorIds && i.ancestorTitles) {
          i.ancestorIds.forEach((id, idx) => {
             const title = i.ancestorTitles![idx] || i.referenceCode || (isRtl ? 'بند رئيسي غير معرف' : 'Primary Section');
             if (title !== 'Section' && title !== 'Root' && title !== 'Root Section') {
                sections.set(id, title);
             }
          });
       }
    });
    return Array.from(sections.entries()).map(([id, title]) => ({ id, title }));
  }, [boqItems, isRtl]);

  const handleSave = async () => {
    if (!db || !globalUser?.companyId || !user) return;
    if (!title.trim()) return toast({ variant: "destructive", title: isRtl ? "عنوان الطلب مطلوب" : "Title required" });
    if (items.length === 0) return toast({ variant: "destructive", title: isRtl ? "إضافة تعديل واحد على الأقل" : "Add one change" });

    setLoading(true);
    try {
      const service = new VariationService(db, globalUser.companyId, permissions);
      await service.createVariation(boqId, transactionId, boqNumber, { title, reason }, items, user.uid);
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
        <div className="bg-[#1e1b4b] p-8 text-white text-start flex justify-between items-center relative overflow-hidden shrink-0">
           <div className="absolute top-0 right-0 p-8 opacity-5"><Calculator className="h-48 w-48" /></div>
           <div className="flex items-center gap-6 relative z-10">
              <div className="h-14 w-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-2xl ring-4 ring-primary/5">
                 <Calculator className="h-7 w-7" />
              </div>
              <div>
                 <DialogTitle className="text-2xl font-black font-headline">{isRtl ? 'أمر تغييري (VO)' : 'Variation Order'}</DialogTitle>
                 <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Linked to BOQ: {boqNumber}</p>
              </div>
           </div>
           <div className="text-end relative z-10">
              <p className="text-[9px] font-black text-primary uppercase mb-1">Net Change Value</p>
              <h3 className={cn("text-3xl font-black font-mono", netTotal >= 0 ? "text-emerald-400" : "text-rose-400")}>
                 {netTotal.toLocaleString()} <span className="text-xs opacity-40">KWD</span>
              </h3>
           </div>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-h-[70vh] overflow-y-auto scrollbar-hide text-start">
           <div className="lg:col-span-3 space-y-6">
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'عنوان التعديل' : 'VO Title'}</Label>
                 <Input value={title} onChange={e => setTitle(e.target.value)} className="h-11 rounded-xl border-2 font-bold" placeholder="..." />
              </div>
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المبرر الفني' : 'Justification'}</Label>
                 <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full min-h-[150px] rounded-xl border-2 bg-slate-50 p-4 text-xs font-bold resize-none shadow-inner" placeholder="..." />
              </div>
           </div>

           <div className="lg:col-span-9 space-y-6">
              <div className="flex justify-between items-center px-2">
                 <h4 className="text-base font-black flex items-center gap-2 text-slate-800"><LayoutGrid className="h-4 w-4 text-primary" /> {isRtl ? 'جدول تعديلات النطاق' : 'Scope Adjustments Grid'}</h4>
                 <Button onClick={addItem} variant="outline" className="rounded-xl font-black h-10 border-2 gap-2 shadow-sm text-xs"><PlusCircle className="h-4 w-4" /> {isRtl ? 'إضافة تعديل' : 'Add Adjustment'}</Button>
              </div>

              <div className="space-y-4 pb-6">
                 {items.map((item, idx) => {
                    const isNewItem = item.type === 'new_item';
                    return (
                      <Card key={idx} className={cn(
                        "border-0 shadow-lg rounded-2xl bg-white ring-1 ring-black/5 group hover:ring-2 transition-all overflow-hidden",
                        isNewItem ? "border-s-8 border-s-[#FFA000]" : "border-s-8 border-s-slate-100"
                      )}>
                         <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                               <div className="md:col-span-2 space-y-2">
                                  <Label className="text-10px font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الإجراء' : 'Action'}</Label>
                                  <Select value={item.type} onValueChange={(v: any) => updateItem(idx, 'type', v)}>
                                     <SelectTrigger className="h-10 rounded-lg border-2 font-black text-[10px] bg-slate-50/30"><SelectValue /></SelectTrigger>
                                     <SelectContent className="rounded-xl">
                                        <SelectItem value="increase_quantity" className="font-bold text-emerald-600">زيادة كمية</SelectItem>
                                        <SelectItem value="decrease_quantity" className="font-bold text-rose-600">نقص كمية</SelectItem>
                                        <SelectItem value="omit_item" className="font-bold text-slate-500">حذف بند</SelectItem>
                                        <SelectItem value="new_item" className="font-bold text-orange-600">بند مستجد</SelectItem>
                                     </SelectContent>
                                  </Select>
                               </div>

                               <div className="md:col-span-4 space-y-2">
                                  <Label className="text-10px font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'البند المستهدف' : 'Target Item'}</Label>
                                  {isNewItem ? (
                                     <div className="p-1 rounded-lg border-2 bg-slate-50">
                                       <BOQReferenceSelector onSelect={(node) => updateItem(idx, 'boqReferenceNodeId', node)} className="grid-cols-1 md:grid-cols-1 gap-2" />
                                     </div>
                                  ) : (
                                     <Select value={item.sourceBoqItemId} onValueChange={v => updateItem(idx, 'sourceBoqItemId', v)}>
                                        <SelectTrigger className="h-10 rounded-lg border-2 font-black text-[10px] bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                          {boqItems.map(i => (
                                            <SelectItem key={i.id} value={i.id!} className="font-bold text-[10px] py-3 border-b last:border-0 border-slate-50">
                                              <div className="flex flex-col text-start">
                                                <span className="font-black text-slate-800">{i.referenceTitle}</span>
                                                <span className="text-[8px] text-slate-400 font-mono">#{i.referenceCode}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                     </Select>
                                  )}
                               </div>

                               <div className="md:col-span-2 space-y-2">
                                  <Label className="text-10px font-black uppercase text-primary">Delta Qty</Label>
                                  <Input type="number" value={item.quantityDelta} onChange={e => updateItem(idx, 'quantityDelta', e.target.value)} className="h-10 rounded-lg border-2 font-black text-center text-xs" placeholder="..." />
                               </div>

                               <div className="md:col-span-3 space-y-2">
                                  <Label className="text-10px font-black text-slate-400">Rate & Total</Label>
                                  <div className="flex items-center gap-3">
                                     <Input type="number" step="0.001" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="h-10 rounded-lg border-2 font-black text-emerald-600 text-xs text-center" placeholder="..." />
                                     <div className="text-end min-w-[70px]"><p className={cn("text-[10px] font-black", (Number(item.total) || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>{(Number(item.total) || 0).toLocaleString()}</p></div>
                                  </div>
                               </div>

                               <div className="md:col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-10 w-10 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button></div>
                            </div>

                            {isNewItem && (
                              <div className="pt-6 border-t border-dashed space-y-6 animate-in slide-in-from-top-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center text-start">
                                   <div className="space-y-2">
                                      <Label className="text-10px font-black uppercase text-primary tracking-widest">{isRtl ? 'القسم المالي المستهدف (بند رئيسي):' : 'Target Financial Section:'}</Label>
                                      <Select value={item.targetSectionId} onValueChange={v => updateItem(idx, 'targetSectionId', v)}>
                                         <SelectTrigger className="h-10 rounded-xl border-2 font-black text-xs bg-primary/5 border-primary/20"><SelectValue placeholder="..." /></SelectTrigger>
                                         <SelectContent className="rounded-xl">
                                            {boqSections.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.title}</SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                   </div>
                                   <div className="space-y-2">
                                      <Label className="text-10px font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تحديد مسار المباشرة الميداني:' : 'Execution Path Mode:'}</Label>
                                      <Select value={item.stageMode || 'existing_stage'} onValueChange={(v: VOStageMode) => updateItem(idx, 'stageMode', v)}>
                                         <SelectTrigger className="h-10 rounded-xl border-2 font-black text-[11px]"><SelectValue /></SelectTrigger>
                                         <SelectContent className="rounded-xl">
                                            <SelectItem value="existing_stage" className="font-bold">{isRtl ? 'ربط بمرحلة موجودة' : 'Link to Existing Stage'}</SelectItem>
                                            <SelectItem value="new_local_stage" className="font-bold text-primary">{isRtl ? 'حقن مرحلة محلية جديدة' : 'Inject New Local Stage'}</SelectItem>
                                         </SelectContent>
                                      </Select>
                                   </div>
                                </div>

                                {item.stageMode === 'existing_stage' && (
                                   <div className="space-y-2 animate-in fade-in duration-300 text-start">
                                      <Label className="text-10px font-black uppercase text-blue-600 flex items-center gap-2">
                                         <Workflow className="h-3 w-3" /> {isRtl ? 'اختر المرحلة التنفيذية المرتبطة بهذا البند' : 'Select Linked Execution Stage'}
                                      </Label>
                                      <Select value={item.technicalStageId} onValueChange={v => updateItem(idx, 'technicalStageId', v)}>
                                         <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-blue-50/30 border-blue-100"><SelectValue placeholder="..." /></SelectTrigger>
                                         <SelectContent className="rounded-xl">
                                            {availableStages.map(s => (
                                               <SelectItem key={s.id} value={s.technicalStageId} className="font-bold text-xs py-2">
                                                  <span className="flex items-center gap-2">
                                                     <Badge variant="outline" className="h-4 px-1 text-[7px] font-black">{s.order + 1}</Badge>
                                                     {s.name}
                                                  </span>
                                               </SelectItem>
                                            ))}
                                         </SelectContent>
                                      </Select>
                                   </div>
                                )}

                                {item.stageMode === 'new_local_stage' && (
                                   <div className="p-6 bg-slate-50 rounded-2xl border-2 border-white shadow-inner space-y-6 animate-in slide-in-from-top-4 duration-500 text-start">
                                      <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                                         <Sparkles className="h-3.5 w-3.5" /> {isRtl ? 'تعريف المرحلة الميدانية المستجدة' : 'New Local Stage Definition'}
                                      </div>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                         <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-500">{isRtl ? 'اسم المرحلة (الذي سيظهر للمهندس):' : 'Stage Name (Display)'}</Label>
                                            <Input value={item.localStageName} onChange={e => updateItem(idx, 'localStageName', e.target.value)} className="h-10 rounded-lg border-2 font-black bg-white" placeholder={isRtl ? "مثلاً: أعمال صبغ إضافية" : "e.g. Additional Painting"} />
                                         </div>
                                         <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-500">{isRtl ? 'كود المرحلة التعريفي:' : 'Stage Ref Code:'}</Label>
                                            <Input value={item.localStageCode} onChange={e => updateItem(idx, 'localStageCode', e.target.value.toUpperCase())} className="h-10 rounded-lg border-2 font-mono text-xs bg-white" placeholder="VO_EXTRA_01" />
                                         </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                         <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-500">{isRtl ? 'مكان الإدراج (بعد مرحلة:)' : 'Insert sequence after:'}</Label>
                                            <Select value={item.insertAfterStageId} onValueChange={v => updateItem(idx, 'insertAfterStageId', v)}>
                                               <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                               <SelectContent className="rounded-xl border-2 shadow-2xl">
                                                  {availableStages.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-xs py-2">{s.name}</SelectItem>)}
                                               </SelectContent>
                                            </Select>
                                         </div>
                                         <div className="flex items-center justify-between p-4 bg-white rounded-xl border-2 shadow-sm">
                                            <div className="space-y-0.5">
                                               <Label className="font-black text-[10px] uppercase">{isRtl ? 'مرحلة موازية (Parallel)' : 'Parallel Execution'}</Label>
                                               <p className="text-[8px] text-slate-400 font-bold">{isRtl ? 'لا تعيق تقدم المسار الرئيسي' : 'Non-blocking phase'}</p>
                                            </div>
                                            <Switch checked={item.isComplementary} onCheckedChange={v => updateItem(idx, 'isComplementary', v)} />
                                         </div>
                                      </div>
                                   </div>
                                )}
                              </div>
                            )}
                         </CardContent>
                      </Card>
                    );
                 })}
              </div>
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0">
           <Button variant="outline" onClick={onClose} className="flex-1 h-14 rounded-2xl border-2 font-bold text-base bg-white">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading} className="flex-[2] btn-gradient h-14 rounded-2xl text-lg gap-3">
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
              {isRtl ? 'تأكيد وحفظ الأمر التغييري' : 'Confirm & Save VO'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
