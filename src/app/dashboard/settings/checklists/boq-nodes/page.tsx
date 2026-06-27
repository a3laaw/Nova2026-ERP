'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  GitBranch, Plus, Loader2, Search, 
  Trash2, Edit3, ShieldCheck, Folder,
  Hammer, ChevronRight, ChevronDown,
  Save, Settings2,
  Workflow, RotateCcw, Package
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, collectionGroup, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQReferenceService } from '@/services/boq-reference-service';
import { TechnicalPathService } from '@/services/technical-path-service';
import { BOQReferenceNode, UnitType, TechnicalStage, ActivityType, Service, ItemCategory } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { resolveNodeEffectiveServices } from '@/lib/boq-tree-utils';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

export default function BOQNodesPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check, permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<Partial<BOQReferenceNode> | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [allStages, setAllStages] = useState<TechnicalStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  const canEdit = check('ref', 'edit').can;
  const canCreate = check('ref', 'create').can;
  const canDelete = check('ref', 'delete').can;

  const nodesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqReferenceNodes(companyId))) : null, 
  [db, companyId]);

  const unitTypesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.unitTypes(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const activitiesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const itemCatsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.itemCategories(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: rawNodes, loading } = useCollection<BOQReferenceNode>(nodesQuery);
  const { data: unitTypes } = useCollection<UnitType>(unitTypesQuery);
  const { data: activities } = useCollection<ActivityType>(activitiesQuery);
  const { data: itemCategories } = useCollection<ItemCategory>(itemCatsQuery);

  const servicesQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(collectionGroup(db, 'services'), where('companyId', '==', companyId));
  }, [db, companyId]);
  const { data: rawAllServices } = useCollection<Service>(servicesQuery);
  
  const allServices = useMemo(() => {
    return [...(rawAllServices || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawAllServices]);

  const service = useMemo(() => 
    db && companyId ? new BOQReferenceService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  // جلب المراحل الفنية مرة واحدة عند الحاجة فقط (عند فتح المودال)
  useEffect(() => {
    if (db && companyId && editingNode) {
      setLoadingStages(true);
      const tpService = new TechnicalPathService(db, companyId);
      tpService.getAllCompanyStages()
        .then(setAllStages)
        .finally(() => setLoadingStages(false));
    }
  }, [db, companyId, !!editingNode]);

  const treeData = useMemo(() => {
    const nodes = rawNodes || [];
    const buildTree = (parentId: string | null): any[] => {
      return nodes
        .filter(n => (n.parentId || null) === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(n => ({
          ...n,
          children: buildTree(n.id!)
        }));
    };
    return buildTree(null);
  }, [rawNodes]);

  const handleSave = async () => {
    if (!service || !user || !editingNode?.title) return;
    
    setLoadingAction('save');
    try {
      if (editingNode.id) {
        await service.updateBOQReferenceNode(editingNode.id, editingNode, user.uid);
      } else {
        await service.createBOQReferenceNode(editingNode, user.uid);
      }
      toast({ title: t('saved') });
      setEditingNode(null);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFinalDelete = async () => {
    if (!service || !deletingId) return;
    setLoadingAction(`delete_${deletingId}`);
    try {
      await service.deleteBOQReferenceNode(deletingId);
      toast({ title: t('deleted') });
      setDeletingId(null);
    } finally {
      setLoadingAction(null);
    }
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const toggleMultiSelect = (fieldId: 'allowedActivityTypeIds' | 'allowedServiceIds' | 'allowedItemCategoryIds', fieldName: 'allowedActivityTypeNames' | 'allowedServiceNames', id: string, name: string) => {
    if (!editingNode) return;
    const currentIds = (editingNode as any)[fieldId] || [];
    const currentNames = (editingNode as any)[fieldName] || [];
    
    let newIds, newNames;
    if (currentIds.includes(id)) {
      newIds = currentIds.filter((x: string) => x !== id);
      newNames = currentNames.filter((x: string) => x !== name);
    } else {
      newIds = [...currentIds, id];
      newNames = [...currentNames, name];
    }
    
    setEditingNode({ ...editingNode, [fieldId]: newIds, [fieldName]: newNames });
  };

  const renderNode = (node: any, pathPrefix: string) => {
    const isExpanded = expandedNodes.includes(node.id);
    const hasChildren = node.childrenCount > 0;
    const isExecutable = node.isExecutable;
    
    // حل الخدمات الفعالة للعرض
    const effectiveServices = resolveNodeEffectiveServices(node.id, rawNodes || []);

    return (
      <div key={node.id} className="space-y-1">
        <div 
          className={cn(
            "flex items-center justify-between p-3 rounded-xl border transition-all group",
            node.depth === 0 ? "bg-white border-slate-200 shadow-sm" : "bg-slate-50/30 border-transparent hover:bg-slate-100/50"
          )}
          style={{ marginInlineStart: `${node.depth * 20}px` }}
        >
          <div className="flex items-center gap-3">
             <div onClick={() => toggleNode(node.id)} className="cursor-pointer text-slate-400 hover:text-primary transition-colors">
                {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />) : <div className="w-4" />}
             </div>
             <div className={cn(
               "h-8 w-8 rounded-lg flex items-center justify-center shadow-sm",
               isExecutable ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-primary/5 text-primary border border-primary/10"
             )}>
                {isExecutable ? <Hammer className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
             </div>
             <div className="text-start">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black font-mono text-slate-400 bg-slate-100 px-1.5 rounded">{pathPrefix}</span>
                   <span className="text-xs font-bold text-slate-800">{node.title}</span>
                   {isExecutable && <Badge className="bg-emerald-100 text-emerald-700 text-[7px] font-black h-4 px-1.5 border-0">ITEM</Badge>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                   {isExecutable && node.unitSymbol && (
                     <span className="text-[8px] text-slate-400 font-bold uppercase">{node.unitName} ({node.unitSymbol})</span>
                   )}
                   
                   {effectiveServices.serviceIds.length > 0 && (
                     <div className="flex items-center gap-1">
                        {effectiveServices.isInherited && <RotateCcw className="h-2.5 w-2.5 text-slate-300" />}
                        {effectiveServices.serviceNames.map((name: string, i: number) => (
                           <Badge key={i} variant="secondary" className={cn("h-3 px-1 text-[7px] font-black uppercase border-0", effectiveServices.isInherited ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-600")}>
                             {name}
                           </Badge>
                        ))}
                     </div>
                   )}
                </div>
             </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
             {canCreate && !isExecutable && (
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-8 w-8 text-primary"
                 onClick={() => setEditingNode({ 
                    parentId: node.id, 
                    nodeRole: 'group', 
                    isActive: true, 
                    isExecutable: false,
                    inheritServices: true,
                    order: node.childrenCount 
                 })}
               >
                 <Plus className="h-4 w-4" />
               </Button>
             )}
             {canEdit && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => setEditingNode(node)}><Edit3 className="h-4 w-4" /></Button>
             )}
             {canDelete && (
                <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-8 w-8 text-rose-500" 
                   disabled={node.childrenCount > 0}
                   onClick={() => setDeletingId(node.id!)}
                >
                   <Trash2 className="h-4 w-4" />
                </Button>
             )}
          </div>
        </div>
        {isExpanded && node.children.map((child: any, idx: number) => renderNode(child, `${pathPrefix}.${idx + 1}`))}
      </div>
    );
  };

  return (
    <div className="space-y-6 text-start animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <GitBranch className="h-7 w-7 text-primary" />
            {isRtl ? 'شجرة بنود الأعمال المرجعية' : 'Sovereign BOQ Tree'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Master WBS Reference Management</p>
        </div>
        {canCreate && (
           <Button 
             onClick={() => setEditingNode({ parentId: null, nodeRole: 'group', isActive: true, isExecutable: false, inheritServices: false, order: treeData.length, allowedActivityTypeIds: [], allowedActivityTypeNames: [], allowedServiceIds: [], allowedServiceNames: [] })}
             className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2"
           >
             <Plus className="h-5 w-5" /> {isRtl ? 'إضافة قسم رئيسي' : 'Add Root Node'}
           </Button>
        )}
      </div>

      <Card className="border-0 shadow-2xl rounded-[1.5rem] bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
               <Input 
                 placeholder={t('search')} 
                 className="ps-11 h-11 rounded-xl border-slate-200 bg-white font-bold" 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
         </CardHeader>
         <CardContent className="p-6 space-y-2 max-h-[70vh] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="py-24 text-center flex flex-col items-center gap-4">
                 <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                 <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Indexing Dynamic Tree...</p>
              </div>
            ) : treeData.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center gap-6 opacity-30">
                 <GitBranch className="h-20 w-20 text-slate-200" />
                 <p className="text-xl font-black text-slate-400">{isRtl ? 'القاموس فارغ حالياً' : 'BOQ Registry is Empty'}</p>
              </div>
            ) : (
              treeData.map((node, i) => renderNode(node, (i + 1).toString()))
            )}
         </CardContent>
      </Card>

      <Dialog open={!!editingNode} onOpenChange={open => !open && setEditingNode(null)}>
         <DialogContent className="rounded-xl p-0 overflow-hidden max-w-3xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 text-start border-b">
               <DialogTitle className="text-xl font-black font-headline flex items-center gap-3">
                  <Settings2 className="h-6 w-6 text-primary" />
                  {editingNode?.id ? (isRtl ? 'تعديل بيانات العقدة المرجعية' : 'Edit Reference Node') : (isRtl ? 'إضافة فرع جديد للهيكل' : 'Add New Node')}
               </DialogTitle>
            </div>

            <div className="p-8 space-y-6 text-start bg-white max-h-[70vh] overflow-y-auto scrollbar-hide">
               
               <div className="p-5 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                     <Label className="font-black text-xs text-slate-700">{isRtl ? 'وراثة الخدمات من الأب' : 'Inherit Services from Parent'}</Label>
                     <p className="text-[9px] text-slate-400 font-bold leading-tight">{isRtl ? 'عند التفعيل، سيرث هذا القسم والبنود التابعة له ربط الخدمات من أقرب أب معرف.' : 'Propagation of services from nearest defined ancestor.'}</p>
                  </div>
                  <Switch 
                     checked={editingNode?.inheritServices !== false} 
                     onCheckedChange={v => setEditingNode({...editingNode!, inheritServices: v})} 
                  />
               </div>

               {(!editingNode?.inheritServices || editingNode?.parentId === null) && (
                 <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="p-5 rounded-2xl bg-blue-50/50 border-2 border-blue-100 space-y-4">
                       <h4 className="font-black text-[10px] text-blue-600 uppercase tracking-widest flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5" /> {isRtl ? 'الأنشطة المتاح بها هذا القسم' : 'Allowed Activities'}
                       </h4>
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {activities?.map(act => (
                            <div 
                              key={act.id} 
                              onClick={() => toggleMultiSelect('allowedActivityTypeIds', 'allowedActivityTypeNames', act.id!, isRtl ? act.name : (act.nameEn || act.name))}
                              className={cn(
                                "p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-2 group",
                                editingNode?.allowedActivityTypeIds?.includes(act.id!) 
                                  ? "bg-white border-blue-500 shadow-md" 
                                  : "bg-transparent border-slate-100 hover:border-blue-200"
                              )}
                            >
                               <Checkbox checked={editingNode?.allowedActivityTypeIds?.includes(act.id!) || false} className="h-4 w-4 pointer-events-none" />
                               <span className={cn("text-[10px] font-black uppercase truncate", editingNode?.allowedActivityTypeIds?.includes(act.id!) ? "text-blue-600" : "text-slate-400")}>{isRtl ? act.name : (act.nameEn || act.name)}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-indigo-50/50 border-2 border-indigo-100 space-y-4">
                       <h4 className="font-black text-[10px] text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                          <Workflow className="h-3.5 w-3.5" /> {isRtl ? 'الخدمات التشغيلية المرتبطة' : 'Allowed Services'}
                       </h4>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {allServices?.map(srv => (
                            <div 
                              key={srv.id} 
                              onClick={() => toggleMultiSelect('allowedServiceIds', 'allowedServiceNames', srv.id!, isRtl ? srv.name : (srv.nameEn || srv.name))}
                              className={cn(
                                "p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-2 group",
                                editingNode?.allowedServiceIds?.includes(srv.id!) 
                                  ? "bg-white border-indigo-500 shadow-md" 
                                  : "bg-transparent border-slate-100 hover:border-indigo-200"
                              )}
                            >
                               <Checkbox checked={editingNode?.allowedServiceIds?.includes(srv.id!) || false} className="h-4 w-4 pointer-events-none" />
                               <span className={cn("text-[10px] font-black uppercase truncate", editingNode?.allowedServiceIds?.includes(srv.id!) ? "text-indigo-600" : "text-slate-400")}>{srv.name}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('code')}</Label>
                    <Input 
                      value={editingNode?.code || ''} 
                      onChange={e => setEditingNode({...editingNode!, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} 
                      className="h-11 rounded-xl border-2 font-mono font-black text-primary" 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ترتيب الظهور' : 'Display Order'}</Label>
                    <Input 
                      type="number" 
                      value={editingNode?.order || 0} 
                      onChange={e => setEditingNode({...editingNode!, order: Number(e.target.value)})} 
                      className="h-11 rounded-xl border-2 font-bold" 
                    />
                 </div>
               </div>

               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المسمى الهندسي' : 'Node Title'}</Label>
                  <Input 
                    value={editingNode?.title || ''} 
                    onChange={e => setEditingNode({...editingNode!, title: e.target.value})} 
                    className="h-12 rounded-xl border-2 font-black text-base bg-slate-50/30 focus:bg-white transition-all" 
                  />
               </div>

               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'وصف المواصفات الفنية المرجعية' : 'Master Specifications Description'}</Label>
                  <Textarea 
                    value={editingNode?.description || ''} 
                    onChange={e => setEditingNode({...editingNode!, description: e.target.value})} 
                    className="min-h-[100px] rounded-xl border-2 p-4 text-xs font-bold leading-relaxed resize-none bg-slate-50/50 focus:bg-white transition-all" 
                    placeholder={isRtl ? "اكتب هنا المواصفة القياسية لهذا البند..." : "Enter standard specifications..."}
                  />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border-2 border-white shadow-inner">
                  <div className="space-y-2">
                     <div className="flex items-center justify-between">
                        <Label className="font-black text-xs text-slate-700">{isRtl ? 'عقدة تنفيذية (Work Item)' : 'Executable Node'}</Label>
                        <Switch 
                          checked={editingNode?.isExecutable || false} 
                          onCheckedChange={v => setEditingNode({...editingNode!, isExecutable: v, nodeRole: v ? 'work_item' : 'group'})} 
                        />
                     </div>
                  </div>
                  <div className="flex items-center justify-between border-s md:ps-6">
                     <Label className="font-black text-xs text-slate-700">{t('isActive')}</Label>
                     <Switch checked={editingNode?.isActive !== false} onCheckedChange={v => setEditingNode({...editingNode!, isActive: v})} />
                  </div>
               </div>

               {editingNode?.isExecutable && (
                 <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="h-[1px] bg-slate-100 w-full" />
                    
                    <div className="p-5 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 space-y-4">
                       <h4 className="font-black text-[10px] text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                          <Package className="h-3.5 w-3.5" /> {isRtl ? 'تصنيفات الأصناف المخزنية المتاحة' : 'Linked Item Categories'}
                       </h4>
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {itemCategories?.map(cat => (
                            <div 
                              key={cat.id} 
                              onClick={() => toggleMultiSelect('allowedItemCategoryIds', 'name' as any, cat.id!, cat.name)}
                              className={cn(
                                "p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-2",
                                editingNode?.allowedItemCategoryIds?.includes(cat.id!) 
                                  ? "bg-white border-emerald-500 shadow-md" 
                                  : "bg-transparent border-slate-100 hover:border-emerald-200"
                              )}
                            >
                               <Checkbox checked={editingNode?.allowedItemCategoryIds?.includes(cat.id!) || false} className="h-3 w-3 pointer-events-none" />
                               <span className={cn("text-[9px] font-black uppercase truncate", editingNode?.allowedItemCategoryIds?.includes(cat.id!) ? "text-emerald-600" : "text-slate-400")}>{cat.name}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'وحدة القياس المعتمدة' : 'Standard Unit'}</Label>
                          <Select 
                            value={editingNode.unitTypeId} 
                            onValueChange={v => {
                               const unit = unitTypes?.find(u => u.id === v);
                               setEditingNode({...editingNode!, unitTypeId: v, unitName: unit?.name, unitSymbol: unit?.symbol});
                            }}
                          >
                             <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl border-2 shadow-2xl">
                                {unitTypes?.map(ut => <SelectItem key={ut.id} value={ut.id!} className="font-bold text-xs">{ut.name} ({ut.symbol})</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المرحلة الفنية الافتراضية' : 'Default Stage'}</Label>
                          <Select 
                            value={editingNode.defaultTechnicalStageId || "NONE"} 
                            onValueChange={v => setEditingNode({...editingNode!, defaultTechnicalStageId: v === "NONE" ? "" : v})}
                          >
                             <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white">
                                <SelectValue placeholder={loadingStages ? "جاري التحميل..." : "..."} />
                             </SelectTrigger>
                             <SelectContent className="rounded-xl border-2 shadow-2xl max-h-[300px]">
                                <SelectItem value="NONE" className="font-black text-slate-400 text-xs">{isRtl ? 'بدون ارتباط فني' : 'No Default Link'}</SelectItem>
                                {loadingStages ? (
                                  <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" /></div>
                                ) : allStages.length === 0 ? (
                                  <div className="p-4 text-center text-[10px] text-slate-400">{isRtl ? 'لا توجد مراحل (يرجى فحص الفهرس)' : 'No stages found'}</div>
                                ) : (
                                  allStages.map(stage => (
                                     <SelectItem key={stage.id} value={stage.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                                        <div className="flex flex-col text-start">
                                           <span className="flex items-center gap-1"><Workflow className="h-2.5 w-2.5 text-primary" /> {stage.name}</span>
                                           {stage.fullPathName && <span className="text-[8px] text-slate-400 font-bold mt-0.5">{stage.fullPathName}</span>}
                                        </div>
                                     </SelectItem>
                                  ))
                                )}
                             </SelectContent>
                          </Select>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setEditingNode(null)} className="flex-1 h-12 rounded-xl border-2 font-bold">إلغاء</Button>
               <Button onClick={handleSave} disabled={loadingAction === 'save'} className="flex-[2] h-12 rounded-xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2 border-b-4 border-orange-700">
                  {loadingAction === 'save' ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {t('save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-xl p-8 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
                <Trash2 className="h-8 w-8" />
             </div>
             <AlertDialogTitle className="text-start font-black text-2xl text-slate-900">{t('confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-1">
                {isRtl ? 'سيتم إزالة العقدة من المرجع نهائياً. لا يمكن التراجع عن هذه العملية.' : 'This node will be removed from the master reference permanently.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3 flex flex-row">
            <AlertDialogCancel className="flex-1 h-11 rounded-xl font-bold border-2 bg-white">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalDelete} className="flex-[2] h-11 rounded-xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200">
               {isRtl ? 'نعم، احذف' : 'Confirm Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
