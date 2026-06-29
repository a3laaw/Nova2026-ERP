
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
  CheckCircle2, X, Info,
  ExternalLink,
  ShieldAlert
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
  
  // States for the Inline Stage Picker
  const [showStagePicker, setShowStagePicker] = useState(false);
  const [stageSearch, setStageSearch] = useState('');
  
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

  const filteredStages = useMemo(() => {
    const q = stageSearch.trim().toLowerCase();
    if (!q) return availableStages;

    return availableStages.filter(stage =>
      [stage.name, stage.nameEn, stage.code]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    );
  }, [availableStages, stageSearch]);

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
      const updated = current.includes(stageId)
        ? current.filter(id => id !== stageId)
        : [...current, stageId];

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

    // --- Validation Logic ---
    const actId = effectiveContext?.activityTypeId || editingNode.activityTypeId;
    const srvId = effectiveContext?.serviceId || editingNode.serviceId;
    const subId = effectiveContext?.subServiceId || editingNode.subServiceId;

    if (editingNode.isExecutable) {
      if (!editingNode.unitTypeId) {
        toast({ variant: "destructive", title: isRtl ? "تنبيه" : "Alert", description: isRtl ? "يجب اختيار وحدة قياس للبند التنفيذي" : "Unit type is required for executable items" });
        return;
      }
      if (!actId || !srvId || !subId) {
        toast({ variant: "destructive", title: isRtl ? "تنبيه" : "Alert", description: isRtl ? "يجب اكتمال النشاط والخدمة والمسار الفني أولاً" : "Activity, Service, and Sub-Service must be set" });
        return;
      }
      if (!editingNode.technicalStageIds || editingNode.technicalStageIds.length === 0) {
        toast({ variant: "destructive", title: isRtl ? "تنبيه" : "Alert", description: isRtl ? "يجب اختيار مرحلة فنية واحدة على الأقل لتمكين المهندس من تسجيل الإنجاز" : "At least one technical stage is required for field logs" });
        return;
      }
    }

    setLoadingAction('save');
    try {
      const finalData = {
        ...editingNode,
        activityTypeId: actId || '',
        activityTypeName: effectiveContext?.activityTypeName || editingNode.activityTypeName || '',
        serviceId: srvId || '',
        serviceName: effectiveContext?.serviceName || editingNode.serviceName || '',
        subServiceId: subId || '',
        subServiceName: effectiveContext?.subServiceName || editingNode.subServiceName || '',
        technicalStageId: editingNode.technicalStageId || (editingNode.technicalStageIds?.[0] || ''),
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

      <Dialog 
        open={!!editingNode} 
        onOpenChange={open => {
          if (!open) {
            setEditingNode(null);
            setShowStagePicker(false);
            setStageSearch('');
          }
        }}
      >
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
                             <SelectContent className="rounded-xl">{activeSubs.map(s => <SelectItem key={s.id} value={s.id!} className="font-black text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
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

                          <div className="bg-blue-50 p-5 rounded-2xl border-2 border-blue-100 flex items-start gap-4 mb-4">
                             <ShieldAlert className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                             <div className="text-start space-y-1">
                                <h5 className="font-black text-xs text-blue-900 uppercase">قاعدة الظهور الميداني</h5>
                                <p className="text-[10px] text-blue-700/80 font-bold leading-relaxed">
                                   {isRtl 
                                     ? 'هام: المهندس في الموقع لن يرى هذا البند إلا إذا قمت بربطه بالمراحل التي يُسمح فيها بتنفيذه. الربط يضمن دقة التتبع ومنع تسجيل كميات في مراحل خاطئة.' 
                                     : 'Engineer in the field won\'t see this item unless linked to allowed execution stages. This ensures tracking accuracy and prevents misplaced logs.'}
                                </p>
                             </div>
                          </div>
                          
                          {effectiveContext?.subServiceId ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setShowStagePicker(v => !v)}
                                  className="flex-1 h-14 rounded-xl justify-between border-2 bg-white font-black text-xs px-6 shadow-sm"
                                >
                                  <div className="flex gap-3 overflow-hidden items-center">
                                    {editingNode?.technicalStageIds?.length ? (
                                      <>
                                        <Badge className="bg-primary text-white border-0 text-[10px] font-black h-6 px-3">
                                          {editingNode.technicalStageIds.length} {isRtl ? 'مرحلة مرتبطة' : 'Stages Linked'}
                                        </Badge>
                                        <span className="text-slate-500 truncate italic">
                                          {isRtl ? 'اضغط لعرض/تعديل المراحل' : 'Click to review/edit stages'}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-slate-400 font-bold">
                                        {isRtl ? '--- اختر مراحل التنفيذ لهذا البند ---' : '--- Select execution stages ---'}
                                      </span>
                                    )}
                                  </div>
                                  <ChevronDown className={cn("h-5 w-5 opacity-40 transition-transform", showStagePicker && "rotate-180")} />
                                </Button>

                                {!!editingNode?.technicalStageIds?.length && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      setEditingNode(prev =>
                                        prev
                                          ? { ...prev, technicalStageIds: [], technicalStageId: '' }
                                          : prev
                                      )
                                    }
                                    className="h-14 rounded-xl px-4 text-rose-600 hover:bg-rose-50 border-2 border-transparent"
                                  >
                                    <X className="h-5 w-5" />
                                  </Button>
                                )}
                              </div>

                              {showStagePicker && (
                                <div className="rounded-[2rem] border-2 border-primary/20 bg-white p-4 shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95 duration-200">
                                  <div className="relative">
                                    <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                    <Input
                                      value={stageSearch}
                                      onChange={(e) => setStageSearch(e.target.value)}
                                      placeholder={isRtl ? 'ابحث باسم المرحلة (مثلاً: حفر، قواعد)...' : 'Search stage...'}
                                      className="h-11 rounded-xl border-2 font-bold ps-10"
                                    />
                                  </div>

                                  <ScrollArea className="h-64 rounded-[1.5rem] border bg-slate-50/50">
                                    <div className="p-3 space-y-1.5">
                                      {loadingStages ? (
                                        <div className="py-20 text-center flex flex-col items-center gap-3">
                                          <Loader2 className="animate-spin h-8 w-8 text-primary/30" />
                                          <p className="text-[10px] font-black text-slate-400 uppercase">Fetching Sub-Service Stages...</p>
                                        </div>
                                      ) : filteredStages.length === 0 ? (
                                        <div className="py-16 text-center text-xs font-bold text-slate-400 italic">
                                          {isRtl ? 'لم يتم العثور على مراحل في هذا المسار الفني' : 'No stages found in this technical path'}
                                        </div>
                                      ) : (
                                        filteredStages.map(stage => {
                                          const isChecked = editingNode?.technicalStageIds?.includes(stage.id!);

                                          return (
                                            <div
                                              key={stage.id}
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => handleToggleStage(stage.id!)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault();
                                                  handleToggleStage(stage.id!);
                                                }
                                              }}
                                              className={cn(
                                                "w-full flex items-center justify-between p-4 rounded-xl transition-all border-2 cursor-pointer text-start",
                                                isChecked
                                                  ? "bg-white border-primary shadow-sm ring-1 ring-primary/5"
                                                  : "bg-white/50 border-transparent hover:border-slate-200"
                                              )}
                                            >
                                              <div className="flex items-center gap-4 min-w-0">
                                                <Checkbox
                                                  checked={isChecked}
                                                  className="h-5 w-5 pointer-events-none"
                                                />

                                                <div className="text-start min-w-0">
                                                  <p className={cn("font-black text-xs truncate", isChecked ? "text-slate-900" : "text-slate-500")}>
                                                    {isRtl ? stage.name : (stage.nameEn || stage.name)}
                                                  </p>
                                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    {stage.code}
                                                  </span>
                                                </div>
                                              </div>

                                              {isChecked && editingNode?.technicalStageId === stage.id && (
                                                <Badge className="bg-emerald-500 text-white text-[7px] font-black h-4 px-2 border-0">
                                                  PRIMARY
                                                </Badge>
                                              )}
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </ScrollArea>

                                  <div className="flex items-center justify-between gap-3 pt-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() =>
                                        setEditingNode(prev =>
                                          prev
                                            ? { ...prev, technicalStageIds: [], technicalStageId: '' }
                                            : prev
                                        )
                                      }
                                      className="text-rose-600 hover:bg-rose-50 text-[10px] font-black h-9 px-4"
                                    >
                                      {isRtl ? 'إلغاء كافة الروابط' : 'Clear All Links'}
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="default"
                                      onClick={() => setShowStagePicker(false)}
                                      className="rounded-xl h-10 px-8 text-xs font-black shadow-lg"
                                    >
                                      {isRtl ? 'تم الحفظ' : 'Confirm'}
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {editingNode?.technicalStageIds && editingNode.technicalStageIds.length > 1 && (
                                 <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner animate-in zoom-in-95">
                                    <div className="flex items-center justify-between mb-4">
                                       <div className="space-y-1">
                                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{isRtl ? 'مرحلة الربط الافتراضية' : 'Default Target Stage'}</Label>
                                          <p className="text-[8px] text-slate-400 font-bold">{isRtl ? 'سيتم استخدامها كخيار أول في سجلات المهندس' : 'Used as primary choice in field logs'}</p>
                                       </div>
                                       <Badge variant="outline" className="text-[8px] font-black border-primary/20 bg-white px-3 py-1">AUTO-ASSIGN PRIORITY</Badge>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                       {editingNode.technicalStageIds.map(id => {
                                          const stage = availableStages.find(s => s.id === id);
                                          const isSelected = editingNode.technicalStageId === id;
                                          return (
                                            <div 
                                              key={id}
                                              onClick={() => setEditingNode({...editingNode!, technicalStageId: id})}
                                              className={cn(
                                                "p-4 rounded-xl cursor-pointer transition-all flex items-center justify-between border-2",
                                                isSelected ? "bg-white border-primary shadow-md" : "bg-white/40 border-slate-100 opacity-60 hover:opacity-100"
                                              )}
                                            >
                                               <span className="text-[11px] font-black text-slate-700 truncate">{isRtl ? stage?.name : (stage?.nameEn || stage?.name)}</span>
                                               {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                            </div>
                                          );
                                       })}
                                    </div>
                                 </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-4 text-rose-500 p-6 bg-rose-50/50 rounded-[2rem] border-2 border-rose-100 ring-4 ring-rose-50/20">
                               <AlertTriangle className="h-7 w-7 shrink-0" />
                               <div className="text-start space-y-1">
                                  <p className="text-[11px] font-black uppercase tracking-widest">تنبيه: مسار مجهول</p>
                                  <p className="text-[10px] font-bold text-rose-600/80 leading-relaxed">
                                     {isRtl ? 'هذا البند غير تابع لمسار فني (SubService). يرجى ربط العقدة الأب بمسار محدد أولاً لتتمكن من تعيين مراحل التنفيذ.' : 'This node has no linked Technical Path. Link parent to a sub-service to assign execution stages.'}
                                  </p>
                               </div>
                            </div>
                          )}
                       </div>
                    </div>
                  )}
               </div>

               {editingNode?.isExecutable && (
                 <div className="grid grid-cols-2 gap-6 animate-in fade-in">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">وحدة القياس الموحدة</Label>
                       <Select value={editingNode.unitTypeId} onValueChange={v => {
                            const u = unitTypes?.find(x => x.id === v);
                            setEditingNode({...editingNode!, unitTypeId: v, unitName: u?.name, unitSymbol: u?.symbol});
                       }}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-black text-base"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2 shadow-2xl">
                             {unitTypes?.map(ut => <SelectItem key={ut.id} value={ut.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">{ut.name} ({ut.symbol})</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الفئة المرجعية (KWD)</Label>
                       <div className="relative">
                          <Input type="number" step="0.001" value={editingNode.estimatedRate || 0} onChange={e => setEditingNode({...editingNode!, estimatedRate: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black text-emerald-600 text-xl text-center" />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">KWD</div>
                       </div>
                    </div>
                 </div>
               )}

               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المواصفة الفنية القياسية' : 'Standard Technical Specification'}</Label>
                  <Textarea value={editingNode?.description || ''} onChange={e => setEditingNode({...editingNode!, description: e.target.value})} className="min-h-[120px] rounded-2xl border-2 p-5 text-xs font-bold leading-relaxed resize-none bg-slate-50/50 focus:bg-white transition-all shadow-inner" placeholder="..." />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-900 text-white rounded-[2rem] shadow-2xl ring-4 ring-slate-100">
                  <div className="flex items-center justify-between">
                     <div className="space-y-0.5 text-start">
                        <Label className="font-black text-xs uppercase tracking-tighter text-primary">{isRtl ? 'بند تنفيذي (Item)' : 'Executable Item'}</Label>
                        <p className="text-[8px] text-slate-400 font-bold">يسمح بتسجيل الإنجاز والميزانية</p>
                     </div>
                     <Switch checked={editingNode?.isExecutable || false} onCheckedChange={v => setEditingNode({...editingNode!, isExecutable: v, nodeRole: v ? 'work_item' : 'group'})} />
                  </div>
                  <div className="flex items-center justify-between border-s border-white/10 md:ps-8">
                     <div className="space-y-0.5 text-start">
                        <Label className="font-black text-xs uppercase tracking-tighter">{t('isActive')}</Label>
                        <p className="text-[8px] text-slate-400 font-bold">إتاحة البند للاستخدام الميداني</p>
                     </div>
                     <Switch checked={editingNode?.isActive !== false} onCheckedChange={v => setEditingNode({...editingNode!, isActive: v})} />
                  </div>
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
               <Button variant="outline" onClick={() => setEditingNode(null)} className="flex-1 h-14 rounded-2xl border-2 font-bold bg-white">إلغاء</Button>
               <Button onClick={handleSave} disabled={loadingAction === 'save'} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2 border-b-8 border-orange-700">
                  {loadingAction === 'save' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                  {t('save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                <Trash2 className="h-10 w-10" />
             </div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{t('confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                {isRtl 
                  ? 'هل أنت متأكد؟ سيتم إزالة البند المرجعي وكافة ارتباطاته الميدانية بالدراسات والقوالب نهائياً. لا يمكن التراجع عن هذا الإجراء.' 
                  : 'Are you sure? This will permanently remove the record and all its field links in templates and studies. This cannot be undone.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalDelete} className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200">
               {isRtl ? 'نعم، احذف السجل' : 'Confirm Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
