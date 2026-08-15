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
  Plus, ArrowRight,
  Settings2, Sparkles,
  AlertTriangle, GitBranch, Zap
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/select-primitive";
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
  const { lang, dir, t, isRtl } = useLanguage();
  const { user, globalUser } = useAuthContext();
  const { permissions } = usePermissions();
  const db = useFirestore();

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
      quantityDelta: 0, 
      rate: 0,         
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
        item.description = source.referenceTitle || '';
        item.unitName = source.unitName || '';
        item.unitSymbol = source.unitSymbol || '';
        item.rate = source.estimatedRate ?? 0;
        item.sourcePlannedQuantity = source.plannedQuantity || 0;
        item.technicalStageId = source.technicalStageId || '';
      }
    }

    if (field === 'boqReferenceNodeId' && val) {
       const node = val as any;
       item.boqReferenceNodeId = node.id || '';
       item.description = node.title || ''; 
       item.unitName = node.unitName || '';
       item.unitSymbol = node.unitSymbol || '';
       item.rate = node.estimatedRate ?? 0;
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
             const sectionTitle = i.ancestorTitles![idx] || i.referenceCode || t('projects.boqExplorer.sections');
             if (sectionTitle !== 'Section' && sectionTitle !== 'Root' && sectionTitle !== 'Root Section') {
                sections.set(id, sectionTitle);
             }
          });
       }
    });
    return Array.from(sections.entries()).map(([id, title]) => ({ id, title }));
  }, [boqItems, t]);

  const handleSave = async () => {
    if (!db || !globalUser?.companyId || !user) return;
    if (!title.trim()) return toast({ variant: "destructive", title: t('projects.voManager.voTitle') });
    if (items.length === 0) return toast({ variant: "destructive", title: t('projects.voManager.addAdjustment') });

    setLoading(true);
    try {
      const service = new VariationService(db, globalUser.companyId, permissions);
      await service.createVariation(boqId, transactionId, boqNumber, { title, reason }, items, user.uid);
      toast({ title: t('common.saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
        <div className="bg-slate-50 p-6 text-slate-900 text-start flex justify-between items-center relative overflow-hidden shrink-0 border-b">
           <div className="flex items-center gap-4 relative z-10">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm border border-primary/10">
                 <Calculator className="h-6 w-6" />
              </div>
              <div>
                 <DialogTitle className="text-lg font-black font-headline">{t('projects.voManager.title')}</DialogTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BOQ: {boqNumber}</p>
              </div>
           </div>
           <div className="text-end relative z-10">
              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">{t('common.total')}</p>
              <h3 className={cn("text-2xl font-black font-mono", netTotal >= 0 ? "text-emerald-600" : "text-rose-600")}>
                 {netTotal.toLocaleString()} <span className="text-xs opacity-40">KWD</span>
              </h3>
           </div>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-h-[70vh] overflow-y-auto scrollbar-hide text-start bg-white">
           <div className="lg:col-span-3 space-y-6">
              <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('projects.voManager.voTitle')}</Label>
                 <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 rounded-lg border-2 font-bold text-xs" />
              </div>
              <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('projects.voManager.reason')}</Label>
                 <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full min-h-[120px] rounded-lg border-2 bg-slate-50/50 p-3 text-[11px] font-bold resize-none shadow-inner" />
              </div>
           </div>

           <div className="lg:col-span-9 space-y-6">
              <div className="flex justify-between items-center px-1">
                 <h4 className="text-sm font-black flex items-center gap-2 text-slate-800"><LayoutGrid className="h-4 w-4 text-primary" /> {t('projects.boqExplorer.voSummary')}</h4>
                 <Button onClick={addItem} variant="outline" size="sm" className="rounded-lg font-bold h-8 px-4 gap-2 text-[10px] border-2">
                   <Plus className="h-3.5 w-3.5" /> {t('projects.voManager.addAdjustment')}
                 </Button>
              </div>

              <div className="space-y-3 pb-6">
                 {items.map((item, idx) => {
                    const isNewItem = item.type === 'new_item';
                    return (
                      <Card key={idx} className={cn(
                        "border shadow-sm rounded-lg bg-white group hover:border-primary/30 transition-all overflow-hidden",
                        isNewItem ? "border-s-4 border-s-primary" : "border-s-4 border-s-slate-100"
                      )}>
                         <CardContent className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                               <div className="md:col-span-2 space-y-1.5">
                                  <Label className="text-[9px] font-black text-slate-400 uppercase">{t('projects.boqExplorer.action')}</Label>
                                  <Select value={item.type || 'increase_quantity'} onValueChange={(v: any) => updateItem(idx, 'type', v)}>
                                     <SelectTrigger className="h-8 rounded-md border-2 font-black text-[9px]"><SelectValue /></SelectTrigger>
                                     <SelectContent className="max-h-[300px] overflow-y-auto rounded-lg">
                                        <SelectItem value="increase_quantity" className="font-bold text-emerald-600 text-xs">{t('projects.voManager.increase')}</SelectItem>
                                        <SelectItem value="decrease_quantity" className="font-bold text-rose-600 text-xs">{t('projects.voManager.decrease')}</SelectItem>
                                        <SelectItem value="omit_item" className="font-bold text-slate-500 text-xs">{t('projects.voManager.omit')}</SelectItem>
                                        <SelectItem value="new_item" className="font-bold text-primary text-xs">{t('projects.voManager.newItem')}</SelectItem>
                                     </SelectContent>
                                  </Select>
                               </div>

                               <div className="md:col-span-4 space-y-1.5">
                                  <Label className="text-[9px] font-black uppercase text-slate-400">{t('projects.voManager.targetItem')}</Label>
                                  {isNewItem ? (
                                     <div className="p-1 rounded-md border-2 bg-slate-50">
                                       <BOQReferenceSelector onSelect={(node) => updateItem(idx, 'boqReferenceNodeId', node)} className="grid-cols-1 gap-2" />
                                     </div>
                                  ) : (
                                     <Select value={item.sourceBoqItemId || ''} onValueChange={v => updateItem(idx, 'sourceBoqItemId', v)}>
                                        <SelectTrigger className="h-8 rounded-md border-2 font-bold text-[9px] bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                        <SelectContent className="max-h-[300px] overflow-y-auto rounded-lg z-[160]">
                                          {boqItems.map(i => (
                                            <SelectItem key={i.id} value={i.id!} className="font-bold text-[10px] py-2 border-b last:border-0 border-slate-50">
                                              <div className="flex flex-col text-start">
                                                <span className="font-bold text-slate-800">{i.referenceTitle}</span>
                                                <span className="text-[8px] text-slate-400 font-mono">#{i.referenceCode}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                     </Select>
                                  )}
                               </div>

                               <div className="md:col-span-2 space-y-1.5">
                                  <Label className="text-[9px] font-black uppercase text-primary">{t('projects.voManager.deltaQty')}</Label>
                                  <Input type="number" value={item.quantityDelta || 0} onChange={e => updateItem(idx, 'quantityDelta', e.target.value)} className="h-8 rounded-md border-2 font-black text-center text-xs" />
                               </div>

                               <div className="md:col-span-3 space-y-1.5">
                                  <Label className="text-[9px] font-black text-slate-400">{t('projects.boqExplorer.rate')}</Label>
                                  <div className="flex items-center gap-2">
                                     <Input type="number" step="0.001" value={item.rate || 0} onChange={e => updateItem(idx, 'rate', e.target.value)} className="h-8 rounded-md border-2 font-black text-emerald-600 text-xs text-center" />
                                     <div className="text-end min-w-[60px]"><p className={cn("text-[10px] font-black", (Number(item.total) || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>{(Number(item.total) || 0).toLocaleString()}</p></div>
                                  </div>
                               </div>

                               <div className="md:col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-8 w-8 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button></div>
                            </div>

                            {isNewItem && (
                              <div className="pt-4 border-t border-dashed space-y-4 animate-in slide-in-from-top-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center text-start">
                                   <div className="space-y-1.5">
                                      <Label className="text-[9px] font-black uppercase text-primary tracking-widest">{t('projects.voManager.financialSection')}:</Label>
                                      <Select value={item.targetSectionId || ''} onValueChange={v => updateItem(idx, 'targetSectionId', v)}>
                                         <SelectTrigger className="h-8 rounded-md border-2 font-black text-[10px] bg-primary/5 border-primary/10"><SelectValue placeholder="..." /></SelectTrigger>
                                         <SelectContent className="max-h-[300px] overflow-y-auto rounded-lg">
                                            {boqSections.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-xs">{s.title}</SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                   </div>
                                   <div className="space-y-1.5">
                                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('projects.voManager.executionPath')}:</Label>
                                      <Select value={item.stageMode || 'existing_stage'} onValueChange={(v: VOStageMode) => updateItem(idx, 'stageMode', v)}>
                                         <SelectTrigger className="h-8 rounded-md border-2 font-bold text-[9px]"><SelectValue /></SelectTrigger>
                                         <SelectContent className="max-h-[300px] overflow-y-auto rounded-lg">
                                            <SelectItem value="existing_stage" className="font-bold text-xs">{t('projects.voManager.linkExisting')}</SelectItem>
                                            <SelectItem value="new_local_stage" className="font-bold text-primary text-xs">{t('projects.voManager.injectNew')}</SelectItem>
                                         </SelectContent>
                                      </Select>
                                   </div>
                                </div>

                                {item.stageMode === 'existing_stage' && (
                                   <div className="space-y-1.5 animate-in fade-in duration-300 text-start">
                                      <Label className="text-[9px] font-black uppercase text-secondary flex items-center gap-2">
                                         <Workflow className="h-3 w-3" /> {t('projects.voManager.linkExisting')}
                                      </Label>
                                      <Select value={item.technicalStageId || ''} onValueChange={v => updateItem(idx, 'technicalStageId', v)}>
                                         <SelectTrigger className="h-8 rounded-md border-2 font-bold bg-secondary/5 border-secondary/20"><SelectValue placeholder="..." /></SelectTrigger>
                                         <SelectContent className="max-h-[300px] overflow-y-auto rounded-lg z-[160]">
                                            {availableStages.map(s => (
                                               <SelectItem key={s.id} value={s.technicalStageId} className="font-bold text-[10px] py-1.5">
                                                  <span className="flex items-center gap-2">
                                                     <Badge variant="outline" className="h-4 px-1 text-[7px] font-black">#{s.order + 1}</Badge>
                                                     {s.name}
                                                  </span>
                                               </SelectItem>
                                            ))}
                                         </SelectContent>
                                      </Select>
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

        <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 shrink-0">
           <Button variant="outline" onClick={onClose} className="flex-1 h-10 rounded-lg border-2 font-bold text-xs bg-white">{t('common.cancel')}</Button>
           <Button onClick={handleSave} disabled={loading} className="flex-[2] h-10 rounded-lg bg-primary text-white font-black text-xs gap-3 shadow-lg border-b-4 border-orange-700 active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {t('projects.voManager.confirmVO')}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
