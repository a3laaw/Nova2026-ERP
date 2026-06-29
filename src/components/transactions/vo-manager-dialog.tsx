'use client';

import { useState, useMemo } from 'react';
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
  Plus, Trash2, Loader2, Save, X, 
  PlusCircle, AlertTriangle, Calculator,
  LayoutGrid, Hammer, ArrowRight, CheckCircle2,
  GitBranch, Search
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
import { useFirestore } from '@/firebase';
import { BOQItem, VariationType, BOQVariationItem, BOQReferenceNode } from '@/types/documents';
import { VariationService } from '@/services/variation-service';
import { BOQReferenceSelector } from '@/components/settings/checklists/boq-reference/boq-reference-selector';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const db = useFirestore();
  const isRtl = lang === 'ar';

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<Partial<BOQVariationItem>[]>([]);

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
    
    // Auto-fill from source BOQ Item (for quantity adjustments)
    if (field === 'sourceBoqItemId' && val) {
      const source = boqItems.find(i => i.id === val);
      if (source) {
        item.description = source.referenceTitle;
        item.unitName = source.unitName;
        item.unitSymbol = source.unitSymbol;
        item.rate = source.estimatedRate || 0;
      }
    }

    // Auto-fill from Sovereign Registry (for new items)
    if (field === 'boqReferenceNodeId' && val) {
       // val here is the full node object from onSelect
       const node = val as any;
       item.boqReferenceNodeId = node.id;
       item.description = node.title;
       item.unitName = node.unitName;
       item.unitSymbol = node.unitSymbol;
       item.rate = node.estimatedRate || 0;
    }

    // Math Engine with Sign Correction
    if (field === 'quantityDelta' || field === 'rate' || field === 'type') {
      const type = field === 'type' ? val : (item.type || 'increase_quantity');
      const q = field === 'quantityDelta' ? Math.abs(val) : Math.abs(item.quantityDelta || 0);
      const r = field === 'rate' ? val : (item.rate || 0);
      
      // If it's a decrease or omission, ensure total is negative
      const multiplier = (type === 'decrease_quantity' || type === 'omit_item') ? -1 : 1;
      item.total = q * r * multiplier;
      
      // Update quantityDelta to store the signed version for DB consistency
      item.quantityDelta = q * multiplier;
    }

    newItems[idx] = item;
    setItems(newItems);
  };

  const netTotal = useMemo(() => items.reduce((acc, i) => acc + (i.total || 0), 0), [items]);

  const handleSave = async () => {
    if (!db || !globalUser?.companyId || !user) return;
    if (!title) return toast({ variant: "destructive", title: isRtl ? "العنوان مطلوب" : "Title required" });
    if (items.length === 0) return toast({ variant: "destructive", title: isRtl ? "يرجى إضافة بند واحد على الأقل" : "Add at least one item" });

    setLoading(true);
    try {
      const service = new VariationService(db, globalUser.companyId);
      await service.createVariation(
        boqId, 
        transactionId, 
        boqNumber, 
        { title, reason }, 
        items, 
        user.uid
      );
      toast({ title: isRtl ? "تم حفظ مسودة الأمر التغييري" : "Variation Draft Saved" });
      setItems([]);
      setTitle("");
      setReason("");
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const VARIATION_TYPES = [
    { value: 'increase_quantity', label: isRtl ? 'زيادة كمية' : 'Add Qty', color: 'text-emerald-600' },
    { value: 'decrease_quantity', label: isRtl ? 'نقص كمية' : 'Reduce Qty', color: 'text-rose-600' },
    { value: 'omit_item', label: isRtl ? 'حذف بند' : 'Omit Item', color: 'text-slate-500' },
    { value: 'new_item', label: isRtl ? 'بند مستجد' : 'New Item (Registry)', color: 'text-blue-600' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
        <div className="bg-slate-900 p-10 text-white text-start flex justify-between items-center border-b border-white/5">
           <div className="flex items-center gap-6">
              <div className="h-16 w-16 bg-primary/20 rounded-3xl flex items-center justify-center text-primary shadow-2xl ring-4 ring-primary/5">
                 <Calculator className="h-8 w-8" />
              </div>
              <div>
                 <DialogTitle className="text-3xl font-black font-headline tracking-tight">{isRtl ? 'أمر تغييري جديد (VO)' : 'New Variation Order'}</DialogTitle>
                 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Engineering Change Protocol | BOQ: {boqNumber}
                 </p>
              </div>
           </div>
           <div className="text-end">
              <p className="text-[10px] font-black text-primary uppercase mb-1">Net Change Value</p>
              <h3 className={cn("text-4xl font-black font-mono", netTotal >= 0 ? "text-emerald-400" : "text-rose-400")}>
                 {netTotal.toLocaleString()} <span className="text-sm opacity-40">KWD</span>
              </h3>
           </div>
        </div>

        <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 max-h-[65vh] overflow-y-auto scrollbar-hide">
           <div className="lg:col-span-3 space-y-6 text-start">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'عنوان التعديل' : 'VO Title'}</Label>
                 <Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 rounded-xl border-2 font-bold" placeholder="..." />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'سبب الأمر التغييري' : 'Reason for Change'}</Label>
                 <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full min-h-[120px] rounded-xl border-2 bg-slate-50 p-4 text-xs font-bold focus:bg-white transition-all shadow-inner" />
              </div>
              <div className="p-6 rounded-[2.5rem] bg-blue-50/50 border-2 border-dashed border-blue-100 flex items-start gap-4">
                 <AlertTriangle className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                 <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
                    {isRtl ? 'تنبيه: لن يتم تغيير المقايسة الأصلية إلا بعد اعتماد هذا الأمر رسمياً من قبل الإدارة.' : 'Original BOQ won\'t change until this order is officially approved.'}
                 </p>
              </div>
           </div>

           <div className="lg:col-span-9 space-y-6">
              <div className="flex justify-between items-center px-2">
                 <h4 className="text-lg font-black flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" /> {isRtl ? 'جدول التعديلات والبنود' : 'Variation Line Items'}
                 </h4>
                 <Button onClick={addItem} variant="outline" className="h-11 rounded-xl font-black border-2 border-primary/20 text-primary gap-2 hover:bg-primary/5 transition-all">
                    <PlusCircle className="h-4 w-4" /> {isRtl ? 'إضافة تعديل' : 'Add Adjustment'}
                 </Button>
              </div>

              <div className="space-y-4">
                 {items.length === 0 ? (
                    <div className="py-24 text-center border-4 border-dashed rounded-[4rem] opacity-20 flex flex-col items-center gap-6">
                       <Calculator className="h-16 w-16" />
                       <p className="font-black text-xl uppercase tracking-[0.3em]">{isRtl ? 'بانتظار إضافة تعديلات' : 'No Adjustments Yet'}</p>
                    </div>
                 ) : (
                   items.map((item, idx) => (
                      <Card key={idx} className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 group hover:ring-2 hover:ring-primary/10 transition-all overflow-hidden">
                         <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                               <div className="md:col-span-2 space-y-2 text-start">
                                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'نوع الإجراء' : 'Action'}</Label>
                                  <Select value={item.type} onValueChange={(v: VariationType) => updateItem(idx, 'type', v)}>
                                     <SelectTrigger className="h-11 rounded-xl border-2 font-black text-[11px] bg-slate-50/30">
                                        <SelectValue />
                                     </SelectTrigger>
                                     <SelectContent className="rounded-xl border-0 shadow-2xl">
                                        {VARIATION_TYPES.map(t => <SelectItem key={t.value} value={t.value} className={cn("font-bold", t.color)}>{t.label}</SelectItem>)}
                                     </SelectContent>
                                  </Select>
                               </div>

                               <div className="md:col-span-5 space-y-2 text-start">
                                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                     {item.type === 'new_item' ? (isRtl ? 'البند من القاموس السيادي' : 'Material Registry Node') : (isRtl ? 'بند المقايسة المستهدف' : 'Target BOQ Item')}
                                  </Label>
                                  {item.type === 'new_item' ? (
                                     <BOQReferenceSelector 
                                       onSelect={(node) => updateItem(idx, 'boqReferenceNodeId', node)} 
                                       className="grid-cols-1 md:grid-cols-1 gap-2"
                                     />
                                  ) : (
                                     <Select value={item.sourceBoqItemId} onValueChange={v => updateItem(idx, 'sourceBoqItemId', v)}>
                                        <SelectTrigger className="h-11 rounded-xl border-2 font-black text-[11px] bg-white truncate">
                                           <SelectValue placeholder={isRtl ? "اختر البند للتعديل..." : "Select existing item..."} />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl max-w-sm border-0 shadow-2xl">
                                           {boqItems.map(i => <SelectItem key={i.id} value={i.id!} className="font-bold text-[10px] py-4 border-b last:border-0">
                                              <div className="flex flex-col">
                                                 <span>{i.referenceTitle}</span>
                                                 <span className="text-[7px] text-slate-400 font-black uppercase">{i.referenceCode} | Qty: {i.plannedQuantity}</span>
                                              </div>
                                           </SelectItem>)}
                                        </SelectContent>
                                     </Select>
                                  )}
                               </div>

                               <div className="md:col-span-1 space-y-2 text-start">
                                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Delta (±)</Label>
                                  <Input 
                                    type="number" 
                                    value={Math.abs(item.quantityDelta || 0)} 
                                    onChange={e => updateItem(idx, 'quantityDelta', Number(e.target.value))} 
                                    className="h-11 rounded-xl border-2 font-black text-center text-lg bg-slate-50/50" 
                                  />
                               </div>

                               <div className="md:col-span-3 space-y-2 text-start">
                                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Price / Result</Label>
                                  <div className="flex items-center gap-3">
                                     <Input 
                                       type="number" 
                                       step="0.001" 
                                       value={item.rate} 
                                       onChange={e => updateItem(idx, 'rate', Number(e.target.value))} 
                                       className="h-11 rounded-xl border-2 font-black text-end text-emerald-600 bg-slate-50/50" 
                                     />
                                     <div className="text-end min-w-[70px]">
                                        <p className={cn("text-sm font-black font-mono", (item.total || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                           {(item.total || 0).toLocaleString()}
                                        </p>
                                     </div>
                                  </div>
                               </div>

                               <div className="md:col-span-1 flex justify-end">
                                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-11 w-11 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all">
                                     <Trash2 className="h-5 w-5" />
                                  </Button>
                               </div>
                            </div>
                            
                            {/* Metadata Display */}
                            {item.description && (
                              <div className="pt-4 border-t border-dashed flex items-center gap-4 animate-in slide-in-from-top-2">
                                 <Badge variant="outline" className="bg-slate-50 border-0 font-black text-[9px] px-3">{isRtl ? 'اسم البند:' : 'Item Name:'} {item.description}</Badge>
                                 <Badge variant="outline" className="bg-slate-50 border-0 font-black text-[9px] px-3">{isRtl ? 'الوحدة:' : 'Unit:'} {item.unitSymbol || '-'}</Badge>
                                 {item.total !== 0 && (
                                   <Badge className={cn("border-0 font-black text-[9px] px-3", (item.total || 0) > 0 ? "bg-emerald-500" : "bg-rose-500")}>
                                      {(item.total || 0) > 0 ? '+' : '-'} {Math.abs(item.total || 0)} KWD
                                   </Badge>
                                 )}
                              </div>
                            )}
                         </CardContent>
                      </Card>
                   ))
                 )}
              </div>
           </div>
        </div>

        <DialogFooter className="p-10 bg-slate-50 border-t flex flex-row gap-4">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 rounded-[1.5rem] border-2 font-black text-lg bg-white shadow-sm hover:bg-slate-50 transition-all">
              {isRtl ? 'إلغاء الأمر' : 'Cancel'}
           </Button>
           <Button onClick={handleSave} disabled={loading || items.length === 0} className="flex-[2] h-16 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700">
              {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Save className="h-7 w-7" />}
              {isRtl ? 'حفظ مسودة الأمر التغييري' : 'Save VO Draft'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
