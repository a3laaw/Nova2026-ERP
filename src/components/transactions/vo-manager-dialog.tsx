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
  Hammer, Zap, Workflow
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
import { BOQItem, VariationType, BOQVariationItem, BOQReferenceNode } from '@/types/documents';
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

  // جلب مراحل المسار الفني للتمكن من ربط البنود الجديدة
  useEffect(() => {
    async function fetchStages() {
      if (!db || !globalUser?.companyId || !isOpen) return;
      // ملاحظة: هنا نحتاج للمسار الفني للمعاملة الحالية
      // للتبسيط، سنجلب كافة مراحل المنشأة أو نعتمد على stages الممررة لو كانت متوفرة
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
    { value: 'increase_quantity', label: isRtl ? 'زيادة كمية' : 'Add Qty', color: 'text-emerald-600' },
    { value: 'decrease_quantity', label: isRtl ? 'نقص كمية' : 'Reduce Qty', color: 'text-rose-600' },
    { value: 'omit_item', label: isRtl ? 'حذف بند' : 'Omit Item', color: 'text-slate-500' },
    { value: 'new_item', label: isRtl ? 'بند مستجد' : 'New Item', color: 'text-blue-600' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
        <div className="bg-slate-900 p-10 text-white text-start flex justify-between items-center">
           <div className="flex items-center gap-6">
              <div className="h-16 w-16 bg-primary/20 rounded-3xl flex items-center justify-center text-primary shadow-2xl ring-4 ring-primary/5">
                 <Calculator className="h-8 w-8" />
              </div>
              <DialogTitle className="text-3xl font-black font-headline">{isRtl ? 'أمر تغييري (VO)' : 'Variation Order'}</DialogTitle>
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
                 <Label className="text-[10px] font-black uppercase text-slate-400">VO Title</Label>
                 <Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 rounded-xl border-2 font-bold" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">Reason</Label>
                 <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full min-h-[120px] rounded-xl border-2 bg-slate-50 p-4 text-xs font-bold" />
              </div>
           </div>

           <div className="lg:col-span-9 space-y-6">
              <div className="flex justify-between items-center">
                 <h4 className="text-lg font-black">{isRtl ? 'جدول التعديلات' : 'Adjustments Grid'}</h4>
                 <Button onClick={addItem} variant="outline" className="rounded-xl font-black gap-2"><PlusCircle className="h-4 w-4" /> {isRtl ? 'إضافة بند' : 'Add Item'}</Button>
              </div>

              <div className="space-y-4">
                 {items.map((item, idx) => (
                    <Card key={idx} className="border-0 shadow-lg rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
                       <CardContent className="p-8 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                             <div className="md:col-span-2 space-y-2 text-start">
                                <Label className="text-[9px] font-black text-slate-400 uppercase">Action</Label>
                                <Select value={item.type} onValueChange={(v: VariationType) => updateItem(idx, 'type', v)}>
                                   <SelectTrigger className="h-11 rounded-xl border-2 font-black text-[11px] bg-slate-50/30"><SelectValue /></SelectTrigger>
                                   <SelectContent className="rounded-xl">{VARIATION_TYPES.map(t => <SelectItem key={t.value} value={t.value} className={cn("font-bold", t.color)}>{t.label}</SelectItem>)}</SelectContent>
                                </Select>
                             </div>

                             <div className="md:col-span-4 space-y-2 text-start">
                                <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'البند المستهدف' : 'Target Item'}</Label>
                                {item.type === 'new_item' ? (
                                   <BOQReferenceSelector onSelect={(node) => updateItem(idx, 'boqReferenceNodeId', node)} className="grid-cols-1 md:grid-cols-1 gap-2" />
                                ) : (
                                   <Select value={item.sourceBoqItemId} onValueChange={v => updateItem(idx, 'sourceBoqItemId', v)}>
                                      <SelectTrigger className="h-11 rounded-xl border-2 font-black text-[11px] bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                      <SelectContent className="rounded-xl max-w-sm">
                                         {boqItems.map(i => <SelectItem key={i.id} value={i.id!} className="font-bold text-[10px] py-4 border-b last:border-0"><div className="flex flex-col"><span>{i.referenceTitle}</span><span className="text-[7px] text-slate-400 uppercase">{i.referenceCode} | Qty: {i.plannedQuantity}</span></div></SelectItem>)}
                                      </SelectContent>
                                   </Select>
                                )}
                             </div>

                             <div className="md:col-span-1 space-y-2 text-start">
                                <Label className="text-[9px] font-black text-slate-400 uppercase">Orig.</Label>
                                <div className="h-11 flex items-center justify-center bg-slate-100 rounded-xl font-black text-slate-500 text-xs">{item.type !== 'new_item' ? (boqItems.find(i => i.id === item.sourceBoqItemId)?.plannedQuantity || 0) : '-'}</div>
                             </div>

                             <div className="md:col-span-1 space-y-2 text-start">
                                <Label className="text-[9px] font-black text-slate-400 uppercase">Delta</Label>
                                <Input type="number" value={Math.abs(item.quantityDelta || 0)} onChange={e => updateItem(idx, 'quantityDelta', Number(e.target.value))} className="h-11 rounded-xl border-2 font-black text-center text-xs" />
                             </div>

                             <div className="md:col-span-3 space-y-2 text-start">
                                <Label className="text-[9px] font-black text-slate-400 uppercase">Price / Result</Label>
                                <div className="flex items-center gap-3">
                                   <Input type="number" step="0.001" value={item.rate} onChange={e => updateItem(idx, 'rate', Number(e.target.value))} className="h-11 rounded-xl border-2 font-black text-emerald-600 text-xs" />
                                   <p className={cn("text-xs font-black min-w-[60px]", (item.total || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>{(item.total || 0).toLocaleString()}</p>
                                </div>
                             </div>

                             <div className="md:col-span-1 flex justify-end">
                                <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-11 text-rose-300 hover:text-rose-600"><Trash2 className="h-5 w-5" /></Button>
                             </div>
                          </div>

                          {item.type === 'new_item' && (
                             <div className="pt-4 border-t border-dashed flex flex-col md:flex-row items-center gap-4 animate-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase">
                                   <Workflow className="h-3.5 w-3.5" /> {isRtl ? 'ربط البند الجديد بمرحلة فنية:' : 'Link New Item to Stage:'}
                                </div>
                                <Select value={item.technicalStageId} onValueChange={v => updateItem(idx, 'technicalStageId', v)}>
                                   <SelectTrigger className="h-9 rounded-lg border-2 font-bold bg-white text-[10px] flex-1"><SelectValue placeholder="..." /></SelectTrigger>
                                   <SelectContent className="rounded-xl border-2 shadow-2xl">
                                      {availableStages.map(s => <SelectItem key={s.id} value={s.technicalStageId || s.id} className="font-bold text-[10px]">{s.name}</SelectItem>)}
                                   </SelectContent>
                                </Select>
                             </div>
                          )}
                       </CardContent>
                    </Card>
                 ))}
              </div>
           </div>
        </div>

        <DialogFooter className="p-10 bg-slate-50 border-t">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 rounded-[1.5rem] border-2 font-black">Cancel</Button>
           <Button onClick={handleSave} disabled={loading || items.length === 0} className="flex-[2] h-16 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl border-b-8 border-orange-700">
              {loading ? <Loader2 className="animate-spin h-7 w-7" /> : <Save className="h-7 w-7 me-2" />}
              {isRtl ? 'حفظ المسودة' : 'Save VO Draft'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
