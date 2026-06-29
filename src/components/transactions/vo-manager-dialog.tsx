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
  LayoutGrid, Hammer, ArrowRight, CheckCircle2
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
import { BOQItem, VariationType, BOQVariationItem } from '@/types/documents';
import { VariationService } from '@/services/variation-service';
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
    
    // Auto-fill from source BOQ Item
    if (field === 'sourceBoqItemId' && val) {
      const source = boqItems.find(i => i.id === val);
      if (source) {
        item.description = source.referenceTitle;
        item.unitName = source.unitName;
        item.unitSymbol = source.unitSymbol;
        item.rate = source.estimatedRate || 0;
      }
    }

    if (field === 'quantityDelta' || field === 'rate') {
      const q = field === 'quantityDelta' ? val : (item.quantityDelta || 0);
      const r = field === 'rate' ? val : (item.rate || 0);
      item.total = q * r;
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
    { value: 'new_item', label: isRtl ? 'بند مستجد' : 'New Item', color: 'text-blue-600' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
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
              <h3 className={cn("text-3xl font-black font-mono", netTotal >= 0 ? "text-emerald-400" : "text-rose-400")}>
                 {netTotal.toLocaleString()} <span className="text-sm opacity-40">KWD</span>
              </h3>
           </div>
        </div>

        <div className="p-10 grid grid-cols-1 lg:grid-cols-4 gap-10 max-h-[65vh] overflow-y-auto scrollbar-hide">
           {/* Form Meta */}
           <div className="lg:col-span-1 space-y-6 text-start">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'عنوان التعديل' : 'VO Title'}</Label>
                 <Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 rounded-xl border-2 font-bold" placeholder="..." />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'سبب الأمر التغييري' : 'Reason for Change'}</Label>
                 <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full min-h-[120px] rounded-xl border-2 bg-slate-50 p-4 text-xs font-bold focus:bg-white transition-all" />
              </div>
              <div className="p-6 rounded-[2.5rem] bg-blue-50/50 border-2 border-dashed border-blue-100 flex items-start gap-4">
                 <AlertTriangle className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                 <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
                    {isRtl ? 'تنبيه: لن يتم تغيير المقايسة الأصلية إلا بعد اعتماد هذا الأمر رسمياً من قبل الإدارة.' : 'Original BOQ won\'t change until this order is officially approved.'}
                 </p>
              </div>
           </div>

           {/* Items Builder */}
           <div className="lg:col-span-3 space-y-6">
              <div className="flex justify-between items-center px-2">
                 <h4 className="text-lg font-black flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" /> {isRtl ? 'جدول التعديلات' : 'Variation Line Items'}
                 </h4>
                 <Button onClick={addItem} variant="outline" className="h-10 rounded-xl font-black border-2 border-primary/20 text-primary gap-2">
                    <PlusCircle className="h-4 w-4" /> {isRtl ? 'إضافة تعديل' : 'Add Adjustment'}
                 </Button>
              </div>

              <div className="space-y-3">
                 {items.length === 0 ? (
                    <div className="py-20 text-center border-4 border-dashed rounded-[3rem] opacity-20 flex flex-col items-center gap-4">
                       <Plus className="h-12 w-12" />
                       <p className="font-black uppercase tracking-widest">{isRtl ? 'ابدأ بإضافة تعديلاتك هنا' : 'Start adding adjustments'}</p>
                    </div>
                 ) : (
                   items.map((item, idx) => (
                      <Card key={idx} className="border-0 shadow-lg rounded-[2rem] bg-white ring-1 ring-black/5 group hover:ring-2 hover:ring-primary/10 transition-all overflow-hidden">
                         <CardContent className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-2 space-y-1 text-start">
                               <Label className="text-[9px] font-black text-slate-400 uppercase">Action</Label>
                               <Select value={item.type} onValueChange={(v: VariationType) => updateItem(idx, 'type', v)}>
                                  <SelectTrigger className="h-10 rounded-xl border-2 font-black text-[10px]"><SelectValue /></SelectValue>
                                  <SelectContent className="rounded-xl">
                                     {VARIATION_TYPES.map(t => <SelectItem key={t.value} value={t.value} className={cn("font-bold", t.color)}>{t.label}</SelectItem>)}
                                  </SelectContent>
                               </Select>
                            </div>

                            <div className="md:col-span-4 space-y-1 text-start">
                               <Label className="text-[9px] font-black text-slate-400 uppercase">{item.type === 'new_item' ? 'Description' : 'Target BOQ Item'}</Label>
                               {item.type === 'new_item' ? (
                                  <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="h-10 rounded-xl border-2 font-bold" />
                               ) : (
                                  <Select value={item.sourceBoqItemId} onValueChange={v => updateItem(idx, 'sourceBoqItemId', v)}>
                                     <SelectTrigger className="h-10 rounded-xl border-2 font-black text-[10px] truncate"><SelectValue placeholder="..." /></SelectTrigger>
                                     <SelectContent className="rounded-xl max-w-sm">
                                        {boqItems.map(i => <SelectItem key={i.id} value={i.id!} className="font-bold text-[10px] py-3 border-b">{i.referenceTitle}</SelectItem>)}
                                     </SelectContent>
                                  </Select>
                               )}
                            </div>

                            <div className="md:col-span-2 space-y-1 text-start">
                               <Label className="text-[9px] font-black text-slate-400 uppercase">Delta (±)</Label>
                               <Input type="number" value={item.quantityDelta} onChange={e => updateItem(idx, 'quantityDelta', Number(e.target.value))} className="h-10 rounded-xl border-2 font-black text-center" />
                            </div>

                            <div className="md:col-span-3 space-y-1 text-start">
                               <Label className="text-[9px] font-black text-slate-400 uppercase">Rate / Total</Label>
                               <div className="flex items-center gap-2">
                                  <Input type="number" step="0.001" value={item.rate} onChange={e => updateItem(idx, 'rate', Number(e.target.value))} className="h-10 rounded-xl border-2 font-bold text-end" />
                                  <div className="text-end min-w-[60px]"><span className="text-[10px] font-black text-emerald-600">{(item.total || 0).toLocaleString()}</span></div>
                               </div>
                            </div>

                            <div className="md:col-span-1 flex justify-end">
                               <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                         </CardContent>
                      </Card>
                   ))
                 )}
              </div>
           </div>
        </div>

        <DialogFooter className="p-10 bg-slate-50 border-t flex flex-row gap-4">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 rounded-[1.5rem] border-2 font-black text-lg bg-white">
              {isRtl ? 'إلغاء' : 'Cancel'}
           </Button>
           <Button onClick={handleSave} disabled={loading || items.length === 0} className="flex-[2] h-16 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700">
              {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Save className="h-7 w-7" />}
              {isRtl ? 'حفظ مسودة الأمر' : 'Save VO Draft'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
