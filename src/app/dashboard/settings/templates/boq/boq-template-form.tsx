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
  FileSearch, FolderTree,
  ChevronDown, ChevronRight,
  LayoutGrid,
  Zap,
  ShieldCheck,
  Target,
  Layers,
  X
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
    toast({ title: isRtl ? "تمت الإضافة للمقايسة" : "Added to BOQ" });
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
              className={cn("h-7 rounded-lg text-[9px] font-black gap-1.5 transition-all", isAdded ? "bg-slate-100 text-slate-300" : "bg-[#FFA000] text-white")}
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

  const renderBOQTreeNode = (node: BOQTreeNode) => {
    return (
      <div key={node.id} className="space-y-4 mb-6 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-3 bg-slate-100/50 p-4 rounded-2xl border border-slate-200" style={{ marginInlineStart: `${node.depth * 20}px` }}>
           <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center text-primary font-black text-[10px]">{node.depth + 1}</div>
           <h4 className="font-black text-slate-700 text-sm">{node.title}</h4>
        </div>
        
        <div className="space-y-3">
           {node.items.map((item) => {
             const originalIdx = items.indexOf(item);
             return (
               <div key={`${item.boqReferenceNodeId}-${originalIdx}`} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center" style={{ marginInlineStart: `${(node.depth + 1) * 20}px` }}>
                  <div className="flex-1 text-start">
                     <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[8px] font-mono border-slate-200 text-slate-400">REF: {item.referenceCode}</Badge>
                        <h5 className="text-sm font-black text-slate-800">{item.referenceTitle}</h5>
                     </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 w-full md:w-[400px]">
                     <div className="space-y-1 text-center">
                        <Label className="text-[8px] font-black uppercase text-slate-400">Unit</Label>
                        <div className="h-9 flex items-center justify-center bg-slate-50 rounded-lg text-[10px] font-black border">{item.unitSymbol || '---'}</div>
                     </div>
                     <div className="space-y-1 text-center">
                        <Label className="text-[8px] font-black uppercase text-slate-400">Qty</Label>
                        <Input type="number" value={item.plannedQuantity} onChange={e => updateItem(originalIdx, 'plannedQuantity', Number(e.target.value))} className="h-9 rounded-lg text-center font-black text-xs" />
                     </div>
                     <div className="space-y-1 text-center">
                        <Label className="text-[8px] font-black uppercase text-slate-400">Rate</Label>
                        <Input type="number" value={item.estimatedRate} onChange={e => updateItem(originalIdx, 'estimatedRate', Number(e.target.value))} className="h-9 rounded-lg text-center font-black text-xs text-emerald-600" />
                     </div>
                     <div className="flex items-end justify-center pb-0.5">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(originalIdx)} className="h-8 w-8 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                     </div>
                  </div>
               </div>
             );
           })}
           {node.children.map(renderBOQTreeNode)}
        </div>
      </div>
    );
  };

  if (templateLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      
      {/* Page Action Bar */}
      <div className="flex items-center justify-between border-b pb-6 sticky top-0 bg-[#F8F9FA]/90 backdrop-blur-sm z-[50]">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-10 w-10 p-0 rounded-xl bg-white border shadow-sm">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-2xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'هندسة المقايسة الشجرية' : 'BOQ Tree Engineering'}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRtl ? 'تصميم القالب المرجعي' : 'Design Master Template'}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <Button onClick={handleSave} disabled={loading} className="h-11 px-8 rounded-xl bg-[#FFA000] text-white font-black shadow-lg shadow-orange-500/10 gap-2">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {t('save')}
           </Button>
        </div>
      </div>

      {/* Main Grid: Stacked for better clarity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Metadata & Budget */}
        <div className="lg:col-span-1 space-y-6">
           <Card className="border-0 shadow-xl rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-6">
                 <CardTitle className="text-sm font-black flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    {isRtl ? 'تعريف القالب' : 'Template Identity'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5 text-start">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label>
                    <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-11 rounded-xl border-2 font-bold" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'كود المرجع' : 'Code'}</Label>
                    <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-11 rounded-xl border-2 font-mono font-black text-primary" />
                 </div>
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
                    <div className="space-y-0.5">
                       <Label className="text-xs font-black">{isRtl ? 'قالب افتراضي' : 'Default'}</Label>
                       <p className="text-[9px] text-slate-400 font-bold">Auto-select for activity</p>
                    </div>
                    <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                 </div>
              </CardContent>
           </Card>

           {/* Budget Summary Card - Replaces Floating Bar */}
           <Card className={cn(
             "border-0 shadow-2xl rounded-[2.5rem] overflow-hidden transition-all",
             isMathValid ? "bg-emerald-600 text-white" : "bg-indigo-900 text-white"
           )}>
              <CardContent className="p-8 space-y-6 text-center">
                 <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-60 tracking-widest">{isRtl ? 'الميزانية المستهدفة (Lumpsum)' : 'Target Budget'}</Label>
                    <div className="flex items-center justify-center gap-3">
                       <Input 
                         type="number" 
                         value={formData.baseAmount || 0} 
                         onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                         className="h-14 w-32 rounded-xl border-0 bg-white/10 text-white font-black text-2xl text-center"
                       />
                       <span className="font-black text-xl opacity-40">KWD</span>
                    </div>
                 </div>
                 
                 <div className="h-[1px] bg-white/10 w-full" />

                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase opacity-60">{isRtl ? 'مجموع البنود الحالية' : 'Current Aggregated'}</p>
                    <p className="text-3xl font-black">{totalItemsValue.toLocaleString()} <span className="text-xs opacity-40">KWD</span></p>
                 </div>

                 <div className={cn(
                   "p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase",
                   isMathValid ? "bg-white/20" : "bg-rose-500/50"
                 )}>
                    {isMathValid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {isMathValid ? (isRtl ? 'المقايسة متزنة' : 'Balanced') : (isRtl ? 'فرق في الميزانية' : 'Mismatch')}
                 </div>
              </CardContent>
           </Card>

           <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                 <Layers className="h-3 w-3" /> {isRtl ? 'نطاق ظهور القالب' : 'Template Scope'}
              </Label>
              <div className="space-y-3 bg-white p-6 rounded-[2rem] shadow-sm border ring-1 ring-black/5">
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-slate-400">Activity</Label>
                    <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                       <SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!}>{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-slate-400">Service</Label>
                    <Select value={formData.serviceId} disabled={!formData.activityTypeId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                       <SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Column: BOQ Tree Construction */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-lg ring-1 ring-black/5">
              <div className="text-start">
                 <h3 className="text-lg font-black flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-primary" />
                    {isRtl ? 'هيكلة بنود المقايسة' : 'BOQ Construction'}
                 </h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">{isRtl ? 'بناء الهيكل من القاموس السيادي' : 'Building from registry'}</p>
              </div>

              <Dialog open={isPickerOpen} onOpenChange={setIsMasterPickerOpen}>
                 <DialogTrigger asChild>
                    <Button className="h-12 px-8 rounded-xl bg-slate-900 text-white font-black shadow-xl gap-2 hover:scale-[1.02] transition-all">
                       <FolderTree className="h-5 w-5 text-[#FFA000]" />
                       {isRtl ? 'مستكشف القاموس' : 'Reference Explorer'}
                    </Button>
                 </DialogTrigger>
                 <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden bg-white border-0 shadow-3xl" dir={dir}>
                    <div className="bg-slate-50 p-8 text-slate-900 text-start border-b">
                       <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                          <GitBranch className="h-7 w-7 text-primary" />
                          {isRtl ? 'القاموس الهندسي السيادي' : 'Sovereign Reference'}
                       </DialogTitle>
                       <div className="relative mt-4">
                          <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                          <Input value={masterSearch} onChange={e => setMasterSearch(e.target.value)} placeholder={isRtl ? "ابحث بالاسم أو الكود..." : "Search..."} className="ps-12 h-14 rounded-2xl border-2" />
                       </div>
                    </div>
                    <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-hide bg-slate-50/20">
                       {masterLoading ? (
                         <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>
                       ) : pickerTree.map(renderPickerNode)}
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t">
                       <Button variant="outline" onClick={() => setIsMasterPickerOpen(false)} className="rounded-xl font-bold h-11">إغلاق</Button>
                    </DialogFooter>
                 </DialogContent>
              </Dialog>
           </div>

           <div className="space-y-6">
              {items.length === 0 ? (
                <div className="py-40 text-center flex flex-col items-center gap-6 opacity-20 border-4 border-dashed rounded-[3rem] bg-white">
                   <LayoutGrid className="h-20 w-20" />
                   <p className="text-xl font-black uppercase tracking-[0.2em]">{isRtl ? 'المقايسة فارغة' : 'Empty BOQ'}</p>
                </div>
              ) : (
                boqTree.map(renderBOQTreeNode)
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
