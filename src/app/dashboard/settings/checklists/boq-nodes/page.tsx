
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  GitBranch, Plus, Loader2, Search, 
  Trash2, Edit3, ShieldCheck, Folder,
  Hammer, ChevronRight, ChevronDown,
  Info, Save, ListChecks, Settings2,
  X, AlertTriangle, Workflow
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQReferenceService } from '@/services/boq-reference-service';
import { TechnicalPathService } from '@/services/technical-path-service';
import { BOQReferenceNode, UnitType, ItemCategory, TechnicalStage } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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

  const canEdit = check('ref', 'edit').can;
  const canCreate = check('ref', 'create').can;
  const canDelete = check('ref', 'delete').can;

  const nodesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqReferenceNodes(companyId))) : null, 
  [db, companyId]);

  const unitTypesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.unitTypes(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: rawNodes, loading } = useCollection<BOQReferenceNode>(nodesQuery);
  const { data: unitTypes } = useCollection<UnitType>(unitTypesQuery);

  const service = useMemo(() => 
    db && companyId ? new BOQReferenceService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  // جلب كافة المراحل الفنية للربط
  useEffect(() => {
    if (db && companyId) {
      const tpService = new TechnicalPathService(db, companyId);
      tpService.getAllCompanyStages()
        .then(setAllStages)
        .catch(() => {
          // الخطأ يعالج داخلياً عبر الباعث، لا حاجة لتعطيل الواجهة
        });
    }
  }, [db, companyId]);

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

  const handleSave = () => {
    if (!service || !user || !editingNode?.title) return;
    
    if (!editingNode.parentId && !editingNode.code) {
      toast({ variant: "destructive", title: isRtl ? "الكود مطلوب للقسم الرئيسي" : "Code required for root section" });
      return;
    }

    setLoadingAction('save');
    try {
      if (editingNode.id) {
        service.updateBOQReferenceNode(editingNode.id, editingNode, user.uid);
      } else {
        service.createBOQReferenceNode(editingNode, user.uid);
      }
      toast({ title: t('saved') });
      setEditingNode(null);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFinalDelete = () => {
    if (!service || !deletingId) return;
    setLoadingAction(`delete_${deletingId}`);
    try {
      service.deleteBOQReferenceNode(deletingId);
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
    const isExecutable = node.isExecutable || node.nodeRole === 'work_item';

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
             <div onClick={() => toggleNode(node.id)} className="cursor-pointer text-slate-400 hover:text-primary">
                {hasChildren ? (
                   isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                ) : <div className="w-4" />}
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
                {isExecutable && node.unitSymbol && (
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{node.unitName} ({node.unitSymbol})</p>
                )}
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
            {isRtl ? 'القاموس الهندسي الشجري' : 'Dynamic BOQ Master'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{isRtl ? 'بناء وتخصيص هيكل بنود الأعمال السيادي' : 'Build & customize sovereign work item structure'}</p>
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
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 font-black text-[9px] uppercase">
                  <Folder className="h-3 w-3" /> {isRtl ? 'مجلدات' : 'Groups'}
               </div>
               <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-black text-[9px] uppercase border border-emerald-100">
                  <Hammer className="h-3 w-3" /> {isRtl ? 'بنود تنفيذية' : 'Items'}
               </div>
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
         <DialogContent className="rounded-xl p-0 overflow-hidden max-w-2xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 text-start border-b">
               <DialogTitle className="text-xl font-black font-headline flex items-center gap-3">
                  <Settings2 className="h-6 w-6 text-primary" />
                  {editingNode?.id ? (isRtl ? 'تعديل بيانات العقدة' : 'Edit Node Data') : (isRtl ? 'إضافة فرع جديد للهيكل' : 'Add New Node')}
               </DialogTitle>
               <p className="text-slate-400 font-bold text-[10px] mt-1 uppercase tracking-widest">{isRtl ? 'تخصيص الخصائص الهندسية والتنفيذية' : 'Configure engineering & execution props'}</p>
            </div>

            <div className="p-6 space-y-5 text-start bg-white max-h-[65vh] overflow-y-auto scrollbar-hide">
               {!editingNode?.parentId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('code')}</Label>
                       <Input 
                         value={editingNode?.code || ''} 
                         onChange={e => setEditingNode({...editingNode!, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} 
                         className="h-11 rounded-xl border-2 font-mono font-black text-primary" 
                         placeholder="E.G. CIVIL_01"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'ترتيب الظهور' : 'Order'}</Label>
                       <Input 
                         type="number" 
                         value={editingNode?.order || 0} 
                         onChange={e => setEditingNode({...editingNode!, order: Number(e.target.value)})} 
                         className="h-11 rounded-xl border-2 font-bold" 
                       />
                    </div>
                  </div>
               )}

               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المسمى الهندسي' : 'Node Title'}</Label>
                  <Input 
                    value={editingNode?.title || ''} 
                    onChange={e => setEditingNode({...editingNode!, title: e.target.value})} 
                    className="h-12 rounded-xl border-2 font-black text-base bg-slate-50/30 focus:bg-white transition-all" 
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
                     <p className="text-[8px] text-slate-400 font-bold leading-tight">{isRtl ? 'تفعيل هذا الخيار يحول العقدة إلى بند صرف فعلي يحمل وحدات قياس ومراحل فنية.' : 'Enabling this makes the node a billable item with units and stages.'}</p>
                  </div>
                  <div className="flex items-center justify-between border-s md:ps-6">
                     <Label className="font-black text-xs text-slate-700">{t('isActive')}</Label>
                     <Switch checked={editingNode?.isActive !== false} onCheckedChange={v => setEditingNode({...editingNode!, isActive: v})} />
                  </div>
               </div>

               {editingNode?.isExecutable && (
                 <div className="space-y-5 animate-in slide-in-from-top-4 duration-500">
                    <div className="h-[1px] bg-slate-100 w-full" />
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
                          <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المرحلة الفنية المرتبطة' : 'Default Stage'}</Label>
                          <Select 
                            value={editingNode.technicalStageId} 
                            onValueChange={v => setEditingNode({...editingNode!, technicalStageId: v})}
                          >
                             <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl border-2 shadow-2xl">
                                {allStages.map(stage => (
                                   <SelectItem key={stage.id} value={stage.id!} className="font-bold text-xs py-2">
                                      <div className="flex flex-col text-start">
                                         <span className="flex items-center gap-1"><Workflow className="h-2.5 w-2.5 text-primary" /> {stage.name}</span>
                                         <span className="text-[8px] text-slate-400 uppercase">CODE: {stage.code}</span>
                                      </div>
                                   </SelectItem>
                                ))}
                             </SelectContent>
                          </Select>
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'وصف المواصفات الفنية' : 'Engineering Specifications'}</Label>
                       <Textarea 
                         value={editingNode.description || ''} 
                         onChange={e => setEditingNode({...editingNode!, description: e.target.value})} 
                         className="min-h-[80px] rounded-xl border-2 p-3 text-xs font-bold leading-relaxed resize-none bg-slate-50/50 focus:bg-white transition-all" 
                       />
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
