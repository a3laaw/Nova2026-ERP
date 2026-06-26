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
  CheckCircle2,
  GitBranch,
  Search, 
  FolderTree,
  ChevronDown, ChevronRight,
  LayoutGrid,
  Target,
  Layers,
  Settings2,
  Folder,
  Hammer
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQTemplateItem, BOQTreeNode } from '@/types/templates';
import { ActivityType, Service, SubService, BOQReferenceNode } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { transformToBOQTree } from '@/lib/boq-tree-utils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

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
  const [templateLoading, setTemplateLoading] = useState(!!template);
  const [isPickerOpen, setIsMasterPickerOpen] = useState(false);
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

  const masterNodesQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqReferenceNodes(companyId)), orderBy('depth')) : null, [db, companyId]);
  const { data: rawMasterNodes, loading: masterLoading } = useCollection<BOQReferenceNode>(masterNodesQuery);

  const service = useMemo(() => db && companyId ? new TemplateService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    if (template?.id && service) {
      service.getBOQTemplateItems(template.id).then(res => {
        setItems(res as any);
        setTemplateLoading(false);
      });
    }
  }, [template, service]);

  const boqTree = useMemo(() => transformToBOQTree(items), [items]);

  const totalItemsValue = useMemo(() => {
    return items.reduce((acc, item) => acc + ((item.plannedQuantity || 0) * (item.estimatedRate || 0)), 0);
  }, [items]);

  const isMathValid = Math.abs(totalItemsValue - (formData.baseAmount || 0)) < 0.01;

  const handleSave = async () => {
    if (!db || !companyId || !user || !service) return;
    if (!formData.name) return toast({ variant: "destructive", title: isRtl ? "الاسم مطلوب" : "Name required" });
    
    setLoading(true);
    try {
      const selectedAct = activities?.find(a => a.id === formData.activityTypeId);
      const selectedSrv = services?.find(s => s.id === formData.serviceId);
      const selectedSub = subServices?.find(ss => ss.id === formData.subServiceId);

      const finalData = {
        ...formData,
        activityTypeName: (isRtl ? selectedAct?.name : selectedAct?.nameEn) || '',
        serviceName: (isRtl ? selectedSrv?.name : selectedSrv?.nameEn) || '',
        subServiceName: (isRtl ? selectedSub?.name : selectedSub?.nameEn) || '',
      };

      await service.saveBOQTemplateWithItems(template?.id || null, finalData as any, items as any, user.uid);
      toast({ title: t('saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const addFromMaster = (node: BOQReferenceNode) => {
    if (items.some(i => i.boqReferenceNodeId === node.id)) {
      toast({ variant: "destructive", title: isRtl ? "البند موجود مسبقاً" : "Item already added" });
      return;
    }

    const ancestorTitles = node.ancestorIds?.map(id => {
       const parent = rawMasterNodes?.find(m => m.id === id);
       return parent?.title || 'Unknown';
    }) || [];

    const newItem: BOQTemplateItem = {
      boqReferenceNodeId: node.id!,
      referenceCode: node.code,
      referenceTitle: node.title,
      referenceDescription: node.description,
      parentId: node.parentId || null,
      ancestorIds: node.ancestorIds || [],
      ancestorTitles,
      depth: node.depth,
      unitTypeId: node.unitTypeId,
      unitName: node.unitName,
      unitSymbol: node.unitSymbol,
      technicalStageId: node.defaultTechnicalStageId,
      billingTriggerGroup: node.billingTriggerGroup,
      allowedItemCategoryIds: node.allowedItemCategoryIds,
      plannedQuantity: 1,
      executedQuantity: 0,
      estimatedRate: node.estimatedRate || 0,
      estimatedCostRate: 0,
      order: items.length,
      companyId: companyId!
    };

    setItems([...items, newItem]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof BOQTemplateItem, val: any) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = val;
    setItems(newItems);
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const pickerTree = useMemo(() => {
    if (!rawMasterNodes) return [];
    const buildTree = (parentId: string | null): any[] => {
      return rawMasterNodes
        .filter(n => (n.parentId || null) === parentId)
        .filter(n => masterSearch ? (n.title.toLowerCase().includes(masterSearch.toLowerCase()) || n.code.toLowerCase().includes(masterSearch.toLowerCase())) : true)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(n => ({ ...n, children: buildTree(n.id!) }));
    };
    return buildTree(null);
  }, [rawMasterNodes, masterSearch]);

  const renderPickerNode = (node: any) => {
    const isExpanded = expandedNodes.includes(node.id);
    const hasChildren = node.children.length > 0;
    const isAdded = items.some(i => i.boqReferenceNodeId === node.id);

    return (
      <div key={node.id} className="space-y-1">
        <div className={cn(
          "flex items-center justify-between p-3 rounded-xl border transition-all",
          node.isExecutable ? "bg-emerald-50/50 border-emerald-100" : "bg-white border-slate-100"
        )} style={{ marginInlineStart: `${node.depth * 20}px` }}>
          <div className="flex items-center gap-3">
             <div onClick={() => toggleNode(node.id)} className="cursor-pointer text-slate-400 hover:text-primary transition-colors">
                {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />) : <div className="w-4" />}
             </div>
             <div className="text-start">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-mono font-black text-slate-400">#{node.code}</span>
                   <span className="text-xs font-bold text-slate-800">{node.title}</span>
                </div>
             </div>
          </div>
          {node.isExecutable && (
            <Button 
              size="sm" 
              onClick={() => addFromMaster(node)} 
              disabled={isAdded}
              className={cn("h-7 rounded-lg text-[9px] font-black gap-1.5 transition-all", isAdded ? "bg-slate-100 text-slate-300" : "bg-primary text-white")}
            >
              {isAdded ? <CheckCircle2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {isAdded ? (isRtl ? 'مضاف' : 'Added') : (isRtl ? 'إضافة' : 'Add')}
            </Button>
          )}
        </div>
        {isExpanded && node.children.map((c: any) => renderPickerNode(c))}
      </div>
    );
  };

  /**
   * دالة العرض الهرمي مع نظام الترقيم التسلسلي (Prefix-based)
   */
  const renderBOQTreeNode = (node: BOQTreeNode, prefix: string) => {
    return (
      <div key={node.id} className="space-y-4 mb-6 animate-in slide-in-from-top-2">
        {/* هيدر القسم مع الترقيم الهرمي */}
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-white shadow-sm" style={{ marginInlineStart: `${node.depth * 24}px` }}>
           <div className="h-9 min-w-[36px] px-2 rounded-xl bg-primary/5 border-2 border-primary/10 flex items-center justify-center text-primary font-black text-[11px] font-mono shadow-inner">
             {prefix}
           </div>
           <div className="h-8 w-8 rounded-lg bg-orange-100/50 flex items-center justify-center text-orange-600">
             <Folder className="h-4 w-4" />
           </div>
           <h4 className="font-black text-slate-800 text-base tracking-tight">{node.title}</h4>
        </div>
        
        {/* البنود والابناء */}
        <div className="space-y-4">
           {node.items.map((item, iIdx) => {
             const originalIdx = items.indexOf(item);
             const itemPrefix = `${prefix}.${iIdx + 1}`;
             
             return (
               <div key={`${item.boqReferenceNodeId}-${originalIdx}`} className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-xl ring-1 ring-black/[0.02] flex flex-col md:flex-row gap-8 items-center group transition-all hover:ring-primary/20" style={{ marginInlineStart: `${(node.depth + 1) * 24}px` }}>
                  <div className="flex-1 text-start flex items-center gap-4">
                     <div className="h-8 min-w-[32px] px-2 rounded-lg bg-slate-50 border flex items-center justify-center text-slate-400 font-black text-[9px] font-mono">
                        {itemPrefix}
                     </div>
                     <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                        <Hammer className="h-5 w-5" />
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="text-[8px] font-mono border-slate-200 text-slate-300 font-bold">#{item.referenceCode}</Badge>
                           <h5 className="text-base font-black text-slate-800 tracking-tight leading-none">{item.referenceTitle}</h5>
                        </div>
                        {item.unitSymbol && <span className="text-[10px] font-bold text-slate-400 mt-1 block uppercase">Unit: {item.unitSymbol}</span>}
                     </div>
                  </div>

                  <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-3xl border-2 border-white shadow-inner">
                     <div className="space-y-1 text-center">
                        <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الكمية' : 'Qty'}</Label>
                        <Input 
                          type="number" 
                          value={item.plannedQuantity} 
                          onChange={e => updateItem(originalIdx, 'plannedQuantity', Number(e.target.value))} 
                          className="h-11 w-24 rounded-xl text-center font-black text-lg border-2 bg-white" 
                        />
                     </div>
                     <div className="space-y-1 text-center border-s-2 border-white ps-6">
                        <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الفئة' : 'Rate'}</Label>
                        <Input 
                          type="number" 
                          step="0.001"
                          value={item.estimatedRate} 
                          onChange={e => updateItem(originalIdx, 'estimatedRate', Number(e.target.value))} 
                          className="h-11 w-24 rounded-xl text-center font-black text-lg text-emerald-600 border-2 bg-white" 
                        />
                     </div>
                     <div className="flex items-center justify-center ps-4">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeItem(originalIdx)} 
                          className="h-10 w-10 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"
                        >
                           <Trash2 className="h-5 w-5" />
                        </Button>
                     </div>
                  </div>
               </div>
             );
           })}

           {/* استدعاء تكراري للأبناء مع تحديث الترقيم */}
           {node.children.map((c, cIdx) => renderBOQTreeNode(c, `${prefix}.${cIdx + 1}`))}
        </div>
      </div>
    );
  };

  if (templateLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      
      {/* Sovereign Header */}
      <div className="flex items-center justify-between border-b-2 border-slate-100 pb-6 sticky top-0 bg-[#F8F9FA]/90 backdrop-blur-md z-[50]">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white border-2 shadow-sm hover:border-primary/20 transition-all">
            <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'هندسة المقايسة الشجرية' : 'BOQ Tree Engineering'}</h1>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{isRtl ? 'تصميم القالب المرجعي السيادي' : 'Master Template Design'}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={loading} className="h-14 px-12 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-3 border-b-8 border-orange-700 hover:scale-[1.02] transition-all">
          {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
          {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 items-start">
        
        {/* Left Control Panel: Identity & Financials */}
        <div className="lg:col-span-1 space-y-8">
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white ring-1 ring-black/5 overflow-hidden sticky top-28">
              <CardHeader className="bg-slate-900 p-8 text-white text-start">
                 <CardTitle className="text-sm font-black flex items-center gap-3 uppercase tracking-widest text-primary">
                    <Settings2 className="h-5 w-5" />
                    {isRtl ? 'إدارة المعايير' : 'Control Center'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                       <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-black text-base bg-slate-50/50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Code</Label>
                          <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-12 rounded-xl border-2 font-mono font-black text-primary" />
                       </div>
                       <div className="flex items-center justify-between p-3 bg-slate-100/50 rounded-2xl border-2">
                          <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'افتراضي' : 'Default'}</Label>
                          <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                       </div>
                    </div>
                 </div>

                 <div className="h-[1px] bg-slate-100" />

                 {/* Integrated Budget Widget */}
                 <div className={cn(
                   "p-8 rounded-[2.5rem] transition-all space-y-6 relative overflow-hidden shadow-xl",
                   isMathValid ? "bg-emerald-600 text-white" : "bg-indigo-900 text-white"
                 )}>
                    <div className="absolute top-0 right-0 p-6 opacity-10"><Calculator className="h-32 w-32" /></div>
                    <div className="relative z-10 space-y-2">
                       <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</p>
                       <div className="flex items-center gap-3">
                          <Input 
                            type="number" 
                            value={formData.baseAmount || 0} 
                            onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                            className="h-14 rounded-2xl border-0 bg-white/20 text-white font-black text-2xl text-center shadow-inner"
                          />
                       </div>
                    </div>
                    <div className="relative z-10 pt-4 border-t border-white/10 flex justify-between items-center">
                       <div className="text-start">
                          <p className="text-[9px] font-black uppercase opacity-60">{isRtl ? 'المجموع الحالي' : 'Items Sum'}</p>
                          <p className="text-2xl font-black">{totalItemsValue.toLocaleString()} <span className="text-xs font-bold opacity-40">KWD</span></p>
                       </div>
                       <div className={cn(
                         "h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:rotate-12",
                         isMathValid ? "bg-white text-emerald-600" : "bg-rose-500 text-white"
                       )}>
                          {isMathValid ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                       </div>
                    </div>
                 </div>

                 <div className="h-[1px] bg-slate-100" />

                 <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Layers className="h-3 w-3" /> {isRtl ? 'نطاق الظهور' : 'Visibility Scope'}
                    </Label>
                    <div className="space-y-3">
                       <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                          <SelectTrigger className="h-11 rounded-xl font-black text-xs bg-slate-50/50 border-2"><SelectValue placeholder="Activity" /></SelectTrigger>
                          <SelectContent className="rounded-2xl">{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                       </Select>
                       <Select value={formData.serviceId} disabled={!formData.activityTypeId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                          <SelectTrigger className="h-11 rounded-xl font-black text-xs bg-slate-50/50 border-2"><SelectValue placeholder="Service" /></SelectTrigger>
                          <SelectContent className="rounded-2xl">{services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                       </Select>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Right Content Area: Hierarchical Tree Builder */}
        <div className="lg:col-span-3 space-y-10">
           <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] shadow-2xl ring-1 ring-black/5">
              <div className="text-start">
                 <h3 className="text-2xl font-black font-headline flex items-center gap-4 text-slate-900">
                    <GitBranch className="h-8 w-8 text-primary" />
                    {isRtl ? 'هيكلة بنود المقايسة' : 'BOQ Structure'}
                 </h3>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-60">Building the Sovereign Tree</p>
              </div>

              <Dialog open={isPickerOpen} onOpenChange={setIsMasterPickerOpen}>
                 <DialogTrigger asChild>
                    <Button className="h-16 px-10 rounded-2xl bg-slate-900 text-white font-black shadow-2xl gap-3 hover:scale-105 transition-all">
                       <FolderTree className="h-6 w-6 text-primary" />
                       {isRtl ? 'مستكشف القاموس' : 'Reference Explorer'}
                    </Button>
                 </DialogTrigger>
                 <DialogContent className="max-w-4xl rounded-[3rem] p-0 overflow-hidden bg-white border-0 shadow-3xl" dir={dir}>
                    <div className="bg-slate-50 p-10 text-slate-900 text-start border-b">
                       <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                          <GitBranch className="h-10 w-10 text-primary" />
                          {isRtl ? 'القاموس الهندسي الموحد' : 'Sovereign Reference'}
                       </DialogTitle>
                       <div className="relative mt-6">
                          <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-300" />
                          <Input value={masterSearch} onChange={e => setMasterSearch(e.target.value)} placeholder={isRtl ? "ابحث بالاسم أو الكود المرجعي..." : "Search..."} className="ps-14 h-16 rounded-3xl border-2 text-lg font-bold" />
                       </div>
                    </div>
                    <div className="p-8 max-h-[60vh] overflow-y-auto scrollbar-hide bg-slate-50/20">
                       {masterLoading ? (
                         <div className="py-24 text-center flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin h-12 w-12 text-primary" />
                            <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Indexing Master Registry...</p>
                         </div>
                       ) : pickerTree.map(renderPickerNode)}
                    </div>
                    <DialogFooter className="p-8 bg-slate-50 border-t flex justify-center">
                       <Button variant="outline" onClick={() => setIsMasterPickerOpen(false)} className="rounded-xl font-black h-12 px-12 border-2">إغلاق المستكشف</Button>
                    </DialogFooter>
                 </DialogContent>
              </Dialog>
           </div>

           {/* The BOQ Tree Rendering with Prefixes */}
           <div className="space-y-10">
              {items.length === 0 ? (
                <div className="py-64 text-center flex flex-col items-center gap-8 opacity-20 border-4 border-dashed border-slate-200 rounded-[4rem] bg-white shadow-inner">
                   <LayoutGrid className="h-32 w-32" />
                   <p className="text-2xl font-black uppercase tracking-[0.3em]">{isRtl ? 'المقايسة فارغة' : 'Empty Template'}</p>
                </div>
              ) : (
                boqTree.map((node, idx) => renderBOQTreeNode(node, (idx + 1).toString()))
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
