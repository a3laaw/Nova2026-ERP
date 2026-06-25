'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Save, Plus, Trash2, Loader2, ArrowRight,
  Calculator, AlertTriangle, 
  ChevronRight, LayoutGrid, CheckCircle2,
  Settings2, Boxes, Hammer, Search, 
  FileSearch, FolderTree,
  ChevronDown, DollarSign
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQTemplateItem } from '@/types/templates';
import { ActivityType, Service, SubService } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { transformToBOQTree } from '@/lib/boq-tree-utils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  template: BOQTemplate | null;
  onClose: () => void;
}

export function BOQTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BOQTemplateItem[]>([]);
  const [masterNodes, setMasterNodes] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(!!template);
  const [isMasterPickerOpen, setIsMasterPickerOpen] = useState(false);
  const [masterSearch, setMasterSearch] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<Partial<BOQTemplate>>(
    template || {
      name: '',
      code: '',
      baseAmount: 0,
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      isDefault: false,
      isActive: true
    }
  );

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);

  const service = useMemo(() => db && companyId ? new TemplateService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    if (template?.id && service) {
      service.getBOQTemplateItems(template.id).then(res => {
        setItems(res);
        setTemplateLoading(false);
      });
    }
    if (service) {
      service.getWorkItemsMaster().then(setMasterNodes);
    }
  }, [template, service]);

  const hydratedWorkItemsMaster = useMemo(() => {
    const workItems = masterNodes.filter(n => n.nodeType === 'work_item');
    return workItems.map(item => {
      const component = masterNodes.find(n => n.id === item.parentId);
      const category = component ? masterNodes.find(n => n.id === component.parentId) : null;
      const section = category ? masterNodes.find(n => n.id === category.parentId) : null;
      
      return {
        ...item,
        sectionId: section?.id || 'UNSET',
        sectionName: section?.title || 'Unknown Section',
        mainCategoryId: category?.id || 'UNSET',
        mainCategoryName: category?.title || 'Unknown Category',
        componentId: component?.id || 'UNSET',
        componentName: component?.title || 'Unknown Component',
        name: item.title,
        code: item.code
      };
    });
  }, [masterNodes]);

  const boqTree = useMemo(() => transformToBOQTree(items), [items]);

  const masterTree = useMemo(() => {
    const filtered = hydratedWorkItemsMaster.filter(mi => 
      mi.title?.toLowerCase().includes(masterSearch.toLowerCase()) || 
      mi.code?.toLowerCase().includes(masterSearch.toLowerCase())
    );
    return transformToBOQTree(filtered as any);
  }, [hydratedWorkItemsMaster, masterSearch]);

  const totalItemsCost = useMemo(() => {
    return items.reduce((acc, item) => acc + ((item.plannedQuantity || 0) * (item.estimatedRate || 0)), 0);
  }, [items]);

  const isMathValid = Math.abs(totalItemsCost - (formData.baseAmount || 0)) < 0.001;

  const handleSave = async () => {
    if (!db || !companyId || !user || !service) return;
    
    if (!formData.name) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "يرجى إدخال اسم القالب." : "Name required." });
      return;
    }

    if (!isMathValid) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "مجموع البنود لا يطابق الإجمالي التقديري." : "Balance mismatch." });
      return;
    }

    setLoading(true);
    try {
      const selectedAct = activities?.find(a => a.id === formData.activityTypeId);
      const selectedSrv = services?.find(s => s.id === formData.serviceId);
      const selectedSub = subServices?.find(ss => ss.id === formData.subServiceId);

      const finalData = {
        ...formData,
        activityTypeName: isRtl ? selectedAct?.name : selectedAct?.nameEn,
        serviceName: isRtl ? selectedSrv?.name : selectedSrv?.nameEn,
        subServiceName: isRtl ? selectedSub?.name : selectedSub?.nameEn,
      };

      await service.saveBOQTemplateWithItems(template?.id || null, finalData, items, user.uid);
      toast({ title: t('saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const addFromMaster = (masterItem: any) => {
    const newItem: BOQTemplateItem = {
      workItemMasterId: masterItem.id,
      sectionId: masterItem.sectionId,
      sectionName: masterItem.sectionName,
      mainCategoryId: masterItem.mainCategoryId,
      mainCategoryName: masterItem.mainCategoryName,
      componentId: masterItem.componentId,
      componentName: masterItem.componentName,
      itemCode: masterItem.code,
      name: masterItem.title,
      description: masterItem.title,
      unit: masterItem.unitSymbol || masterItem.unitName || 'pcs',
      unitName: masterItem.unitName,
      unitSymbol: masterItem.unitSymbol,
      unitTypeId: masterItem.unitTypeId,
      plannedQuantity: 1,
      executedQuantity: 0,
      estimatedRate: masterItem.estimatedRate || 0,
      estimatedCostRate: 0,
      materialCodes: [],
      technicalStageId: masterItem.technicalStageId || '',
      billingTriggerGroup: masterItem.billingTriggerGroup || '',
      order: items.length,
      companyId: companyId!
    };
    setItems([...items, newItem]);
    toast({ title: isRtl ? "تمت إضافة البند للمقايسة" : "Item Added to BOQ" });
  };

  const updateItem = (index: number, field: keyof BOQTemplateItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  if (templateLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} className="h-10 w-10 p-0 rounded-xl bg-white shadow-sm border-2 hover:bg-slate-50">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'هندسة المقايسات القالبية' : 'BOQ Template Engineering'}</h1>
             <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 tracking-widest">Master Reference Based Selection</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button onClick={handleSave} disabled={loading} className="h-12 px-10 rounded-xl text-xs gap-2 shadow-lg bg-primary text-white font-black hover:opacity-90 transition-all">
             {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
             {t('save')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
           <div className="bg-slate-50/80 p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Settings2 className="h-5 w-5 text-primary" />
                 <h3 className="text-base font-black font-headline text-slate-800">{isRtl ? 'إعدادات القالب والربط التشغيلي' : 'Template Config'}</h3>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'قالب افتراضي' : 'Default'}</Label>
                 <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} className="scale-90" />
              </div>
           </div>
           <CardContent className="p-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                    <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold bg-slate-50/30" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'كود المرجع' : 'Ref Code'}</Label>
                    <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} className="h-12 rounded-xl border-2 font-mono" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'إجمالي الميزانية المستهدفة (KWD)' : 'Target Budget (KWD)'}</Label>
                    <Input 
                        type="number" 
                        value={formData.baseAmount || 0} 
                        onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                        className="h-12 rounded-xl border-2 font-black text-emerald-600 bg-emerald-50/5 text-center text-xl" 
                    />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 pt-8 border-t border-slate-50">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'نوع النشاط' : 'Activity'}</Label>
                    <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent className="rounded-2xl border-0 shadow-2xl">
                          {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الخدمة الرئيسية' : 'Service'}</Label>
                    <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent className="rounded-2xl border-0 shadow-2xl">
                          {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المسار التشغيلي' : 'Ops Path'}</Label>
                    <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent className="rounded-2xl border-0 shadow-2xl">
                          {subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold text-xs">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
              </div>
           </CardContent>
        </Card>

        <div className="space-y-8 pt-4">
           <div className="flex justify-between items-center px-4">
              <div className="text-start">
                 <h3 className="text-xl font-black font-headline flex items-center gap-3 text-slate-800"><LayoutGrid className="h-6 w-6 text-primary" /> {isRtl ? 'هيكلة بنود المقايسة' : 'BOQ Structure'}</h3>
                 <p className="text-[10px] font-bold text-slate-400 italic">Select items from structural work master dictionary</p>
              </div>
              
              <Dialog open={isMasterPickerOpen} onOpenChange={setIsMasterPickerOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl bg-primary text-white font-black h-14 px-10 gap-3 shadow-xl hover:scale-105 transition-all">
                     <FolderTree className="h-6 w-6" />
                     {isRtl ? 'مستكشف القاموس الهيكلي' : 'Open Master Tree'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl max-w-4xl bg-white" dir={dir}>
                   <div className="bg-primary/5 p-12 text-slate-900 text-start relative overflow-hidden border-b">
                      <div className="absolute top-8 end-8 text-primary opacity-10">
                         <FolderTree className="h-32 w-32" />
                      </div>
                      
                      <div className="relative z-10 space-y-6">
                         <div>
                            <DialogTitle className="text-3xl font-black font-headline">{isRtl ? 'قاموس بنود العمل الهيكلي' : 'Work Item Master Tree'}</DialogTitle>
                            <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">{isRtl ? 'تصفح وأضف البنود مباشرة من قلب الشجرة المرجعية' : 'Browse and add items directly from structural dictionary'}</p>
                         </div>
                         
                         <div className="relative group max-w-md">
                            <div className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                               <Search className="h-5 w-5" />
                            </div>
                            <Input 
                               value={masterSearch}
                               onChange={e => setMasterSearch(e.target.value)}
                               placeholder={isRtl ? "فلترة البنود داخل الشجرة..." : "Filter items inside tree..."} 
                               className="ps-12 h-14 rounded-2xl bg-white border-2 border-slate-100 text-slate-900 font-bold text-lg focus:border-primary transition-all shadow-inner" 
                            />
                         </div>
                      </div>
                   </div>

                   <div className="p-8 max-h-[60vh] overflow-y-auto bg-slate-50/50 scrollbar-hide">
                      {masterTree.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center gap-4 opacity-40">
                           <FileSearch className="h-12 w-12 text-slate-300" />
                           <p className="font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'لا توجد بنود مطابقة' : 'No items found'}</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                           {masterTree.map((section, sIdx) => (
                             <Collapsible 
                               key={section.id} 
                               open={expandedNodes.includes(section.id) || masterSearch.length > 0} 
                               onOpenChange={() => toggleNode(section.id)}
                               className="space-y-2"
                             >
                               <CollapsibleTrigger asChild>
                                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border-2 border-slate-100 shadow-sm cursor-pointer hover:border-primary/30 transition-all group">
                                     <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                        <span className="font-mono font-black text-xs">{sIdx + 1}</span>
                                     </div>
                                     <div className="flex-1 text-start">
                                        <h4 className="font-black text-sm text-slate-800">{section.name}</h4>
                                     </div>
                                     <ChevronDown className={cn("h-4 w-4 text-slate-300 transition-transform", (expandedNodes.includes(section.id) || masterSearch.length > 0) && "rotate-180")} />
                                  </div>
                               </CollapsibleTrigger>
                               <CollapsibleContent className="ms-6 ps-8 border-s-4 border-slate-100 space-y-4 pt-2">
                                  {section.children.map((category, cIdx) => (
                                    <Collapsible 
                                      key={category.id} 
                                      open={expandedNodes.includes(category.id) || masterSearch.length > 0}
                                      onOpenChange={() => toggleNode(category.id)}
                                      className="space-y-2"
                                    >
                                       <CollapsibleTrigger asChild>
                                          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100 cursor-pointer hover:bg-blue-50 transition-all">
                                             <span className="font-mono text-[9px] font-black text-blue-600 bg-white px-2 py-0.5 rounded">{sIdx + 1}.{cIdx + 1}</span>
                                             <span className="flex-1 text-xs font-black text-blue-900 text-start">{category.name}</span>
                                             <ChevronDown className={cn("h-3.5 w-3.5 text-blue-300 transition-transform", (expandedNodes.includes(category.id) || masterSearch.length > 0) && "rotate-180")} />
                                          </div>
                                       </CollapsibleTrigger>
                                       <CollapsibleContent className="ms-4 ps-6 border-s-2 border-blue-50 space-y-3 pt-2">
                                          {category.children.map((comp, cpIdx) => (
                                            <div key={comp.id} className="space-y-2">
                                               <div className="flex items-center gap-2 text-slate-400 text-start px-2">
                                                  <span className="text-[8px] font-black text-slate-400">{sIdx + 1}.{cIdx + 1}.{cpIdx + 1}</span>
                                                  <span className="text-[10px] font-black uppercase tracking-tighter">{comp.name}</span>
                                               </div>
                                               <div className="grid grid-cols-1 gap-2">
                                                  {comp.children.map((item: any, iIdx: number) => (
                                                    <div key={item.id} className="p-4 rounded-xl bg-white border border-slate-100 hover:border-primary/40 hover:shadow-lg transition-all flex items-center justify-between group">
                                                       <div className="text-start">
                                                          <div className="flex items-center gap-2">
                                                             <span className="text-[9px] font-black text-primary font-mono">{sIdx + 1}.{cIdx + 1}.{cpIdx + 1}.{iIdx + 1}</span>
                                                             <p className="text-xs font-black text-slate-800 leading-tight">{item.title}</p>
                                                          </div>
                                                          <div className="flex items-center gap-2 mt-1">
                                                             <Badge variant="outline" className="bg-slate-50 text-[8px] font-mono border-slate-200 px-1.5 py-0">REF: {item.code}</Badge>
                                                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.unitSymbol || item.unitName}</span>
                                                          </div>
                                                       </div>
                                                       <Button 
                                                         size="sm" 
                                                         onClick={() => addFromMaster(item)}
                                                         className="h-9 rounded-xl bg-primary hover:opacity-90 text-white font-black text-xs gap-2 px-5 shadow-lg"
                                                       >
                                                          <Plus className="h-4 w-4" /> {isRtl ? 'إضافة' : 'Add'}
                                                       </Button>
                                                    </div>
                                                  ))}
                                               </div>
                                            </div>
                                          ))}
                                       </CollapsibleContent>
                                    </Collapsible>
                                  ))}
                               </CollapsibleContent>
                             </Collapsible>
                           ))}
                        </div>
                      )}
                   </div>

                   <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row justify-start">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsMasterPickerOpen(false)} 
                        className="h-12 px-10 rounded-xl border-2 border-slate-200 font-black text-sm bg-white"
                      >
                        {isRtl ? 'إغلاق المستكشف' : 'Close Explorer'}
                      </Button>
                   </DialogFooter>
                </DialogContent>
              </Dialog>
           </div>

           <div className="space-y-12">
              {boqTree.length === 0 ? (
                <div className="py-40 text-center bg-white rounded-[3.5rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-8 opacity-30 animate-pulse">
                   <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center shadow-inner"><LayoutGrid className="h-12 w-12 text-slate-200" /></div>
                   <div className="space-y-2">
                      <p className="text-2xl font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المقايسة فارغة حالياً' : 'BOQ Template is Empty'}</p>
                      <p className="text-sm font-bold text-slate-300">Start adding items from the structural explorer</p>
                   </div>
                </div>
              ) : boqTree.map((section, sIdx) => (
                <div key={section.id} className="space-y-6 animate-in slide-in-from-bottom-4">
                   <div className="flex items-center gap-5 bg-slate-50 border-2 border-slate-100 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 group-hover:rotate-0 transition-transform"><LayoutGrid className="h-20 w-20 text-primary" /></div>
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20 font-black text-xl font-mono shadow-inner">{sIdx + 1}</div>
                      <div className="text-start relative z-10">
                         <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">H-SECTION</span>
                         <h4 className="text-2xl font-black font-headline text-slate-800 leading-tight">{section.name}</h4>
                      </div>
                   </div>

                   <div className="ms-8 space-y-10 border-s-4 border-slate-100 ps-10">
                      {section.children.map((category, cIdx) => (
                        <div key={category.id} className="space-y-6">
                           <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border-2 border-slate-50 shadow-sm">
                              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border-2 border-blue-100 font-black text-sm font-mono">{sIdx + 1}.{cIdx + 1}</div>
                              <div className="text-start">
                                 <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Main Category</span>
                                 <h5 className="font-black text-lg text-slate-800 leading-tight">{category.name}</h5>
                              </div>
                           </div>

                           <div className="ms-12 space-y-8 border-s-2 border-blue-50/50 ps-10">
                              {category.children.map((comp, cpIdx) => (
                                <div key={comp.id} className="space-y-4">
                                   <div className="flex items-center gap-3 text-slate-400 text-start px-2">
                                      <span className="text-[10px] font-black font-mono bg-slate-50 px-2 py-0.5 rounded">{sIdx + 1}.{cIdx + 1}.{cpIdx + 1}</span>
                                      <Hammer className="h-4 w-4" />
                                      <span className="text-[11px] font-black uppercase tracking-widest">{comp.name}</span>
                                   </div>

                                   <div className="grid grid-cols-1 gap-4">
                                      {comp.children.map((item: any) => (
                                        <div key={`${item.id}-${item.originalIndex}`} className="p-6 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-xl hover:shadow-2xl hover:border-primary/20 transition-all flex flex-col lg:flex-row gap-8 items-center group">
                                           <div className="flex-1 w-full text-start">
                                              <div className="flex items-center gap-3 mb-2">
                                                 <span className="text-[10px] font-black text-primary font-mono">{sIdx + 1}.{cIdx + 1}.{cpIdx + 1}.{items.findIndex(it => it === items[item.originalIndex]) + 1}</span>
                                                 <Badge variant="outline" className="font-mono text-[9px] border-slate-200 text-slate-400">REF: {item.itemCode}</Badge>
                                              </div>
                                              <p className="text-sm font-black text-slate-800 leading-relaxed">{item.description}</p>
                                           </div>
                                           <div className="grid grid-cols-4 gap-4 w-full lg:w-[480px] bg-slate-50 p-4 rounded-3xl border-2 border-white shadow-inner">
                                              <div className="space-y-1.5">
                                                 <Label className="text-[8px] font-black text-slate-400 uppercase text-center block">Unit</Label>
                                                 <div className="h-10 flex items-center justify-center bg-white rounded-xl text-[11px] font-black text-slate-600 border-2 font-mono shadow-sm">{item.unit}</div>
                                              </div>
                                              <div className="space-y-1.5">
                                                 <Label className="text-[8px] font-black text-slate-400 uppercase text-center block">Planned</Label>
                                                 <Input 
                                                   type="number" 
                                                   value={item.plannedQuantity} 
                                                   onChange={e => updateItem(item.originalIndex, 'plannedQuantity', Number(e.target.value))} 
                                                   className="h-10 border-2 rounded-xl text-center font-black text-sm bg-white" 
                                                 />
                                              </div>
                                              <div className="space-y-1.5">
                                                 <Label className="text-[8px] font-black text-slate-400 uppercase text-center block">Rate</Label>
                                                 <Input 
                                                   type="number" 
                                                   value={item.estimatedRate} 
                                                   onChange={e => updateItem(item.originalIndex, 'estimatedRate', Number(e.target.value))} 
                                                   className="h-10 border-2 rounded-xl text-center font-black text-sm text-emerald-600 bg-white" 
                                                 />
                                              </div>
                                              <div className="flex items-end justify-center pb-1">
                                                 <Button 
                                                   variant="ghost" 
                                                   size="icon" 
                                                   onClick={() => removeItem(item.originalIndex)} 
                                                   className="h-10 w-10 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                 >
                                                    <Trash2 className="h-5 w-5" />
                                                 </Button>
                                              </div>
                                           </div>
                                        </div>
                                      ))}
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className={cn(
          "sticky bottom-8 left-0 right-0 p-8 rounded-[3rem] border-4 border-dashed flex flex-col md:flex-row items-center justify-between shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all duration-700 z-[100]",
          isMathValid ? "bg-emerald-50/95 border-emerald-300" : "bg-rose-50/95 border-rose-300"
        )}>
           <div className="flex items-center gap-10">
              <div className="text-center bg-white p-6 rounded-[2.5rem] shadow-2xl min-w-[220px] border-4 border-white ring-4 ring-black/5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{isRtl ? 'إجمالي المقايسة التجميعي' : 'Aggregated Total'}</p>
                <span className="text-4xl font-black text-slate-900 font-headline">{totalItemsCost.toLocaleString()} <span className="text-sm font-bold opacity-30">KWD</span></span>
              </div>
              <div className="hidden md:block h-16 w-1 bg-slate-200/50 rounded-full" />
              <div className="text-start">
                 <h4 className="font-black text-2xl font-headline flex items-center gap-3 text-slate-800">
                    {isMathValid ? <CheckCircle2 className="h-7 w-7 text-emerald-600" /> : <AlertTriangle className="h-7 w-7 text-rose-600 animate-bounce" />}
                    {isRtl ? 'حالة توازن الميزانية' : 'Budget Balance'}
                 </h4>
                 <p className="text-xs font-bold text-slate-500 leading-relaxed max-w-md mt-1 italic">
                    {isMathValid 
                      ? (isRtl ? 'ممتاز! القالب متوازن تماماً مع الميزانية التقديرية.' : 'Balanced! Aggregated items match target budget.')
                      : (isRtl ? `تنبيه: يوجد تباين بقيمة ${((formData.baseAmount || 0) - totalItemsCost).toFixed(3)} د.ك عن المستهدف.` : `Warning: Variance of ${((formData.baseAmount || 0) - totalItemsCost).toFixed(3)} KWD detected.`)}
                 </p>
              </div>
           </div>
           
           <Button onClick={handleSave} disabled={loading || !isMathValid} className="h-20 px-16 rounded-[2rem] bg-primary text-white font-black text-2xl shadow-3xl hover:scale-105 transition-all gap-5 mt-8 md:mt-0 border-b-8 border-orange-700">
             {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
             {isRtl ? 'اعتماد وهندسة القالب' : 'Final Commit'}
           </Button>
        </div>
      </div>
    </div>
  );
}

