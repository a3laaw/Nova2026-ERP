
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  GitBranch, Plus, Loader2, Search, 
  Trash2, Edit3, ShieldCheck, Folder,
  Hammer, ChevronRight, ChevronDown,
  Save, Settings2, Workflow,
  RotateCcw, MapPin, AlertTriangle,
  CheckCircle2, X
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQReferenceNode, UnitType, TechnicalStage, ActivityType } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Dialog, 
    DialogContent, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from "@/components/ui/dialog";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { 
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from '@/hooks/use-toast';
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
import { BOQReferenceService } from '@/services/boq-reference-service';

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
  const [stagesPopoverOpen, setStagesPopoverOpen] = useState(false);
  
  const [availableStages, setAvailableStages] = useState<TechnicalStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  const canEdit = check('ref', 'edit').can;
  const canCreate = check('ref', 'create').can;
  const canDelete = check('ref', 'delete').can;

  const nodesQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqReferenceNodes(companyId))) : null, [db, companyId]);
  const unitTypesQuery = useMemo(() => companyId && db ? query(collection(db, paths.unitTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const activitiesQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  
  const { data: rawNodes, loading } = useCollection<BOQReferenceNode>(nodesQuery);
  const { data: unitTypes } = useCollection<UnitType>(unitTypesQuery);
  const { data: activities } = useCollection<ActivityType>(activitiesQuery);

  const referenceService = useMemo(() => db && companyId ? new BOQReferenceService(db, companyId, permissions) : null, [db, companyId, permissions]);

  const resolveInheritedContext = (nodeId: string | null): any => {
    if (!nodeId || !rawNodes) return { activityTypeId: '', activityTypeName: '', serviceId: '', serviceName: '', subServiceId: '', subServiceName: '' };
    const node = rawNodes.find(n => n.id === nodeId);
    if (!node) return { activityTypeId: '', activityTypeName: '', serviceId: '', serviceName: '', subServiceId: '', subServiceName: '' };

    if (node.subServiceId) {
      return {
        activityTypeId: node.activityTypeId,
        activityTypeName: node.activityTypeName,
        serviceId: node.serviceId,
        serviceName: node.serviceName,
        subServiceId: node.subServiceId,
        subServiceName: node.subServiceName
      };
    }
    return resolveInheritedContext(node.parentId);
  };

  const effectiveContext = useMemo(() => {
    if (!editingNode) return null;
    if (editingNode.subServiceId) {
       return {
         activityTypeId: editingNode.activityTypeId,
         activityTypeName: editingNode.activityTypeName,
         serviceId: editingNode.serviceId,
         serviceName: editingNode.serviceName,
         subServiceId: editingNode.subServiceId,
         subServiceName: editingNode.subServiceName,
         isInherited: false
       };
    }
    const inherited = resolveInheritedContext(editingNode.parentId || null);
    return { ...inherited, isInherited: !!editingNode.parentId };
  }, [editingNode, rawNodes]);

  const [activeServices, setActiveServices] = useState<any[]>([]);
  const [activeSubs, setActiveSubs] = useState<any[]>([]);

  useEffect(() => {
    if (db && companyId && editingNode?.activityTypeId && !effectiveContext?.isInherited) {
      getDocs(query(collection(db, paths.services(companyId, editingNode.activityTypeId)), orderBy('order')))
        .then(snap => setActiveServices(snap.docs.map(d => ({id: d.id, ...d.data()}))))
        .catch(() => setActiveServices([]));
    }
  }, [db, companyId, editingNode?.activityTypeId, effectiveContext?.isInherited]);

  useEffect(() => {
    if (db && companyId && editingNode?.activityTypeId && editingNode?.serviceId && !effectiveContext?.isInherited) {
      getDocs(query(collection(db, paths.subServices(companyId, editingNode.activityTypeId, editingNode.serviceId)), orderBy('order')))
        .then(snap => setActiveSubs(snap.docs.map(d => ({id: d.id, ...d.data()}))))
        .catch(() => setActiveSubs([]));
    }
  }, [db, companyId, editingNode?.serviceId, effectiveContext?.isInherited]);

  useEffect(() => {
    const subId = effectiveContext?.subServiceId;
    const actId = effectiveContext?.activityTypeId;
    const srvId = effectiveContext?.serviceId;

    if (db && companyId && subId && actId && srvId && editingNode?.isExecutable) {
      setLoadingStages(true);
      const path = paths.technicalStages(companyId, actId, srvId, subId);
      getDocs(collection(db, path))
        .then(snap => {
           const stages = snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalStage));
           setAvailableStages(stages.sort((a,b) => (a.order || 0) - (b.order || 0)));
        })
        .catch(() => setAvailableStages([]))
        .finally(() => setLoadingStages(false));
    } else {
      setAvailableStages([]);
    }
  }, [db, companyId, effectiveContext?.subServiceId, editingNode?.isExecutable]);

  const treeData = useMemo(() => {
    const nodes = rawNodes || [];
    const buildTree = (parentId: string | null): any[] => {
      return nodes
        .filter(n => (n.parentId || null) === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(n => ({ ...n, children: buildTree(n.id!) }));
    };
    return buildTree(null);
  }, [rawNodes]);

  const handleToggleStage = (stageId: string) => {
    setEditingNode(prev => {
      if (!prev) return prev;

      const current = prev.technicalStageIds || [];
      let updated: string[];

      if (current.includes(stageId)) {
        updated = current.filter(id => id !== stageId);
      } else {
        updated = [...current, stageId];
      }

      const nextDefault =
        updated.length === 0
          ? ''
          : prev.technicalStageId && updated.includes(prev.technicalStageId)
            ? prev.technicalStageId
            : updated[0];

      return {
        ...prev,
        technicalStageIds: updated,
        technicalStageId: nextDefault,
      };
    });
  };

  const handleSave = async () => {
    if (!referenceService || !user || !editingNode?.title) return;
    setLoadingAction('save');
    try {
      const finalData = {
        ...editingNode,
        activityTypeId: effectiveContext?.activityTypeId || editingNode.activityTypeId || '',
        activityTypeName: effectiveContext?.activityTypeName || editingNode.activityTypeName || '',
        serviceId: effectiveContext?.serviceId || editingNode.serviceId || '',
        serviceName: effectiveContext?.serviceName || editingNode.serviceName || '',
        subServiceId: effectiveContext?.subServiceId || editingNode.subServiceId || '',
        subServiceName: effectiveContext?.subServiceName || editingNode.subServiceName || '',
        technicalStageId: editingNode.technicalStageId || '',
        technicalStageIds: editingNode.technicalStageIds || []
      };

      if (editingNode.id) {
        await referenceService.updateBOQReferenceNode(editingNode.id, finalData, user.uid);
      } else {
        await referenceService.createBOQReferenceNode(finalData, user.uid);
      }
      toast({ title: t('saved') });
      setEditingNode(null);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFinalDelete = async () => {
    if (!referenceService || !deletingId) return;
    setLoadingAction(`delete_${deletingId}`);
    try {
      await referenceService.deleteBOQReferenceNode(deletingId);
      toast({ title: t('deleted') });
      setDeletingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const renderNode = (node: any, pathPrefix: string) => {
    const isExpanded = expandedNodes.includes(node.id);
    const hasChildren = node.childrenCount > 0;
    const isExecutable = node.isExecutable;

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
                   {isExecutable && (
                     <Badge className="bg-emerald-100 text-emerald-700 text-[7px] font-black h-4 px-1.5 border-0">
                       {node.technicalStageIds?.length > 1 ? 'MULTI-STAGE' : 'ITEM'}
                     </Badge>
                   )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                   {node.activityTypeName && <Badge variant="secondary" className="h-3 px-1 text-[7px] font-black uppercase bg-blue-50 text-blue-600 border-0">{node.activityTypeName}</Badge>}
                   {node.subServiceName && <Badge variant="secondary" className="h-3 px-1 text-[7px] font-black uppercase bg-orange-50 text-orange-600 border-0">{node.subServiceName}</Badge>}
                </div>
             </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
             {canCreate && !isExecutable && (
               <button 
                 onClick={() => setEditingNode({ 
                    parentId: node.id, nodeRole: 'group', isActive: true, isExecutable: false,
                    activityTypeId: node.activityTypeId, activityTypeName: node.activityTypeName,
                    serviceId: node.serviceId, serviceName: node.serviceName,
                    subServiceId: node.subServiceId, subServiceName: node.subServiceName,
                    order: node.childrenCount 
                 })}
                 className="h-8 w-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10"
               >
                 <Plus className="h-4 w-4" />
               </button>
             )}
             {canEdit && <button className="h-8 w-8 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-50" onClick={() => setEditingNode(node)}><Edit3 className="h-4 w-4" /></button>}
             {canDelete && <button className="h-8 w-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50" disabled={node.childrenCount > 0} onClick={() => setDeletingId(node.id!)}><Trash2 className="h-4 w-4" /></button>}
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
            {isRtl ? 'شجرة بنود الأعمال المرجعية' : 'Sovereign Reference Tree'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Master Work Registry & Multi-Stage Links</p>
        </div>
        {canCreate && (
           <Button 
             onClick={() => setEditingNode({ parentId: null, nodeRole: 'group', isActive: true, isExecutable: false, order: treeData.length })}
             className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2"
           >
             <Plus className="h-5 w-5" /> {isRtl ? 'إضافة قسم رئيسي' : 'Add Root Node'}
           </Button>
        )}
      </div>

      <Card className="border-0 shadow-2xl rounded-[1.5rem] bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50/50 border-b p-6">
            <div className="relative w-full max-w-sm">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
               <Input placeholder={t('search')} className="ps-11 h-11 rounded-xl border-slate-200 bg-white font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
         </CardHeader>
         <CardContent className="p-6 space-y-2 max-h-[70vh] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="py-24 text-center flex flex-col items-center gap-4">
                 <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                 <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Indexing Dynamic Registry...</p>
              </div>
            ) : treeData.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center gap-6 opacity-30">
                 <GitBranch className="h-20 w-20 text-slate-200" />
                 <p className="text-xl font-black text-slate-400">{isRtl ? 'القاموس فارغ حالياً' : 'Registry is Empty'}</p>
              </div>
            ) : (
              treeData.map((node, i) => renderNode(node, (i + 1).toString()))
            )}
         </CardContent>
      </Card>

      <Dialog open={!!editingNode} onOpenChange={open => !open && setEditingNode(null)}>
         <DialogContent className="rounded-xl p-0 overflow-hidden max-w-2xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 text-start border-b flex items-center justify-between">
               <DialogTitle className="text-xl font-black font-headline flex items-center gap-3">
                  <Settings2 className="h-6 w-6 text-primary" />
                  {editingNode?.id ? (isRtl ? 'تعديل بيانات العقدة' : 'Edit Registry Node') : (isRtl ? 'إضافة عقدة جديدة' : 'Add New Node')}
               </DialogTitle>
            </div>

            <div className="p-8 space-y-6 text-start bg-white max-h-[75vh] overflow-y-auto scrollbar-hide">
               
               <div className="space-y-4">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المسمى الهندسي / التجاري' : 'Node Professional Title'}</Label>
                     <Input value={editingNode?.title || ''} onChange={e => setEditingNode({...editingNode!, title: e.target.value})} className="h-12 rounded-xl border-2 font-black text-base bg-slate-50/30" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('code')}</Label>
                        <Input value={editingNode?.code || ''} onChange={e => setEditingNode({...editingNode!, code: e.target.value.toUpperCase()})} className="h-11 rounded-xl border-2 font-mono font-black text-primary" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ترتيب الظهور' : 'Display Order'}</Label>
                        <Input type="number" value={editingNode?.order || 0} onChange={e => setEditingNode({...editingNode!, order: Number(e.target.value)})} className="h-11 rounded-xl border-2 font-bold" />
                    </div>
                  </div>
               </div>

               <div className="p-6 bg-slate-50 rounded-2xl border-2 border-white shadow-inner space-y-6">
                  <h4 className="font-black text-[11px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                     <Workflow className="h-4 w-4 text-primary" /> {isRtl ? 'الارتباط التشغيلي الموروث' : 'Operational Context Inheritance'}
                  </h4>

                  {editingNode?.parentId ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
                       <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400">النشاط</Label>
                          <div className="text-[10px] font-black text-blue-600 bg-white px-3 py-2 rounded-lg border flex items-center gap-2">
                             <RotateCcw className="h-2.5 w-2.5 opacity-30" /> {effectiveContext?.activityTypeName || '---'}
                          </div>
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400">الخدمة</Label>
                          <div className="text-[10px] font-black text-orange-600 bg-white px-3 py-2 rounded-lg border flex items-center gap-2">
                             <RotateCcw className="h-2.5 w-2.5 opacity-30" /> {effectiveContext?.serviceName || '---'}
                          </div>
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400">المسار الفني</Label>
                          <div className="text-[10px] font-black text-emerald-600 bg-white px-3 py-2 rounded-lg border flex items-center gap-2">
                             <RotateCcw className="h-2.5 w-2.5 opacity-30" /> {effectiveContext?.subServiceName || '---'}
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black">النشاط</Label>
                          <Select value={editingNode?.activityTypeId || ''} onValueChange={v => {
                             const act = activities?.find(a => a.id === v);
                             setEditingNode({...editingNode!, activityTypeId: v, activityTypeName: act?.name || '', serviceId: '', subServiceId: ''});
                          }}>
                             <SelectTrigger className="h-10 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black">الخدمة</Label>
                          <Select disabled={!editingNode?.activityTypeId} value={editingNode?.serviceId || ''} onValueChange={v => {
                             const srv = activeServices.find(s => s.id === v);
                             setEditingNode({...editingNode!, serviceId: v, serviceName: srv?.name || '', subServiceId: ''});
                          }}>
                             <SelectTrigger className="h-10 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">{activeServices.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black">المسار</Label>
                          <Select disabled={!editingNode?.serviceId} value={editingNode?.subServiceId || ''} onValueChange={v => {
                             const sub = activeSubs.find(s => s.id === v);
                             setEditingNode({...editingNode!, subServiceId: v, subServiceName: sub?.name || ''});
                          }}>
                             <SelectTrigger className="h-10 rounded-lg border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">{activeSubs.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                    </div>
                  )}

                  {editingNode?.isExecutable && (
                    <div className="pt-6 border-t border-slate-200 animate-in slide-in-from-top-2">
                       <div className="space-y-3">
                          <Label className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                             <MapPin className="h-3.5 w-3.5" /> ربط مراحل التنفيذ الميداني (متعدد)
                          </Label>
                          
                          {effectiveContext?.subServiceId ? (
                            <div className="space-y-4">
                               <Popover open={stagesPopoverOpen} onOpenChange={setStagesPopoverOpen}>
                                  <PopoverTrigger asChild>
                                     <Button 
                                       type="button"
                                       variant="outline" 
                                       className="w-full h-12 rounded-xl justify-between border-2 bg-white font-black text-xs px-4"
                                     >
                                        <div className="flex gap-1 overflow-hidden">
                                           {editingNode.technicalStageIds?.length ? (
                                             <Badge className="bg-primary text-white border-0 text-[10px] font-black">{editingNode.technicalStageIds.length} {isRtl ? 'مختار' : 'Selected'}</Badge>
                                           ) : <span className="text-slate-400">{isRtl ? '--- اختر مرحلة واحدة أو أكثر ---' : '--- Select one or more stages ---'}</span>}
                                        </div>
                                        <ChevronDown className="h-4 w-4 opacity-30" />
                                     </Button>
                                  </PopoverTrigger>
                                  <PopoverContent 
                                    className="w-[400px] p-2 rounded-2xl border-2 shadow-2xl bg-white" 
                                    align="start"
                                    sideOffset={8}
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                  >
                                     <ScrollArea className="h-64">
                                        <div className="space-y-1 p-2">
                                           {loadingStages ? (
                                              <div className="p-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/30" /></div>
                                           ) : availableStages.length === 0 ? (
                                              <div className="p-6 text-center text-xs font-bold text-slate-400">
                                                {isRtl ? 'لا توجد مراحل متاحة لهذا المسار الفني' : 'No stages available for this technical path'}
                                              </div>
                                           ) : (
                                              availableStages.map(stage => {
                                                const isChecked = editingNode.technicalStageIds?.includes(stage.id!);
                                                return (
                                                  <div 
                                                    key={stage.id} 
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    onClick={() => handleToggleStage(stage.id!)}
                                                    className={cn(
                                                      "w-full flex items-center justify-between p-3 rounded-xl transition-all border-2 mb-1 text-start cursor-pointer",
                                                      isChecked ? "bg-primary/5 border-primary/20" : "bg-white border-transparent hover:bg-slate-50"
                                                    )}
                                                  >
                                                     <div className="flex items-center gap-3">
                                                        <Checkbox 
                                                          checked={isChecked} 
                                                          className="pointer-events-none"
                                                        />
                                                        <div className="text-start">
                                                           <p className="font-black text-xs text-slate-800">{isRtl ? stage.name : (stage.nameEn || stage.name)}</p>
                                                           <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{stage.code}</span>
                                                        </div>
                                                     </div>
                                                     {editingNode.technicalStageId === stage.id && <Badge className="bg-emerald-500 text-white text-[7px] font-black h-4">DEFAULT</Badge>}
                                                  </div>
                                                );
                                              })
                                           )}
                                        </div>
                                     </ScrollArea>
                                  </PopoverContent>
                               </Popover>

                               {editingNode.technicalStageIds && editingNode.technicalStageIds.length > 1 && (
                                 <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 animate-in zoom-in-95">
                                    <Label className="text-[9px] font-black uppercase text-primary mb-3 block">{isRtl ? 'المرحلة الافتراضية (للإسناد التلقائي)' : 'Primary Default Stage'}</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                       {editingNode.technicalStageIds.map(id => {
                                          const stage = availableStages.find(s => s.id === id);
                                          return (
                                            <div 
                                              key={id}
                                              onClick={() => setEditingNode({...editingNode, technicalStageId: id})}
                                              className={cn(
                                                "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border-2",
                                                editingNode.technicalStageId === id ? "bg-white border-primary shadow-sm" : "bg-white/50 border-slate-100 opacity-60"
                                              )}
                                            >
                                               <span className="text-[10px] font-black text-slate-700 truncate">{isRtl ? stage?.name : (stage?.nameEn || stage?.name)}</span>
                                               {editingNode.technicalStageId === id && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                            </div>
                                          );
                                       })}
                                    </div>
                                 </div>
                               )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-rose-500 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                               <AlertTriangle className="h-5 w-5" />
                               <span className="text-[10px] font-bold">
                                  {isRtl ? 'يجب تحديد المسار الفني العام (SubService) للأب أولاً لتتمكن من ربط مراحل التنفيذ.' : 'Inherited Technical Path (SubService) missing. Link ancestor first.'}
                               </span>
                            </div>
                          )}
                       </div>
                    </div>
                  )}
               </div>

               {editingNode?.isExecutable && (
                 <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">وحدة القياس الموحدة</Label>
                       <Select value={editingNode.unitTypeId} onValueChange={v => {
                            const u = unitTypes?.find(x => x.id === v);
                            setEditingNode({...editingNode!, unitTypeId: v, unitName: u?.name, unitSymbol: u?.symbol});
                       }}>
                          <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl">{unitTypes?.map(ut => <SelectItem key={ut.id} value={ut.id!} className="font-bold text-xs">{ut.name} ({ut.symbol})</SelectItem>)}</SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الفئة المرجعية (KWD)</Label>
                       <Input type="number" step="0.001" value={editingNode.estimatedRate || 0} onChange={e => setEditingNode({...editingNode!, estimatedRate: Number(e.target.value)})} className="h-11 rounded-xl border-2 font-black text-emerald-600 text-lg" />
                    </div>
                 </div>
               )}

               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المواصفة الفنية القياسية' : 'Standard Technical Specification'}</Label>
                  <Textarea value={editingNode?.description || ''} onChange={e => setEditingNode({...editingNode!, description: e.target.value})} className="min-h-[100px] rounded-xl border-2 p-4 text-xs font-bold leading-relaxed resize-none bg-slate-50/50" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-900 text-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between">
                     <Label className="font-black text-xs uppercase tracking-tighter">{isRtl ? 'بند تنفيذي (Item)' : 'Executable Work Item'}</Label>
                     <Switch checked={editingNode?.isExecutable || false} onCheckedChange={v => setEditingNode({...editingNode!, isExecutable: v, nodeRole: v ? 'work_item' : 'group'})} />
                  </div>
                  <div className="flex items-center justify-between border-s border-white/10 md:ps-6">
                     <Label className="font-black text-xs uppercase tracking-tighter">{t('isActive')}</Label>
                     <Switch checked={editingNode?.isActive !== false} onCheckedChange={v => setEditingNode({...editingNode!, isActive: v})} />
                  </div>
               </div>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setEditingNode(null)} className="flex-1 h-12 rounded-xl border-2 font-bold bg-white">إلغاء</Button>
               <Button onClick={handleSave} disabled={loadingAction === 'save'} className="flex-[2] h-12 rounded-xl bg-primary text-white font-black text-sm shadow-xl border-b-4 border-orange-700">
                  {loadingAction === 'save' ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {t('save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-xl p-8 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4"><Trash2 className="h-8 w-8" /></div>
             <AlertDialogTitle className="text-start font-black text-2xl text-slate-900">{t('confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-1">{isRtl ? 'سيتم إزالة البند المرجعي وكافة ارتباطاته التشغيلية نهائياً.' : 'This will permanently remove the record and its technical links.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3 flex flex-row">
            <AlertDialogCancel className="flex-1 h-11 rounded-xl font-bold border-2 bg-white">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalDelete} className="flex-[2] h-11 rounded-xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200">{isRtl ? 'نعم، احذف' : 'Confirm Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
