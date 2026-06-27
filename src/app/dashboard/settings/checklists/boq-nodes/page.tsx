
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
  RotateCcw, Package, MapPin
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, collectionGroup, where, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQReferenceNode, UnitType, TechnicalStage, ActivityType, Service, SubService, ItemCategory } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { TechnicalPathService } from '@/services/technical-path-service';

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
  
  const [availableStages, setAvailableStages] = useState<TechnicalStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  const canEdit = check('ref', 'edit').can;
  const canCreate = check('ref', 'create').can;
  const canDelete = check('ref', 'delete').can;

  // Data Fetching
  const nodesQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqReferenceNodes(companyId))) : null, [db, companyId]);
  const unitTypesQuery = useMemo(() => companyId && db ? query(collection(db, paths.unitTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const activitiesQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  
  const { data: rawNodes, loading } = useCollection<BOQReferenceNode>(nodesQuery);
  const { data: unitTypes } = useCollection<UnitType>(unitTypesQuery);
  const { data: activities } = useCollection<ActivityType>(activitiesQuery);

  // Cascaded Data Fetching for Root Nodes
  const servicesQuery = useMemo(() => {
    if (!companyId || !db || !editingNode?.activityTypeId || editingNode?.parentId) return null;
    return query(collection(db, paths.services(companyId, editingNode.activityTypeId)), orderBy('order'));
  }, [db, companyId, editingNode?.activityTypeId, editingNode?.parentId]);
  const { data: services } = useCollection<Service>(servicesQuery);

  const subServicesQuery = useMemo(() => {
    if (!companyId || !db || !editingNode?.activityTypeId || !editingNode?.serviceId || editingNode?.parentId) return null;
    return query(collection(db, paths.subServices(companyId, editingNode.activityTypeId, editingNode.serviceId)), orderBy('order'));
  }, [db, companyId, editingNode?.activityTypeId, editingNode?.serviceId, editingNode?.parentId]);
  const { data: subServices } = useCollection<SubService>(subServicesQuery);

  const referenceService = useMemo(() => db && companyId ? new BOQReferenceService(db, companyId, permissions) : null, [db, companyId, permissions]);

  // Fetch stages when Node is Executable (Inherited SubService is used)
  useEffect(() => {
    if (db && companyId && editingNode?.subServiceId && editingNode.activityTypeId && editingNode.serviceId && editingNode.isExecutable) {
      setLoadingStages(true);
      const tpService = new TechnicalPathService(db, companyId);
      const path = paths.technicalStages(companyId, editingNode.activityTypeId, editingNode.serviceId, editingNode.subServiceId);
      getDocs(collection(db, path))
        .then(snap => setAvailableStages(snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalStage))))
        .finally(() => setLoadingStages(false));
    } else {
      setAvailableStages([]);
    }
  }, [db, companyId, editingNode?.subServiceId, editingNode?.activityTypeId, editingNode?.serviceId, editingNode?.isExecutable]);

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

  const handleSave = async () => {
    if (!referenceService || !user || !editingNode?.title) return;
    setLoadingAction('save');
    try {
      if (editingNode.id) {
        await referenceService.updateBOQReferenceNode(editingNode.id, editingNode, user.uid);
      } else {
        await referenceService.createBOQReferenceNode(editingNode, user.uid);
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
                   {isExecutable && <Badge className="bg-emerald-100 text-emerald-700 text-[7px] font-black h-4 px-1.5 border-0">ITEM</Badge>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                   {node.activityTypeName && (
                     <Badge variant="secondary" className="h-3 px-1 text-[7px] font-black uppercase bg-blue-50 text-blue-600 border-0">
                       {node.activityTypeName}
                     </Badge>
                   )}
                   {node.subServiceName && (
                     <Badge variant="secondary" className="h-3 px-1 text-[7px] font-black uppercase bg-orange-50 text-orange-600 border-0">
                       {node.subServiceName}
                     </Badge>
                   )}
                </div>
             </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
             {canCreate && !isExecutable && (
               <button 
                 onClick={() => setEditingNode({ 
                    parentId: node.id, 
                    nodeRole: 'group', 
                    isActive: true, 
                    isExecutable: false,
                    inheritServices: true,
                    activityTypeId: node.activityTypeId,
                    activityTypeName: node.activityTypeName,
                    serviceId: node.serviceId,
                    serviceName: node.serviceName,
                    subServiceId: node.subServiceId,
                    subServiceName: node.subServiceName,
                    order: node.childrenCount 
                 })}
                 className="h-8 w-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
               >
                 <Plus className="h-4 w-4" />
               </button>
             )}
             {canEdit && (
                <button className="h-8 w-8 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors" onClick={() => setEditingNode(node)}><Edit3 className="h-4 w-4" /></button>
             )}
             {canDelete && (
                <button className="h-8 w-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors" disabled={node.childrenCount > 0} onClick={() => setDeletingId(node.id!)}><Trash2 className="h-4 w-4" /></button>
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
            {isRtl ? 'شجرة بنود الأعمال المرجعية' : 'Sovereign Reference Tree'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Pipeline & Work Item Logic</p>
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
                  {editingNode?.id ? (isRtl ? 'تعديل العقدة' : 'Edit Node') : (isRtl ? 'إضافة عقدة' : 'Add Node')}
               </DialogTitle>
               <Badge className="bg-primary/10 text-primary border-0 font-black">{editingNode?.isExecutable ? 'WORK ITEM' : 'GROUP'}</Badge>
            </div>

            <div className="p-8 space-y-6 text-start bg-white max-h-[75vh] overflow-y-auto scrollbar-hide">
               
               <div className="space-y-4">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المسمى الهندسي' : 'Node Title'}</Label>
                     <Input 
                       value={editingNode?.title || ''} 
                       onChange={e => setEditingNode({...editingNode!, title: e.target.value})} 
                       className="h-12 rounded-xl border-2 font-black text-base bg-slate-50/30 focus:bg-white transition-all" 
                     />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
               </div>

               {/* الارتباط التشغيلي (وراثة تلقائية للأبناء) */}
               <div className="p-6 bg-slate-50 rounded-2xl border-2 border-white shadow-inner space-y-6">
                  <h4 className="font-black text-[11px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                     <Workflow className="h-4 w-4 text-primary" /> {isRtl ? 'الارتباط التشغيلي (الوراثة)' : 'Operational Context'}
                  </h4>

                  {editingNode?.parentId ? (
                    // عرض البيانات الموروثة بشكل غير قابل للتعديل للأبناء
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
                       <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400">النشاط</Label>
                          <p className="text-xs font-black text-blue-600 bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100">{editingNode.activityTypeName || '---'}</p>
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400">الخدمة</Label>
                          <p className="text-xs font-black text-orange-600 bg-orange-50/50 px-3 py-2 rounded-lg border border-orange-100">{editingNode.serviceName || '---'}</p>
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-slate-400">المسار الفني</Label>
                          <p className="text-xs font-black text-emerald-600 bg-emerald-50/50 px-3 py-2 rounded-lg border border-emerald-100">{editingNode.subServiceName || '---'}</p>
                       </div>
                    </div>
                  ) : (
                    // السماح بالاختيار فقط للعقد الجذرية (Roots)
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">النشاط</Label>
                          <Select 
                            value={editingNode?.activityTypeId || ''} 
                            onValueChange={v => {
                              const act = activities?.find(a => a.id === v);
                              setEditingNode({...editingNode!, activityTypeId: v, activityTypeName: act?.name, serviceId: '', serviceName: '', subServiceId: '', subServiceName: ''});
                            }}
                          >
                             <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-white text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>

                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">الخدمة</Label>
                          <Select 
                            disabled={!editingNode?.activityTypeId}
                            value={editingNode?.serviceId || ''} 
                            onValueChange={v => {
                              const srv = services?.find(s => s.id === v);
                              setEditingNode({...editingNode!, serviceId: v, serviceName: srv?.name, subServiceId: '', subServiceName: ''});
                            }}
                          >
                             <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-white text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>

                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">المسار الفني</Label>
                          <Select 
                            disabled={!editingNode?.serviceId}
                            value={editingNode?.subServiceId || ''} 
                            onValueChange={v => {
                              const sub = subServices?.find(s => s.id === v);
                              setEditingNode({...editingNode!, subServiceId: v, subServiceName: sub?.name});
                            }}
                          >
                             <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-white text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                {subServices?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                    </div>
                  )}

                  {/* المرحلة الفنية الدقيقة: القائمة الوحيدة المتاحة للبنود التنفيذية */}
                  {editingNode?.isExecutable && (
                    <div className="pt-4 border-t border-slate-200 animate-in slide-in-from-top-2">
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                             <MapPin className="h-3 w-3" /> المرحلة الفنية المرتبطة (تلقائياً)
                          </Label>
                          <Select 
                            disabled={!editingNode?.subServiceId}
                            value={editingNode?.technicalStageId || ''} 
                            onValueChange={v => setEditingNode({...editingNode!, technicalStageId: v})}
                          >
                             <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white shadow-sm ring-2 ring-primary/5">
                                <SelectValue placeholder={loadingStages ? "جاري التحميل..." : (isRtl ? "اختر المرحلة من المسار الموروث..." : "Select Stage...")} />
                             </SelectTrigger>
                             <SelectContent className="rounded-xl border-2 shadow-2xl">
                                {loadingStages ? <div className="p-4 text-center"><Loader2 className="animate-spin h-5 w-5 mx-auto text-primary" /></div> : 
                                  availableStages.length === 0 ? <div className="p-4 text-center text-xs italic text-slate-400">{isRtl ? 'لا يوجد مراحل معرفة لهذا المسار.' : 'No stages defined.'}</div> :
                                  availableStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-2">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                    </div>
                  )}
               </div>

               {editingNode?.isExecutable && (
                 <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400">وحدة القياس</Label>
                       <Select 
                         value={editingNode.unitTypeId} 
                         onValueChange={v => {
                            const unit = unitTypes?.find(u => u.id === v);
                            setEditingNode({...editingNode!, unitTypeId: v, unitName: unit?.name, unitSymbol: unit?.symbol});
                         }}
                       >
                          <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {unitTypes?.map(ut => <SelectItem key={ut.id} value={ut.id!} className="font-bold text-xs">{ut.name} ({ut.symbol})</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400">الفئة التقديرية (KWD)</Label>
                       <Input type="number" step="0.001" value={editingNode.estimatedRate || 0} onChange={e => setEditingNode({...editingNode!, estimatedRate: Number(e.target.value)})} className="h-11 rounded-xl border-2 font-black text-emerald-600" />
                    </div>
                 </div>
               )}

               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'وصف المواصفات الفنية' : 'Master Specification Description'}</Label>
                  <Textarea 
                    value={editingNode?.description || ''} 
                    onChange={e => setEditingNode({...editingNode!, description: e.target.value})} 
                    className="min-h-[100px] rounded-xl border-2 p-4 text-xs font-bold leading-relaxed resize-none bg-slate-50/50 focus:bg-white transition-all shadow-inner" 
                  />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-900 text-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between">
                     <Label className="font-black text-xs uppercase tracking-tighter">{isRtl ? 'بند تنفيذي' : 'Executable Item'}</Label>
                     <Switch 
                       checked={editingNode?.isExecutable || false} 
                       onCheckedChange={v => setEditingNode({...editingNode!, isExecutable: v, nodeRole: v ? 'work_item' : 'group'})} 
                     />
                  </div>
                  <div className="flex items-center justify-between border-s border-white/10 md:ps-6">
                     <Label className="font-black text-xs uppercase tracking-tighter">{t('isActive')}</Label>
                     <Switch checked={editingNode?.isActive !== false} onCheckedChange={v => setEditingNode({...editingNode!, isActive: v})} />
                  </div>
               </div>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setEditingNode(null)} className="flex-1 h-12 rounded-xl border-2 font-bold bg-white">إلغاء</Button>
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
             <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4"><Trash2 className="h-8 w-8" /></div>
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
