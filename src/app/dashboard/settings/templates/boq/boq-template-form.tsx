
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Save, Plus, Trash2, Loader2, ArrowRight,
  Calculator, AlertTriangle, 
  CheckCircle2,
  GitBranch,
  Search, 
  FolderTree,
  ChevronDown, ChevronRight,
  LayoutGrid,
  Folder,
  Workflow,
  Target,
  RefreshCcw,
  Info
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs, doc } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQTemplateItem, BOQTreeNode } from '@/types/templates';
import { ActivityType, Service, SubService, BOQReferenceNode, TechnicalStage } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { transformToBOQTree } from '@/lib/boq-tree-utils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [pathStages, setPathStages] = useState<TechnicalStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [activeSubs, setActiveSubs] = useState<SubService[]>([]);
  
  const [formData, setFormData] = useState<any>(
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
  const { data: activities } = useCollection<ActivityType>(actQuery);

  const srvQuery = useMemo(() => {
    if (!companyId || !db || !formData.activityTypeId) return null;
    return query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order'));
  }, [db, companyId, formData.activityTypeId]);
  const { data: services, loading: servicesLoading } = useCollection<Service>(srvQuery);

  const masterNodesQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqReferenceNodes(companyId)), orderBy('depth')) : null, [db, companyId]);
  const { data: rawMasterNodes, loading: masterLoading } = useCollection<BOQReferenceNode>(masterNodesQuery);

  useEffect(() => {
    if (db && companyId && formData.activityTypeId && formData.serviceId) {
      getDocs(query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')))
        .then(snap => setActiveSubs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubService))))
        .catch(() => setActiveSubs([]));
    }
  }, [db, companyId, formData.activityTypeId, formData.serviceId]);

  useEffect(() => {
    if (db && companyId && formData.activityTypeId && formData.serviceId && formData.subServiceId) {
      setLoadingStages(true);
      const stagesPath = paths.technicalStages(companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId);
      getDocs(query(collection(db, stagesPath), orderBy('order')))
        .then(snap => setPathStages(snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalStage))))
        .catch(() => setPathStages([]))
        .finally(() => setLoadingStages(false));
    } else {
      setPathStages([]);
    }
  }, [db, companyId, formData.subServiceId, formData.activityTypeId, formData.serviceId]);

  const service = useMemo(() => db && companyId ? new TemplateService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    if (template?.id && service) {
      service.getBOQTemplateItems(template.id).then(res => {
        setItems(res as any);
        setTemplateLoading(false);
      });
    }
  }, [template?.id, service]);

  const boqTree = useMemo(() => transformToBOQTree(items), [items]);

  const totalItemsValue = useMemo(() => {
    return items.reduce((acc, item) => acc + ((item.plannedQuantity || 0) * (item.estimatedRate || 0)), 0);
  }, [items]);

  const isMathValid = Math.abs(totalItemsValue - (formData.baseAmount || 0)) < 0.01;

  const handleSave = async () => {
    if (!db || !companyId || !user || !service) return;
    if (!formData.name) return toast({ variant: "destructive", title: isRtl ? "الاسم مطلوب" : "Name required" });
    if (!formData.subServiceId) return toast({ variant: "destructive", title: isRtl ? "يجب اختيار المسار الفني المباشر للربط" : "Technical Path required" });
    
    setLoading(true);
    try {
      const sanitizedItems = items.map(item => ({
        ...item,
        technicalStageId: item.technicalStageId || '',
        technicalStageIds: item.technicalStageIds || [],
        unitSymbol: item.unitSymbol || ""
      }));
      
      await service.saveBOQTemplateWithItems(template?.id || null, formData as any, sanitizedItems as any, user.uid);
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
       return parent?.title || '---';
    }) || [];

    const normalizedStageIds = node.technicalStageIds || (node.technicalStageId ? [node.technicalStageId] : []);
    const normalizedDefaultStageId = node.technicalStageId || (normalizedStageIds.length > 0 ? normalizedStageIds[0] : '');

    const newItem: BOQTemplateItem = {
      boqReferenceNodeId: node.id!,
      referenceCode: node.code || '',
      referenceTitle: node.title || '',
      referenceDescription: node.description || '', 
      parentId: node.parentId || null,
      ancestorIds: node.ancestorIds || [],
      ancestorTitles,
      depth: node.depth || 0,
      unitTypeId: node.unitTypeId || '',
      unitName: node.unitName || '',
      unitSymbol: node.unitSymbol || '',
      technicalStageId: normalizedDefaultStageId,
      technicalStageIds: normalizedStageIds,
      plannedQuantity: 1,
      executedQuantity: 0,
      estimatedRate: node.estimatedRate || 0,
      estimatedCostRate: 0,
      order: items.length,
      companyId: companyId!
    };

    setItems([...items, newItem]);
    toast({ title: isRtl ? "تمت إضافة البند بنجاح" : "Item added successfully" });
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
          "flex items-center justify-between p-3 rounded-xl border transition-all text-start",
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
                   {node.technicalStageIds?.length > 0 && <Badge className="bg-primary/10 text-primary border-0 text-[7px] font-black h-4">LINKS: {node.technicalStageIds.length}</Badge>}
                </div>
             </div>
          </div>
          {node.isExecutable && (
            <button 
              type="button"
              onClick={() => addFromMaster(node)} 
              disabled={isAdded}
              className={cn("h-7 px-3 rounded-lg text-[9px] font-black gap-1.5 transition-all flex items-center", isAdded ? "bg-slate-100 text-slate-300" : "bg-primary text-white hover:bg-orange-600")}
            >
              {isAdded ? <CheckCircle2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {isAdded ? (isRtl ? 'مضاف' : 'Added') : (isRtl ? 'إضافة' : 'Add')}
            </button>
          )}
        </div>
        {isExpanded && node.children.map((c: any) => renderPickerNode(c))}
      </div>
    );
  };

  const renderBOQTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => {
    return (
      <React.Fragment key={node.id}>
        <TableRow className="bg-slate-50/80 hover:bg-slate-100 border-b-2 border-white group/row">
          <TableCell className="font-mono text-[11px] font-black text-slate-400 ps-6 w-[80px] text-start">{prefix}</TableCell>
          <TableCell className="w-[100px] font-mono text-[10px] font-bold text-slate-400 text-start">---</TableCell>
          <TableCell className="font-black text-slate-900 text-sm py-4 text-start" style={{ paddingInlineStart: `${node.depth * 20 + 16}px` }}>
            <div className="flex items-center gap-2">
              <Folder className="h-3.5 w-3.5 text-orange-400" />
              {node.title}
            </div>
          </TableCell>
          <TableCell colSpan={7}></TableCell>
        </TableRow>

        {node.items.map((item, iIdx) => {
          const originalIdx = items.findIndex(i => i.boqReferenceNodeId === item.boqReferenceNodeId);
          const itemPrefix = `${prefix}.${iIdx + 1}`; 
          const subtotal = (item.plannedQuantity || 0) * (item.estimatedRate || 0);

          const isMultiLinked = item.technicalStageIds && item.technicalStageIds.length > 0;
          const selectableStages = isMultiLinked 
            ? pathStages.filter(s => item.technicalStageIds?.includes(s.id!))
            : pathStages;
          
          return (
            <TableRow key={`${item.boqReferenceNodeId}-${originalIdx}`} className="hover:bg-primary/[0.02] transition-colors border-b-slate-100 group/item">
              <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8 text-start">{itemPrefix}</TableCell>
              <TableCell className="font-mono text-[10px] font-black text-primary/60 text-start">{item.referenceCode}</TableCell>
              <TableCell className="text-xs font-bold text-slate-700 text-start" style={{ paddingInlineStart: `${(node.depth + 1) * 20 + 16}px` }}>
                {item.referenceTitle}
              </TableCell>
              <TableCell className="p-1 min-w-[150px] text-start">
                <Input 
                  value={item.referenceDescription || ''} 
                  onChange={e => updateItem(originalIdx, 'referenceDescription', e.target.value)}
                  className="h-8 rounded-lg text-[10px] border-transparent hover:border-slate-200 bg-transparent focus:bg-white text-start"
                  placeholder={isRtl ? "المواصفة..." : "Spec..."}
                />
              </TableCell>
              <TableCell className="p-1 min-w-[180px] text-start">
                 <div className="space-y-1">
                    <Select 
                      value={item.technicalStageId || 'NONE'} 
                      onValueChange={(v) => {
                        const finalVal = v === 'NONE' ? '' : v;
                        updateItem(originalIdx, 'technicalStageId', finalVal);
                      }}
                    >
                        <SelectTrigger className={cn(
                          "h-8 rounded-lg text-[9px] font-black border-transparent hover:border-primary/30 transition-all text-start",
                          item.technicalStageId ? "bg-primary/5 text-primary" : "bg-slate-50 text-slate-400"
                        )}>
                          <SelectValue placeholder={loadingStages ? "..." : (isRtl ? "اختيار المرحلة المالية" : "Financial Link")} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl">
                          <SelectItem value="NONE" className="font-bold text-[10px] text-slate-400 italic">
                             {isRtl ? '--- بدون تعيين مالي ---' : '--- Unassigned (Technical Only) ---'}
                          </SelectItem>
                          {selectableStages.map(s => (
                            <SelectItem key={s.id} value={s.id!} className="font-bold text-[10px] py-2 border-b last:border-0 border-slate-50">
                                <span className="flex items-center gap-1"><Workflow className="h-2.5 w-2.5 text-primary" /> {s.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                    </Select>
                 </div>
              </TableCell>
              <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || item.unitName || '-'}</TableCell>
              <TableCell className="p-1 w-[80px]">
                <Input 
                  type="number" 
                  value={item.plannedQuantity} 
                  onChange={e => updateItem(originalIdx, 'plannedQuantity', Number(e.target.value))} 
                  className="h-8 rounded-lg text-center font-black text-xs border-2 bg-slate-50/50" 
                />
              </TableCell>
              <TableCell className="p-1 w-[100px]">
                <Input 
                  type="number" 
                  step="0.001"
                  value={item.estimatedRate} 
                  onChange={e => updateItem(originalIdx, 'estimatedRate', Number(e.target.value))} 
                  className="h-8 rounded-lg text-center font-black text-xs text-emerald-600 border-2 bg-slate-50/50" 
                />
              </TableCell>
              <TableCell className="text-end font-mono font-black text-slate-900 text-xs pe-4">
                {subtotal.toLocaleString()}
              </TableCell>
              <TableCell className="w-[50px] text-center">
                <button 
                  type="button"
                  onClick={() => removeItem(originalIdx)} 
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TableCell>
            </TableRow>
          );
        })}

        {node.children.map((child, cIdx) => {
          const childPrefix = `${prefix}.${node.items.length + cIdx + 1}`;
          return renderBOQTreeRows(child, childPrefix);
        })}
      </React.Fragment>
    );
  };

  if (templateLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex flex-col h-full bg-[#fdfaf3]" dir={dir}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/80 backdrop-blur-md px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 border rounded-xl hover:bg-slate-50">
             <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-lg font-black text-slate-900 leading-none">{isRtl ? 'هندسة القوالب الشجرية' : 'BOQ Template Engineering'}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.name || 'Draft Template'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col text-end">
              <span className="text-[9px] font-black text-slate-400 uppercase">Items Status</span>
              <Badge variant="outline" className={cn("h-6 border-2 font-black text-[9px]", isMathValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                 {isMathValid ? 'BALANCED' : 'BUDGET MISMATCH'}
              </Badge>
           </div>
           <Button onClick={handleSave} disabled={loading} className="h-11 px-10 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 gap-2 border-b-4 border-orange-700 hover:scale-[1.02] transition-all">
             {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
             {t('save')}
           </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <aside className="lg:col-span-3 border-e bg-white overflow-y-auto p-6 space-y-8 scrollbar-hide">
           <div className="space-y-6">
              <div className="space-y-4">
                 <div className="space-y-1.5 text-start">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                    <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-11 rounded-xl border-2 font-bold" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400">Code</Label>
                       <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-11 rounded-xl border-2 font-mono font-black text-primary text-xs" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border-2">
                       <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'افتراضي' : 'Default'}</Label>
                       <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                    </div>
                 </div>
              </div>

              <div className={cn(
                "p-6 rounded-[2.5rem] transition-all space-y-4 relative overflow-hidden shadow-2xl ring-1 ring-black/5",
                isMathValid ? "bg-emerald-600 text-white" : "bg-[#1e1b4b] text-white"
              )}>
                 <div className="absolute top-0 right-0 p-6 opacity-10"><Calculator className="h-24 w-24" /></div>
                 <div className="relative z-10 space-y-2 text-start">
                    <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</p>
                    <Input 
                      type="number" 
                      value={formData.baseAmount || 0} 
                      onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                      className="h-12 rounded-2xl border-0 bg-white/20 text-white font-black text-2xl text-center shadow-inner focus:ring-2 focus:ring-white/30"
                    />
                 </div>
                 <div className="relative z-10 pt-4 border-t border-white/10 flex justify-between items-end">
                    <div className="text-start">
                       <p className="text-[8px] font-black uppercase opacity-60">{isRtl ? 'إجمالي البنود الحالية' : 'Current Sum'}</p>
                       <p className="text-xl font-black">{totalItemsValue.toLocaleString()} <span className="text-[10px] opacity-40">KWD</span></p>
                    </div>
                    <div className={cn(
                      "h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform",
                      isMathValid ? "bg-white text-emerald-600 rotate-12" : "bg-orange-50 text-white animate-pulse"
                    )}>
                       {isMathValid ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                    </div>
                 </div>
              </div>

              <div className="space-y-6 pt-6 border-t">
                 <div className="space-y-3 text-start">
                    <Label className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                       <Target className="h-4 w-4" /> {isRtl ? 'المطابقة والربط المباشر' : 'Direct Matching Key'}
                    </Label>
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black text-slate-500 uppercase">{isRtl ? 'النشاط الرئيسي' : 'Activity Type'}</Label>
                          <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                             <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white text-start"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black text-slate-500 uppercase">{isRtl ? 'الخدمة الأساسية' : 'Main Service'}</Label>
                          <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                             <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white text-start">
                                {servicesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="..." />}
                             </SelectTrigger>
                             <SelectContent className="rounded-xl">
                                {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[9px] font-black text-slate-500 uppercase">{isRtl ? 'المسار الفني الدقيق' : 'Specific Technical Path'}</Label>
                          <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => {
                             const sub = activeSubs.find(s => s.id === v);
                             setFormData({...formData, subServiceId: v, subServiceName: sub?.name || ''});
                          }}>
                             <SelectTrigger className="h-10 rounded-xl border-2 font-black bg-white text-start"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                {activeSubs.map(s => <SelectItem key={s.id} value={s.id!} className="font-black text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </aside>

        <main className="lg:col-span-9 overflow-auto bg-white/40 p-6 scrollbar-hide">
           <div className="bg-white rounded-3xl shadow-2xl border border-primary/5 overflow-hidden flex flex-col h-full min-h-[600px]">
              <div className="p-4 bg-slate-50/50 border-b flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                       <LayoutGrid className="h-4 w-4" />
                    </div>
                    <h3 className="font-black text-sm text-slate-700">{isRtl ? 'بنود وجداول الأعمال المعتمدة' : 'BOQ Work Items Grid'}</h3>
                 </div>

                 <div className="flex items-center gap-3">
                    <Dialog open={isPickerOpen} onOpenChange={setIsMasterPickerOpen}>
                        <DialogTrigger asChild>
                          <button type="button" className="h-9 px-5 rounded-xl bg-[#1e1b4b] text-white font-black text-[10px] gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all group flex items-center">
                              <FolderTree className="h-3.5 w-3.5 text-primary group-hover:rotate-12 transition-transform" />
                              {isRtl ? 'مستكشف القاموس السيادي' : 'Registry Explorer'}
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden bg-white border-0 shadow-3xl" dir={dir}>
                          <div className="bg-slate-50 p-10 text-slate-900 text-start border-b">
                              <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                                <GitBranch className="h-8 w-8 text-primary" />
                                {isRtl ? 'القاموس الهندسي الموحد' : 'Sovereign Reference Registry'}
                              </DialogTitle>
                              <div className="relative mt-6">
                                <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-300" />
                                <Input value={masterSearch} onChange={e => setMasterSearch(e.target.value)} placeholder={isRtl ? "ابحث بالاسم أو الكود المرجعي..." : "Search registry..."} className="ps-14 h-14 rounded-2xl border-2 font-black text-lg focus:bg-white shadow-inner" />
                              </div>
                          </div>
                          <div className="p-8 max-h-[50vh] overflow-y-auto scrollbar-hide bg-slate-50/20">
                              {masterLoading ? (
                                <div className="py-20 text-center flex flex-col items-center gap-4">
                                  <Loader2 className="animate-spin h-12 w-12 text-primary/20" />
                                  <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Indexing Registry...</p>
                                </div>
                              ) : pickerTree.map(renderPickerNode)}
                          </div>
                          <DialogFooter className="p-8 bg-slate-50 border-t flex justify-end">
                              <Button variant="outline" type="button" onClick={() => setIsMasterPickerOpen(false)} className="rounded-xl font-black h-12 px-10">إغلاق</Button>
                          </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    
                    {items.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          toast({ title: isRtl ? "جاري تحديث الروابط..." : "Syncing links...", icon: <RefreshCcw className="h-4 w-4 animate-spin" /> });
                          setTimeout(() => toast({ title: isRtl ? "تمت المزامنة" : "Sync complete" }), 800);
                        }}
                        className="h-9 px-4 rounded-xl text-slate-400 hover:text-primary gap-2"
                      >
                         <RefreshCcw className="h-3.5 w-3.5" />
                         {isRtl ? 'مزامنة' : 'Sync'}
                      </Button>
                    )}
                 </div>
              </div>

              <Table>
                <TableHeader className="bg-slate-900 sticky top-0 z-20">
                  <TableRow className="hover:bg-slate-900 border-0">
                    <TableHead className="ps-6 w-[80px] text-white/40 font-mono text-[10px] text-start">S.No</TableHead>
                    <TableHead className="w-[100px] text-white/40 font-mono text-[10px] text-start">Code</TableHead>
                    <TableHead className="text-white font-black text-xs text-start">{isRtl ? 'وصف بند العمل' : 'Work Item Description'}</TableHead>
                    <TableHead className="text-white font-black text-xs text-start">{isRtl ? 'المواصفة الفنية' : 'Technical Specification'}</TableHead>
                    <TableHead className="text-white font-black text-xs text-start">{isRtl ? 'الارتباط المالي' : 'Financial Trigger'}</TableHead>
                    <TableHead className="text-center w-[60px] text-white font-black text-xs">{isRtl ? 'الوحدة' : 'Unit'}</TableHead>
                    <TableHead className="text-center w-[80px] text-white font-black text-xs">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                    <TableHead className="text-center w-[100px] text-white font-black text-xs">{isRtl ? 'الفئة (د.ك)' : 'Rate (KWD)'}</TableHead>
                    <TableHead className="text-end pe-8 w-[120px] text-white font-black text-xs">{isRtl ? 'الإجمالي' : 'Subtotal'}</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-60 text-center opacity-20">
                         <div className="flex flex-col items-center gap-8">
                            <LayoutGrid className="h-24 w-24 text-slate-300" />
                            <p className="text-2xl font-black uppercase tracking-[0.4em] text-slate-400">{isRtl ? 'المقايسة فارغة' : 'Grid is Empty'}</p>
                         </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    boqTree.map((node, idx) => renderBOQTreeRows(node, (idx + 1).toString()))
                  )}
                </TableBody>
              </Table>
           </div>
        </main>
      </div>
    </div>
  );
}
