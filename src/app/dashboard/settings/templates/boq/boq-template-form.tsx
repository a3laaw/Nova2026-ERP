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
  ChevronDown, DollarSign, GitBranch,
  Info, X
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

  // 1. جلب الأنشطة والخدمات للتصنيف
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);

  // 2. جلب كافة العقد من المرجع الموحد boqReferenceNodes
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

  // بناء شجرة المقايسة الحالية للعرض
  const boqTree = useMemo(() => transformToBOQTree(items), [items]);

  // بناء شجرة مستكشف القاموس (Picker Tree)
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

  const isMathValid = Math.abs(totalItemsValue - (formData.baseAmount || 0)) < 0.001;

  const handleSave = async () => {
    if (!db || !companyId || !user || !service) return;
    if (!formData.name) return toast({ variant: "destructive", title: isRtl ? "الاسم مطلوب" : "Name required" });
    if (!isMathValid) return toast({ variant: "destructive", title: isRtl ? "المقايسة غير متزنة مالياً" : "Budget mismatch" });

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

    // استخراج مسميات الأسلاف للعرض السريع (Hierarchy Path)
    const ancestorTitles = node.ancestorIds?.map(id => {
       const parent = rawMasterNodes?.find(m => m.id === id);
       return parent?.title || 'Unknown';
    }) || [];

    const newItem: BOQTemplateItem = {
      boqReferenceNodeId: node.id!,
      referenceCode: node.code,
      referenceTitle: node.title,
      referenceDescription: node.description,
      parentId: node.parentId,
      ancestorIds: node.ancestorIds || [],
      ancestorTitles,
      depth: node.depth,
      unitTypeId: node.unitTypeId,
      unitName: node.unitName,
      unitSymbol: node.unitSymbol,
      technicalStageId: node.technicalStageId,
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
          "flex items-center justify-between p-3 rounded-xl border transition-all group",
          node.isExecutable ? "bg-emerald-50/30 border-emerald-100" : "bg-white border-slate-100"
        )} style={{ marginInlineStart: `${node.depth * 20}px` }}>
          <div className="flex items-center gap-3">
             <div onClick={() => toggleNode(node.id)} className="cursor-pointer text-slate-400">
                {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />) : <div className="w-4" />}
             </div>
             <div className="text-start">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-mono font-black text-slate-400">{node.code}</span>
                   <span className="text-xs font-bold text-slate-800">{node.title}</span>
                </div>
             </div>
          </div>
          {node.isExecutable && (
            <Button 
              size="sm" 
              onClick={() => addFromMaster(node)} 
              disabled={isAdded}
              className={cn("h-8 rounded-lg text-[10px] font-black gap-1.5", isAdded ? "bg-slate-100 text-slate-400" : "bg-primary text-white")}
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
        <div className="flex items-center gap-4 bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl shadow-sm" style={{ marginInlineStart: `${node.depth * 24}px` }}>
           <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">{node.depth + 1}</div>
           <h4 className="font-black text-slate-800">{node.title}</h4>
        </div>
        
        <div className="space-y-3">
           {node.items.map((item) => {
             const originalIdx = items.indexOf(item);
             return (
               <div key={`${item.boqReferenceNodeId}-${originalIdx}`} className="p-4 rounded-2xl bg-white border-2 border-slate-50 shadow-sm flex flex-col lg:flex-row gap-4 items-center" style={{ marginInlineStart: `${(node.depth + 1) * 24}px` }}>
                  <div className="flex-1 text-start">
                     <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[8px] font-mono border-slate-200">REF: {item.referenceCode}</Badge>
                        <h5 className="text-sm font-black text-slate-700">{item.referenceTitle}</h5>
                     </div>
                     <p className="text-[10px] text-slate-400 italic line-clamp-1">{item.referenceDescription}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-3 w-full lg:w-[400px]">
                     <div className="space-y-1 text-center">
                        <Label className="text-[8px] font-black uppercase text-slate-400">Unit</Label>
                        <div className="h-9 flex items-center justify-center bg-slate-50 rounded-lg text-[10px] font-black border-2">{item.unitSymbol || item.unit}</div>
                     </div>
                     <div className="space-y-1 text-center">
                        <Label className="text-[8px] font-black uppercase text-slate-400">Planned</Label>
                        <Input type="number" value={item.plannedQuantity} onChange={e => updateItem(originalIdx, 'plannedQuantity', Number(e.target.value))} className="h-9 rounded-lg text-center font-bold text-xs" />
                     </div>
                     <div className="space-y-1 text-center">
                        <Label className="text-[8px] font-black uppercase text-slate-400">Rate</Label>
                        <Input type="number" value={item.estimatedRate} onChange={e => updateItem(originalIdx, 'estimatedRate', Number(e.target.value))} className="h-9 rounded-lg text-center font-black text-xs text-emerald-600" />
                     </div>
                     <div className="flex items-end justify-center pb-0.5">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(originalIdx)} className="h-9 w-9 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} className="h-10 w-10 p-0 rounded-xl bg-white shadow-sm border-2 hover:bg-slate-50">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'هندسة المقايسات الشجرية' : 'Dynamic BOQ Template Engineering'}</h1>
             <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 tracking-widest">Sovereign Reference Library Connection</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={loading} className="h-12 px-10 rounded-xl bg-primary text-white font-black hover:opacity-90 shadow-xl shadow-primary/20 transition-all gap-2">
           {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
           {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Header Config Card */}
        <Card className="border-0 shadow-lg rounded-[1.5rem] bg-white overflow-hidden ring-1 ring-black/5">
           <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label>
                    <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-11 rounded-xl border-2 font-bold" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'كود المرجع' : 'Ref Code'}</Label>
                    <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-11 rounded-xl border-2 font-mono" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</Label>
                    <Input type="number" value={formData.baseAmount || 0} onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} className="h-11 rounded-xl border-2 font-black text-emerald-600 text-lg text-center" />
                 </div>
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'قالب افتراضي' : 'Default'}</Label>
                    <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                 </div>
              </div>
           </CardContent>
        </Card>

        {/* Dynamic Items Builder */}
        <div className="space-y-6">
           <div className="flex justify-between items-center px-4">
              <div className="text-start">
                 <h3 className="text-lg font-black flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" /> {isRtl ? 'بناء هيكل بنود المقايسة' : 'BOQ Items Structure'}</h3>
                 <p className="text-[10px] font-bold text-slate-400">{isRtl ? 'اختر البنود التنفيذية من القاموس الشجري' : 'Pick executable items from master reference tree'}</p>
              </div>

              <Dialog open={isPickerOpen} onOpenChange={setIsMasterPickerOpen}>
                 <DialogTrigger asChild>
                    <Button className="h-12 px-8 rounded-xl bg-slate-900 text-white font-black shadow-xl gap-2 hover:scale-[1.02] transition-all">
                       <FolderTree className="h-5 w-5 text-primary" />
                       {isRtl ? 'فتح مستكشف القاموس' : 'Open Reference Explorer'}
                    </Button>
                 </DialogTrigger>
                 <DialogContent className="max-w-4xl rounded-[2rem] p-0 overflow-hidden bg-white border-0 shadow-3xl" dir={dir}>
                    <div className="bg-slate-50 p-8 text-slate-900 text-start border-b">
                       <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                          <GitBranch className="h-7 w-7 text-primary" />
                          {isRtl ? 'مستكشف بنود القاموس السيادي' : 'Sovereign Reference Explorer'}
                       </DialogTitle>
                       <div className="relative mt-4 group">
                          <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input 
                            value={masterSearch} 
                            onChange={e => setMasterSearch(e.target.value)}
                            placeholder={isRtl ? "البحث في القاموس..." : "Search master tree..."} 
                            className="ps-12 h-12 rounded-xl border-2 bg-white font-bold" 
                          />
                       </div>
                    </div>
                    <div className="p-8 max-h-[60vh] overflow-y-auto bg-slate-50/50 scrollbar-hide">
                       {masterLoading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                         <div className="space-y-1">
                            {pickerTree.length === 0 ? (
                               <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                                  <FileSearch className="h-12 w-12 text-slate-300" />
                                  <p className="font-black text-slate-400">{isRtl ? 'لا توجد نتائج' : 'No nodes found'}</p>
                               </div>
                            ) : pickerTree.map(renderPickerNode)}
                         </div>
                       )}
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t">
                       <Button variant="outline" onClick={() => setIsMasterPickerOpen(false)} className="rounded-xl h-11 px-8 font-black">إغلاق</Button>
                    </DialogFooter>
                 </DialogContent>
              </Dialog>
           </div>

           {/* BOQ Content (Hierarchical View) */}
           <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5 min-h-[400px]">
              <CardContent className="p-8">
                 {items.length === 0 ? (
                   <div className="py-40 text-center flex flex-col items-center gap-6 opacity-20">
                      <LayoutGrid className="h-20 w-20 text-slate-300" />
                      <p className="text-xl font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المقايسة فارغة' : 'Empty BOQ'}</p>
                   </div>
                 ) : (
                   <div className="space-y-2">
                      {boqTree.map(renderBOQTreeNode)}
                   </div>
                 )}
              </CardContent>
           </Card>
        </div>

        {/* Footer Budget Bar */}
        <div className={cn(
          "sticky bottom-6 p-6 rounded-[2rem] border-4 border-dashed flex flex-col md:flex-row items-center justify-between shadow-2xl backdrop-blur-md transition-all duration-500 z-50",
          isMathValid ? "bg-emerald-50/90 border-emerald-200" : "bg-rose-50/90 border-rose-200"
        )}>
           <div className="flex items-center gap-6">
              <div className="bg-white p-4 rounded-2xl shadow-xl min-w-[180px] border-2">
                 <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي البنود' : 'Total Items'}</p>
                 <p className="text-2xl font-black text-slate-900">{totalItemsValue.toLocaleString()} <span className="text-xs font-bold text-slate-300">KWD</span></p>
              </div>
              <div className="text-start">
                 <h4 className="font-black text-lg flex items-center gap-2">
                    {isMathValid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-rose-600 animate-bounce" />}
                    {isMathValid ? (isRtl ? 'ميزانية متوازنة' : 'Budget Balanced') : (isRtl ? 'ميزانية غير متوازنة' : 'Unbalanced Budget')}
                 </h4>
                 <p className="text-[10px] font-bold text-slate-500 italic">
                    {isMathValid ? (isRtl ? 'مجموع البنود يطابق المستهدف.' : 'Aggregated value matches target.') : (isRtl ? `الفرق: ${((formData.baseAmount || 0) - totalItemsValue).toFixed(3)} د.ك` : `Diff: ${((formData.baseAmount || 0) - totalItemsValue).toFixed(3)} KWD`)}
                 </p>
              </div>
           </div>
           <Button onClick={handleSave} disabled={loading || !isMathValid} className="h-16 px-12 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl hover:scale-105 transition-all gap-3 border-b-8 border-orange-700 mt-4 md:mt-0">
              <Save className="h-6 w-6" /> {isRtl ? 'اعتماد وحفظ القالب' : 'Commit Template'}
           </Button>
        </div>
      </div>
    </div>
  );
}
