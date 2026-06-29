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
  PlusCircle, AlertTriangle, LayoutGrid,
  Hammer, Zap, Workflow, TrendingUp, TrendingDown
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
import { BOQItem, VariationType, BOQVariationItem } from '@/types/documents';
import { VariationService } from '@/services/variation-service';
import { BOQReferenceSelector } from '@/components/settings/checklists/boq-reference/boq-reference-selector';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';

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
    async function fetchStages() {
      if (!db || !globalUser?.companyId || !isOpen) return;
      const stagesSnap = await getDocs(query(collection(db, 'companies', globalUser.companyId, 'transactions', transactionId, 'stageInstances'), orderBy('order')));
      setAvailableStages(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchStages();
  }, [db, globalUser, transactionId, isOpen]);

  const addItem = () => {
    setItems([...items, { 
      type: 'increase_quantity', 
      description: '', 
      quantityDelta: 0, 
      rate: 0, 
      total: 0 
    }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof BOQVariationItem, val: any) => {
    const newItems = [...items];
    const item = { ...newItems[idx], [field]: val };
    
    if (field === 'sourceBoqItemId' && val) {
      const source = boqItems.find(i => i.id === val);
      if (source) {
        item.description = source.referenceTitle;
        item.unitName = source.unitName;
        item.unitSymbol = source.unitSymbol;
        item.rate = source.estimatedRate || 0;
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
       item.rate = node.estimatedRate || 0;
       item.sourcePlannedQuantity = 0;
       item.technicalStageId = node.technicalStageId || '';
    }

    if (field === 'quantityDelta' || field === 'rate' || field === 'type') {
      const type = field === 'type' ? val : (item.type || 'increase_quantity');
      const q = field === 'quantityDelta' ? Math.abs(val) : Math.abs(item.quantityDelta || 0);
      const r = field === 'rate' ? val : (item.rate || 0);
      
      const multiplier = (type === 'decrease_quantity' || type === 'omit_item') ? -1 : 1;
      item.total = q * r * multiplier;
      item.quantityDelta = q * multiplier;
    }

    newItems[idx] = item;
    setItems(newItems);
  };

  const netTotal = useMemo(() => items.reduce((acc, i) => acc + (i.total || 0), 0), [items]);

  const handleSave = async () => {
    if (!db || !globalUser?.companyId || !user) return;
    if (!title) return toast({ variant: "destructive", title: isRtl ? "العنوان مطلوب" : "Title required" });

    setLoading(true);
    try {
      const service = new VariationService(db, globalUser.companyId, permissions);
      await service.createVariation(boqId, transactionId, boqNumber, { title, reason }, items, user.uid);
      toast({ title: isRtl ? "تم حفظ مسودة الأمر" : "Draft Saved" });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const VARIATION_TYPES = [
    { value: 'increase_quantity', label: isRtl ? 'زيادة كمية' : 'Add Qty', color: 'text-emerald-600', icon: TrendingUp },
    { value: 'decrease_quantity', label: isRtl ? 'نقص كمية' : 'Reduce Qty', color: 'text-rose-600', icon: TrendingDown },
    { value: 'omit_item', label: isRtl ? 'حذف بند' : 'Omit Item', color: 'text-slate-500', icon: X },
    { value: 'new_item', label: isRtl ? 'بند مستجد' : 'New Item', color: 'text-blue-600', icon: PlusCircle },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
        <div className="bg-slate-900 p-10 text-white text-start flex justify-between items-center relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5"><Calculator className="h-48 w-48" /></div>
           <div className="flex items-center gap-6 relative z-10">
              <div className="h-16 w-16 bg-primary/20 rounded-3xl flex items-center justify-center text-primary shadow-2xl ring-4 ring-primary/5">
                 <Calculator className="h-8 w-8" />
              </div>
              <div>
                 <DialogTitle className="text-3xl font-black font-headline">{isRtl ? 'أمر تغييري (VO)' : 'Variation Order'}</DialogTitle>
                 <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Linked to BOQ: {boqNumber}</p>
              </div>
           </div>
           <div className="text-end relative z-10">
              <p className="text-[10px] font-black text-primary uppercase mb-1">Net Change Value</p>
              <h3 className={cn("text-4xl font-black font-mono", netTotal >= 0 ? "text-emerald-400" : "text-rose-400")}>
                 {netTotal.toLocaleString()} <span className="text-sm opacity-40">KWD</span>
              </h3>
           </div>
        </div>

        <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 max-h-[65vh] overflow-y-auto scrollbar-hide">
           <div className="lg:col-span-3 space-y-6 text-start">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">VO Title</Label>
                 <Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 rounded-xl border-2 font-bold focus:border-primary/50" placeholder="e.g. Phase 2 Scope Change" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">Reason / Justification</Label>
                 <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full min-h-[150px] rounded-xl border-2 bg-slate-50 p-4 text-xs font-bold focus:bg-white transition-all resize-none" placeholder="Provide reason for this variation..." />
              </div>
           </div>

           <div className="lg:col-span-9 space-y-6">
              <div className="flex justify-between items-center px-4">
                 <h4 className="text-lg font-black flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" /> {isRtl ? 'جدول تعديلات النطاق' : 'Scope Adjustments Grid'}</h4>
                 <Button onClick={addItem} variant="outline" className="rounded-xl font-black h-11 border-2 gap-2 shadow-sm hover:bg-slate-50"><PlusCircle className="h-4 w-4" /> {isRtl ? 'إضافة تعديل' : 'Add Adjustment'}</Button>
              </div>

              <div className="space-y-4">
                 {items.length === 0 ? (
                    <div className="p-20 text-center border-4 border-dashed rounded-[2.5rem] bg-slate-50/50 opacity-40">
                       <AlertTriangle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                       <p className="font-black text-slate-400 uppercase tracking-widest">No adjustments added yet.</p>
                    </div>
                 ) : (
                    items.map((item, idx) => {
                       const vType = VARIATION_TYPES.find(t => t.value === item.type);
                       const finalQty = (item.sourcePlannedQuantity || 0) + (item.quantityDelta || 0);

                       return (
                          <Card key={idx} className="border-0 shadow-lg rounded-[2rem] bg-white ring-1 ring-black/5 group hover:ring-2 hover:ring-primary/10 transition-all overflow-hidden animate-in slide-in-from-right-4 duration-300">
                             <CardContent className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                   <div className="md:col-span-2 space-y-2 text-start">
                                      <Label className="text-[9px] font-black text-slate-400 uppercase">Action</Label>
                                      <Select value={item.type} onValueChange={(v: VariationType) => updateItem(idx, 'type', v)}>
                                         <SelectTrigger className="h-11 rounded-xl border-2 font-black text-[11px] bg-slate-50/30">
                                            <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent className="rounded-xl border-0 shadow-2xl">
                                            {VARIATION_TYPES.map(t => (
                                               <SelectItem key={t.value} value={t.value} className={cn("font-bold py-3", t.color)}>
                                                  <div className="flex items-center gap-2">
                                                     <t.icon className="h-3.5 w-3.5" />
                                                     <span>{t.label}</span>
                                                  </div>
                                               </SelectItem>
                                            ))}
                                         </SelectContent>
                                      </Select>
                                   </div>

                                   <div className="md:col-span-4 space-y-2 text-start">
                                      <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'البند المستهدف' : 'Target Item'}</Label>
                                      {item.type === 'new_item' ? (
                                         <div className="p-1 rounded-xl border-2 bg-slate-50">
                                            <BOQReferenceSelector onSelect={(node) => updateItem(idx, 'boqReferenceNodeId', node)} className="grid-cols-1 md:grid-cols-1 gap-2" />
                                         </div>
                                      ) : (
                                         <Select value={item.sourceBoqItemId} onValueChange={v => updateItem(idx, 'sourceBoqItemId', v)}>
                                            <SelectTrigger className="h-11 rounded-xl border-2 font-black text-[11px] bg-white">
                                               <SelectValue placeholder={isRtl ? "اختر من المقايسة الحالية..." : "Select existing item..."} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl max-w-sm border-0 shadow-2xl">
                                               {boqItems.map(i => (
                                                  <SelectItem key={i.id} value={i.id!} className="font-bold text-[10px] py-4 border-b last:border-0 border-slate-50">
                                                     <div className="flex flex-col text-start">
                                                        <span>{i.referenceTitle}</span>
                                                        <span className="text-[7px] text-slate-400 uppercase tracking-widest mt-1">CODE: {i.referenceCode} | QTY: {i.plannedQuantity} {i.unitSymbol}</span>
                                                     </div>
                                                  </SelectItem>
                                               ))}
                                            </SelectContent>
                                         </Select>
                                      )}
                                   </div>

                                   <div className="md:col-span-1 space-y-2 text-start">
                                      <Label className="text-[9px] font-black text-slate-400 uppercase">Original</Label>
                                      <div className="h-11 flex items-center justify-center bg-slate-100 rounded-xl font-black text-slate-500 text-xs shadow-inner">
                                         {item.type !== 'new_item' ? (item.sourcePlannedQuantity || 0) : '-'}
                                      </div>
                                   </div>

                                   <div className="md:col-span-1 space-y-2 text-start">
                                      <Label className="text-[9px] font-black uppercase text-primary">Delta</Label>
                                      <Input type="number" value={Math.abs(item.quantityDelta || 0)} onChange={e => updateItem(idx, 'quantityDelta', Number(e.target.value))} className="h-11 rounded-xl border-2 border-primary/20 font-black text-center text-xs focus:border-primary" />
                                   </div>

                                   <div className="md:col-span-3 space-y-2 text-start">
                                      <Label className="text-[9px] font-black uppercase text-slate-400">Price & Total</Label>
                                      <div className="flex items-center gap-3">
                                         <Input type="number" step="0.001" value={item.rate} onChange={e => updateItem(idx, 'rate', Number(e.target.value))} className="h-11 rounded-xl border-2 font-black text-emerald-600 text-xs" />
                                         <div className="text-end min-w-[70px]">
                                            <p className={cn("text-xs font-black", (item.total || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                               {(item.total || 0).toLocaleString()}
                                            </p>
                                            <p className="text-[8px] font-black text-slate-300 uppercase">KWD</p>
                                         </div>
                                      </div>
                                   </div>

                                   <div className="md:col-span-1 flex justify-end">
                                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-11 w-11 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-5 w-5" /></Button>
                                   </div>
                                </div>

                                {/* الحسبة التفصيلية الميدانية في أسفل السطر */}
                                <div className="pt-4 border-t border-dashed flex flex-col md:flex-row items-center justify-between gap-4">
                                   <div className="flex items-center gap-3">
                                      <div className={cn("h-7 px-3 rounded-lg flex items-center gap-2 text-[9px] font-black uppercase", item.total && item.total >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                         {item.total && item.total >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                         {item.description || '...'} | {item.unitSymbol}
                                      </div>
                                      <Badge variant="outline" className="h-7 border-2 border-primary/20 bg-white font-black text-[9px] px-3">
                                         {item.type !== 'new_item' ? `${item.sourcePlannedQuantity} + (${item.quantityDelta}) = ${finalQty}` : `NEW: ${item.quantityDelta}`}
                                      </Badge>
                                   </div>

                                   {item.type === 'new_item' && (
                                      <div className="flex items-center gap-2 animate-in slide-in-from-top-2">
                                         <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase">
                                            <Workflow className="h-3.5 w-3.5" /> {isRtl ? 'ربط البند بمرحلة:' : 'Link to Stage:'}
                                         </div>
                                         <Select value={item.technicalStageId} onValueChange={v => updateItem(idx, 'technicalStageId', v)}>
                                            <SelectTrigger className="h-8 rounded-lg border-2 font-bold bg-white text-[10px] min-w-[150px]"><SelectValue placeholder="..." /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-0 shadow-2xl">
                                               {availableStages.map(s => <SelectItem key={s.id} value={s.technicalStageId || s.id} className="font-bold text-[10px]">{s.name}</SelectItem>)}
                                            </SelectContent>
                                         </Select>
                                      </div>
                                   )}
                                </div>
                             </CardContent>
                          </Card>
                       );
                    })
                 )}
              </div>
           </div>
        </div>

        <DialogFooter className="p-10 bg-slate-50 border-t flex flex-row gap-4">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 rounded-2xl border-2 font-black text-lg bg-white">Cancel</Button>
           <Button 
             onClick={handleSave} 
             disabled={loading || items.length === 0} 
             className="flex-[2] h-16 rounded-2xl bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 border-b-8 border-orange-700 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4"
           >
              {loading ? <Loader2 className="animate-spin h-7 w-7" /> : <Save className="h-7 w-7" />}
              {isRtl ? 'حفظ مسودة الأمر التغييري' : 'Save VO Draft'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
