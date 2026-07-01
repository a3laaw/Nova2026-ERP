
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
  PlusCircle, AlertCircle, LayoutGrid,
  TrendingUp, Workflow,
  CheckCircle2, Plus, 
  ArrowRight,
  Settings2,
  Clock,
  Info,
  Sparkles,
  AlertTriangle,
  GitBranch
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore } from '@/firebase';
import { BOQItem, VariationType, BOQVariationItem, VOStageMode } from '@/types/documents';
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

  const fetchStages = async () => {
    if (!db || !globalUser?.companyId) return;
    const stagesPath = paths.transactionStages(globalUser.companyId, transactionId);
    const stagesSnap = await getDocs(query(collection(db, stagesPath), orderBy('order', 'asc')));
    setAvailableStages(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    if (isOpen) {
       fetchStages();
       setItems([]);
       setTitle("");
       setReason("");
    }
  }, [isOpen]);

  const addItem = () => {
    setItems([...items, { 
      type: 'increase_quantity', 
      stageMode: 'existing_stage',
      description: '', 
      quantityDelta: "", 
      rate: "", 
      total: 0,
      localStageName: '',
      insertAfterStageId: '',
      isComplementary: true
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
       item.technicalStageId = node.technicalStageId || '';
    }

    if (field === 'quantityDelta' || field === 'rate' || field === 'type' || field === 'sourceBoqItemId') {
      const type = (field === 'type' ? val : item.type) || 'increase_quantity';
      let q = field === 'quantityDelta' ? (val === "" ? 0 : Math.abs(Number(val))) : Math.abs(Number(item.quantityDelta) || 0);
      const r = field === 'rate' ? (val === "" ? 0 : Number(val)) : (Number(item.rate) || 0);
      const multiplier = (type === 'decrease_quantity' || type === 'omit_item') ? -1 : 1;
      item.total = q * r * multiplier;
      item.quantityDelta = q * multiplier;
    }

    newItems[idx] = item;
    setItems(newItems);
  };

  const netTotal = useMemo(() => items.reduce((acc, i) => acc + (Number(i.total) || 0), 0), [items]);

  const handleSave = async () => {
    if (!db || !globalUser?.companyId || !user) return;
    if (!title.trim()) return toast({ variant: "destructive", title: isRtl ? "عنوان الطلب مطلوب" : "Title required" });
    if (items.length === 0) return toast({ variant: "destructive", title: isRtl ? "إضافة بند واحد على الأقل" : "Add one item" });

    setLoading(true);
    try {
      const service = new VariationService(db, globalUser.companyId, permissions);
      await service.createVariation(boqId, transactionId, boqNumber, { title, reason }, items, user.uid);
      toast({ title: isRtl ? "تم حفظ مسودة الأمر" : "Draft Saved" });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally { setLoading(false); }
  };

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
                 <Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 rounded-xl border-2 font-bold focus:border-primary/50" placeholder="..." />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">Justification</Label>
                 <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full min-h-[150px] rounded-xl border-2 bg-slate-50 p-4 text-xs font-bold focus:bg-white transition-all resize-none shadow-inner" placeholder="..." />
              </div>

              {netTotal > 0 && (
                <div className="p-6 rounded-[2.5rem] bg-orange-50 border-2 border-orange-200 space-y-3 shadow-sm animate-pulse">
                   <div className="flex items-center gap-2 text-[#e87c24]">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Sovereign Warning: Budget Increase</span>
                   </div>
                   <p className="text-[10px] text-orange-800 font-bold leading-relaxed">
                     بناءً على بروتوكول الرقابة المالية، سيؤدي هذا التعديل لزيادة الميزانية المخططة للمشروع. يرجى ضمان وجود موافقة كتابية من العميل.
                   </p>
                </div>
              )}
           </div>

           <div className="lg:col-span-9 space-y-6">
              <div className="flex justify-between items-center px-4">
                 <h4 className="text-lg font-black flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" /> {isRtl ? 'جدول تعديلات النطاق' : 'Scope Adjustments Grid'}</h4>
                 <Button onClick={addItem} variant="outline" className="rounded-xl font-black h-11 border-2 gap-2 shadow-sm"><PlusCircle className="h-4 w-4" /> {isRtl ? 'إضافة تعديل' : 'Add Adjustment'}</Button>
              </div>

              <div className="space-y-4 pb-10">
                 {items.map((item, idx) => {
                    const isNewItem = item.type === 'new_item';
                    const isNewStage = item.stageMode === 'new_local_stage';

                    return (
                      <Card key={idx} className={cn(
                        "border-0 shadow-lg rounded-[2rem] bg-white ring-1 ring-black/5 group hover:ring-2 transition-all overflow-hidden",
                        isNewItem ? "border-s-8 border-s-blue-500" : "border-s-8 border-s-slate-100"
                      )}>
                         <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                               <div className="md:col-span-2 space-y-2 text-start">
                                  <Label className="text-[9px] font-black text-slate-400">Action</Label>
                                  <Select value={item.type} onValueChange={(v: any) => updateItem(idx, 'type', v)}>
                                     <SelectTrigger className="h-11 rounded-xl border-2 font-black text-[11px] bg-slate-50/30"><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                        <SelectItem value="increase_quantity" className="font-bold text-emerald-600">زيادة كمية</SelectItem>
                                        <SelectItem value="decrease_quantity" className="font-bold text-rose-600">نقص كمية</SelectItem>
                                        <SelectItem value="omit_item" className="font-bold text-slate-500">حذف بند</SelectItem>
                                        <SelectItem value="new_item" className="font-bold text-blue-600">بند مستجد</SelectItem>
                                     </SelectContent>
                                  </Select>
                               </div>

                               <div className="md:col-span-4 space-y-2 text-start">
                                  <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'البند المستهدف' : 'Target Item'}</Label>
                                  {isNewItem ? (
                                     <div className="p-1 rounded-xl border-2 bg-slate-50"><BOQReferenceSelector onSelect={(node) => updateItem(idx, 'boqReferenceNodeId', node)} className="grid-cols-1 md:grid-cols-1 gap-2" /></div>
                                  ) : (
                                     <Select value={item.sourceBoqItemId} onValueChange={v => updateItem(idx, 'sourceBoqItemId', v)}>
                                        <SelectTrigger className="h-11 rounded-xl border-2 font-black text-[11px] bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                        <SelectContent>
                                          {boqItems.map(i => (
                                            <SelectItem key={i.id} value={i.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                                              <div className="flex flex-col text-start">
                                                <span className="font-black">{i.referenceTitle}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">#{i.referenceCode}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                     </Select>
                                  )}
                               </div>

                               <div className="md:col-span-1 space-y-2 text-start">
                                  <Label className="text-[9px] font-black text-slate-400 uppercase">Original</Label>
                                  <div className="h-11 flex items-center justify-center bg-slate-100 rounded-xl font-black text-slate-500 text-xs">{isNewItem ? '0' : (item.sourcePlannedQuantity || 0)}</div>
                               </div>

                               <div className="md:col-span-1 space-y-2 text-start">
                                  <Label className="text-[9px] font-black uppercase text-primary">Delta</Label>
                                  <Input type="number" value={item.quantityDelta === "" ? "" : Math.abs(Number(item.quantityDelta) || 0)} onChange={e => updateItem(idx, 'quantityDelta', e.target.value)} className="h-11 rounded-xl border-2 font-black text-center text-xs" />
                               </div>

                               <div className="md:col-span-3 space-y-2 text-start">
                                  <Label className="text-[9px] font-black uppercase text-slate-400">Unit Price & Total</Label>
                                  <div className="flex items-center gap-3">
                                     <Input type="number" step="0.001" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="h-11 rounded-xl border-2 font-black text-emerald-600 text-xs text-center" placeholder="..." />
                                     <div className="text-end min-w-[70px]"><p className={cn("text-xs font-black", (Number(item.total) || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>{(Number(item.total) || 0).toLocaleString()}</p></div>
                                  </div>
                               </div>

                               <div className="md:col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-11 w-11 text-rose-300"><Trash2 className="h-5 w-5" /></Button></div>
                            </div>

                            {/* السطر الذكي المفقود: الوصف الميداني المخصص */}
                            <div className="md:col-span-12 space-y-1.5 text-start pt-2">
                               <Label className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                                  <Pencil className="h-3 w-3" /> {isRtl ? 'الوصف الميداني المخصص (للمهندس في الموقع)' : 'Custom Field Description (for Site Engineer)'}
                               </Label>
                               <Input 
                                 value={item.description} 
                                 onChange={e => updateItem(idx, 'description', e.target.value)}
                                 className="h-11 rounded-xl border-2 border-blue-100 bg-blue-50/20 font-black text-xs text-slate-700 focus:bg-white transition-all shadow-inner"
                                 placeholder={isRtl ? "مثال: تدعيم الجهه الشمالية المقابلة للجار..." : "e.g. North Side Shoring..."}
                               />
                               <p className="text-[9px] text-slate-400 font-bold italic">{isRtl ? 'سيظهر هذا الاسم في تطبيق المهندس وفي سجلات التايم لاين.' : 'This name will appear in the engineer app and timeline logs.'}</p>
                            </div>

                            <div className="pt-6 border-t border-dashed space-y-4">
                               <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                     <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase"><Workflow className="h-3.5 w-3.5" /> {isRtl ? 'طريقة الربط الفني:' : 'Technical Link:'}</div>
                                     <Select value={item.stageMode || 'existing_stage'} onValueChange={(v: VOStageMode) => updateItem(idx, 'stageMode', v)}>
                                        <SelectTrigger className="h-8 rounded-lg border-2 font-black bg-white text-[10px] min-w-[140px] shadow-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                           <SelectItem value="existing_stage" className="font-bold text-[10px]">{isRtl ? 'مرحلة موجودة' : 'Existing Stage'}</SelectItem>
                                           <SelectItem value="new_local_stage" className="font-bold text-[10px] text-blue-600">{isRtl ? 'مرحلة محلية جديدة' : 'New Local Stage'}</SelectItem>
                                        </SelectContent>
                                     </Select>
                                  </div>
                               </div>

                               {isNewStage && (
                                 <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-blue-50/50 rounded-2xl border-2 border-blue-100 animate-in slide-in-from-top-4">
                                    <div className="md:col-span-4 space-y-1.5 text-start">
                                       <Label className="text-[9px] font-black uppercase text-blue-600">New Stage Name</Label>
                                       <Input value={item.localStageName || ''} onChange={e => updateItem(idx, 'localStageName', e.target.value)} className="h-10 rounded-xl border-2 bg-white font-bold text-xs" placeholder={isRtl ? "اسم المرحلة الجديدة..." : "e.g. Extra Works"} />
                                    </div>
                                    <div className="md:col-span-2 space-y-1.5 text-start">
                                       <Label className="text-[9px] font-black uppercase text-blue-600">Code</Label>
                                       <Input value={item.localStageCode || ''} onChange={e => updateItem(idx, 'localStageCode', e.target.value.toUpperCase())} className="h-10 rounded-xl border-2 bg-white font-mono text-xs" placeholder="M-01" />
                                    </div>
                                    <div className="md:col-span-4 space-y-1.5 text-start">
                                       <Label className="text-[9px] font-black uppercase text-blue-600">{isRtl ? 'تحقن بعد مرحلة:' : 'Insert After Stage:'}</Label>
                                       <Select value={item.insertAfterStageId || ''} onValueChange={v => updateItem(idx, 'insertAfterStageId', v)}>
                                          <SelectTrigger className="h-10 rounded-xl border-2 bg-white font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                                          <SelectContent>
                                             {availableStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{s.name}</SelectItem>)}
                                          </SelectContent>
                                       </Select>
                                    </div>
                                    <div className="md:col-span-2 flex flex-col items-center justify-center gap-1.5 border-s border-blue-200 ps-4">
                                       <Label className="text-[8px] font-black text-blue-400 uppercase">{isRtl ? 'مكمل موازٍ' : 'Parallel'}</Label>
                                       <Switch checked={item.isComplementary || false} onCheckedChange={v => updateItem(idx, 'isComplementary', v)} />
                                    </div>
                                 </div>
                               )}
                            </div>
                         </CardContent>
                      </Card>
                    );
                 })}
              </div>
           </div>
        </div>

        <DialogFooter className="p-10 bg-slate-50 border-t flex flex-row gap-4">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 rounded-2xl border-2 font-black text-lg bg-white shadow-sm">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading} className="flex-[2] h-16 rounded-2xl bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 border-b-8 border-orange-700 hover:scale-[1.02] transition-all gap-4"><Save className="h-7 w-7" />{isRtl ? 'حفظ مسودة الأمر التغييري' : 'Save VO Draft'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
