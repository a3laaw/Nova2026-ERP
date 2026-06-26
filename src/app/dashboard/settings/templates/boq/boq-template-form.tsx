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
  Layers
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
          "flex items-center justify-between p-3 rounded-xl border transition-all group",
          node.isExecutable ? "bg-emerald-50/30 border-emerald-100" : "bg-white border-slate-100"
        )} style={{ marginInlineStart: `${node.depth * 20}px` }}>
          <div className="flex items-center gap-3">
             <div onClick={() => toggleNode(node.id)} className="cursor-pointer text-slate-400 hover:text-primary transition-colors">
                {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />) : <div className="w-4" />}
             </div>
             <div className="text-start">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-50 px-1.5 rounded">#{node.code}</span>
                   <span className="text-xs font-bold text-slate-800">{node.title}</span>
                </div>
             </div>
          </div>
          {node.isExecutable && (
            <Button 
              size="sm" 
              onClick={() => addFromMaster(node)} 
              disabled={isAdded}
              className={cn("h-8 rounded-lg text-[10px] font-black gap-1.5 transition-all shadow-sm", isAdded ? "bg-slate-100 text-slate-300" : "bg-[#FFA000] text-white hover:scale-105")}
            >
              {isAdded ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
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
      <div key={node.id} className="space-y-4 mb-8 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-4 bg-slate-50/80 p-5 rounded-[2rem] border-2 border-slate-100 shadow-sm" style={{ marginInlineStart: `${node.depth * 24}px` }}>
           <div className="h-10 w-10 rounded-2xl bg-white border shadow-sm flex items-center justify-center text-primary font-black text-xs">{node.depth + 1}</div>
           <div>
              <h4 className="font-black text-slate-800 text-lg">{node.title}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{isRtl ? 'قسم هيكلي' : 'Structural Section'}</p>
           </div>
        </div>
        
        <div className="space-y-4">
           {node.items.map((item) => {
             const originalIdx = items.indexOf(item);
             return (
               <div key={`${item.boqReferenceNodeId}-${originalIdx}`} className="p-6 rounded-[2.5rem] bg-white border-2 border-slate-50 shadow-md flex flex-col lg:flex-row gap-8 items-center group hover:ring-4 hover:ring-primary/5 transition-all" style={{ marginInlineStart: `${(node.depth + 1) * 24}px` }}>
                  <div className="flex-1 text-start space-y-2">
                     <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[9px] font-black font-mono border-slate-200 text-slate-400 px-2 py-0.5">REF: {item.referenceCode}</Badge>
                        <h5 className="text-base font-black text-slate-700 leading-tight">{item.referenceTitle}</h5>
                     </div>
                     <p className="text-[10px] text-slate-400 italic line-clamp-1 font-bold">{item.referenceDescription || '...'}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 w-full lg:w-[480px] bg-slate-50/50 p-4 rounded-3xl border-2 border-white shadow-inner">
                     <div className="space-y-1.5 text-center">
                        <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'الوحدة' : 'Unit'}</Label>
                        <div className="h-11 flex items-center justify-center bg-white rounded-xl text-xs font-black border-2 border-slate-100 shadow-sm">{item.unitSymbol || item.unitName || '---'}</div>
                     </div>
                     <div className="space-y-1.5 text-center">
                        <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'الكمية' : 'Planned'}</Label>
                        <Input type="number" value={item.plannedQuantity} onChange={e => updateItem(originalIdx, 'plannedQuantity', Number(e.target.value)} className="h-11 rounded-xl text-center font-black text-base border-2" />
                     </div>
                     <div className="space-y-1.5 text-center">
                        <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'الفئة' : 'Rate'}</Label>
                        <Input type="number" value={item.estimatedRate} onChange={e => updateItem(originalIdx, 'estimatedRate', Number(e.target.value)} className="h-11 rounded-xl text-center font-black text-base text-emerald-600 border-2" />
                     </div>
                     <div className="flex items-end justify-center pb-1">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(originalIdx)} className="h-11 w-11 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all"><Trash2 className="h-5 w-5" /></Button>
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

  if (templateLoading) return <div className="h-[60vh] flex items-center justify-center bg-[#F8F9FA]"><Loader2 className="animate-spin h-10 w-10 text-[#FFA000]" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-32 text-start bg-[#F8F9FA]" dir={dir}>
      
      {/* Header Pipeline Feel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6 sticky top-0 bg-[#F8F9FA]/90 backdrop-blur-md z-[100] px-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 hover:border-primary/20 transition-all">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.2em]">
                <ShieldCheck className="h-3.5 w-3.5" /> {isRtl ? 'مركز هندسة المكتب الفني' : 'Technical Office Engineering'}
             </div>
             <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tighter mt-1">{isRtl ? 'هندسة المقايسات الشجرية' : 'Sovereign BOQ Engineering'}</h1>
          </div>
        </div>
        <Button onClick={handleSave} disabled={loading} className="h-14 px-12 rounded-2xl bg-[#FFA000] text-white font-black text-lg shadow-2xl shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all gap-3 border-b-4 border-orange-700">
           {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
           {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-2">
        
        {/* Sidebar Info - Odoo Style Fields */}
        <div className="lg:col-span-4 space-y-6">
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <CardTitle className="text-lg font-black flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    {isRtl ? 'هوية واختصاص القالب' : 'Template Identity'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                       <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-2xl border-2 font-black text-lg bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="..." />
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'كود مرجع النظام' : 'Registry Code'}</Label>
                       <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-12 rounded-2xl border-2 font-mono font-black text-primary bg-slate-50/30" placeholder="BOQ-REF-001" />
                    </div>
                    <div className="flex items-center justify-between p-5 bg-primary/5 rounded-[2rem] border-2 border-primary/10">
                       <div className="space-y-0.5">
                          <Label className="text-xs font-black text-primary">{isRtl ? 'قالب افتراضي' : 'Mark as Default'}</Label>
                          <p className="text-[9px] font-bold text-slate-400">{isRtl ? 'تفعيل آلي عند بدء نشاط مماثل' : 'Auto-select for this activity'}</p>
                       </div>
                       <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                    </div>
                 </div>

                 {/* Categorization Logic */}
                 <div className="space-y-5 pt-8 border-t-2 border-dashed border-slate-100">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><LayoutGrid className="h-3 w-3" /> {isRtl ? 'النشاط الرئيسي' : 'Activity Type'}</Label>
                       <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                          <SelectTrigger className="h-12 rounded-2xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-2xl border-2 shadow-2xl">
                             {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Zap className="h-3 w-3" /> {isRtl ? 'الخدمة التشغيلية' : 'Service'}</Label>
                       <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                          <SelectTrigger className="h-12 rounded-2xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-2xl border-2 shadow-2xl">
                             {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Layers className="h-3 w-3" /> {isRtl ? 'المسار الفرعي (Pipeline)' : 'Sub-Service'}</Label>
                       <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                          <SelectTrigger className="h-12 rounded-2xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-2xl border-2 shadow-2xl">
                             {subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold text-xs">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <div className="p-8 rounded-[3rem] bg-indigo-900 text-white shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Calculator className="h-32 w-32" /></div>
              <Label className="text-[10px] font-black uppercase text-indigo-300 tracking-[0.2em] relative z-10">{isRtl ? 'الميزانية المستهدفة للقالب' : 'Target Budget (Lumpsum)'}</Label>
              <div className="flex items-center gap-4 relative z-10">
                 <Input 
                   type="number" 
                   value={formData.baseAmount || 0} 
                   onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                   className="h-16 rounded-2xl border-0 bg-white/10 text-white font-black text-3xl text-center focus:ring-2 focus:ring-white/20"
                 />
                 <span className="font-black text-indigo-400 text-xl">KWD</span>
              </div>
           </div>
        </div>

        {/* Main BOQ Structure - Sovereign Tree */}
        <div className="lg:col-span-8 space-y-6">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4 bg-white p-6 rounded-[2.5rem] shadow-lg ring-1 ring-black/5">
              <div className="text-start">
                 <h3 className="text-xl font-black font-headline flex items-center gap-3">
                    <GitBranch className="h-6 w-6 text-[#FFA000]" /> 
                    {isRtl ? 'هيكلة بنود المقايسة' : 'BOQ Itemized Structure'}
                 </h3>
                 <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{isRtl ? 'بناء الهيكل الهندسي من القاموس السيادي' : 'Building structure from sovereign reference'}</p>
              </div>

              <Dialog open={isPickerOpen} onOpenChange={setIsMasterPickerOpen}>
                 <DialogTrigger asChild>
                    <Button className="h-14 px-10 rounded-2xl bg-slate-900 text-white font-black shadow-2xl hover:scale-105 transition-all gap-3 border-b-4 border-slate-700">
                       <FolderTree className="h-6 w-6 text-[#FFA000]" />
                       {isRtl ? 'فتح مستكشف القاموس' : 'Open Reference Explorer'}
                    </Button>
                 </DialogTrigger>
                 <DialogContent className="max-w-4xl rounded-[3rem] p-0 overflow-hidden bg-white border-0 shadow-3xl" dir={dir}>
                    <div className="bg-slate-50 p-10 text-slate-900 text-start border-b">
                       <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                          <GitBranch className="h-8 w-8 text-primary" />
                          {isRtl ? 'مستكشف بنود القاموس السيادي' : 'Sovereign Reference Explorer'}
                       </DialogTitle>
                       <div className="relative mt-6 group">
                          <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input 
                            value={masterSearch} 
                            onChange={e => setMasterSearch(e.target.value)}
                            placeholder={isRtl ? "ابحث بالاسم أو كود البند في كافة المستويات..." : "Search by name or code across all nodes..."} 
                            className="ps-14 h-16 rounded-[1.5rem] border-2 border-slate-100 bg-white font-bold text-lg shadow-inner" 
                          />
                       </div>
                    </div>
                    <div className="p-8 max-h-[60vh] overflow-y-auto bg-slate-50/30 scrollbar-hide">
                       {masterLoading ? (
                         <div className="py-24 text-center flex flex-col items-center gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary/30" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Indexing Sovereign Tree...</p>
                         </div>
                       ) : (
                         <div className="space-y-1">
                            {pickerTree.length === 0 ? (
                               <div className="py-24 text-center opacity-30 flex flex-col items-center gap-4">
                                  <FileSearch className="h-16 w-16 text-slate-300" />
                                  <p className="text-xl font-black text-slate-400 uppercase">{isRtl ? 'لا توجد نتائج مطابقة' : 'No reference nodes found'}</p>
                               </div>
                            ) : pickerTree.map(renderPickerNode)}
                         </div>
                       )}
                    </div>
                    <DialogFooter className="p-8 bg-slate-50 border-t">
                       <Button variant="outline" onClick={() => setIsMasterPickerOpen(false)} className="h-14 rounded-2xl px-12 font-black text-lg bg-white border-2">إغلاق المستكشف</Button>
                    </DialogFooter>
                 </DialogContent>
              </Dialog>
           </div>

           <div className="min-h-[500px] pb-10">
              {items.length === 0 ? (
                <div className="py-48 text-center flex flex-col items-center gap-8 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 opacity-20">
                   <div className="p-8 bg-slate-50 rounded-full ring-8 ring-slate-50/50"><LayoutGrid className="h-24 w-24 text-slate-300" /></div>
                   <p className="text-2xl font-black text-slate-400 uppercase tracking-[0.3em]">{isRtl ? 'المقايسة فارغة حالياً' : 'BOQ Template is Empty'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {boqTree.map(renderBOQTreeNode)}
                </div>
              )}
           </div>
        </div>

        {/* Floating Balance & Commit Bar */}
        <div className={cn(
          "fixed bottom-8 left-8 right-8 md:left-[300px] p-6 rounded-[3rem] border-4 border-dashed flex flex-col md:flex-row items-center justify-between shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all duration-700 z-[200] animate-in slide-in-from-bottom-10",
          isMathValid ? "bg-emerald-50/95 border-emerald-200" : "bg-rose-50/95 border-rose-200"
        )}>
           <div className="flex items-center gap-8">
              <div className="bg-white p-5 rounded-[2rem] shadow-2xl border-2 flex flex-col items-center min-w-[200px]">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-tighter">{isRtl ? 'مجموع بنود المقايسة' : 'Aggregated Total'}</p>
                 <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900">{totalItemsValue.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-300">KWD</span>
                 </div>
              </div>
              <div className="text-start hidden sm:block">
                 <h4 className={cn("font-black text-xl flex items-center gap-3", isMathValid ? "text-emerald-700" : "text-rose-700")}>
                    {isMathValid ? <CheckCircle2 className="h-6 w-6 text-emerald-600 shadow-sm" /> : <AlertTriangle className="h-6 w-6 text-rose-600 animate-bounce" />}
                    {isMathValid ? (isRtl ? 'المقايسة متزنة تماماً' : 'Template Balanced') : (isRtl ? 'المقايسة غير متزنة مالياً' : 'Budget Mismatch Detected')}
                 </h4>
                 <p className="text-xs font-bold text-slate-500/70 mt-1 italic">
                    {isMathValid 
                      ? (isRtl ? 'تمت مطابقة الميزانية المستهدفة مع مجموع البنود.' : 'Items aggregate matches target budget perfectly.') 
                      : (isRtl ? `الفرق: ${((formData.baseAmount || 0) - totalItemsValue).toFixed(3)} دينار كويتي` : `Variance: ${((formData.baseAmount || 0) - totalItemsValue).toFixed(3)} KWD`)}
                 </p>
              </div>
           </div>
           
           <div className="flex items-center gap-4 mt-6 md:mt-0 w-full md:w-auto">
              <Button onClick={handleSave} disabled={loading || !isMathValid} className="flex-1 md:flex-none h-18 px-16 rounded-[2rem] bg-[#FFA000] text-white font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all gap-4 border-b-8 border-orange-700">
                 <Save className="h-8 w-8" /> {isRtl ? 'اعتماد القالب الهندسي' : 'Commit Template'}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
