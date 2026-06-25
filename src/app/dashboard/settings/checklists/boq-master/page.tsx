'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FolderTree, Plus, Loader2, Search, 
  Trash2, Edit3, ShieldCheck, LayoutGrid,
  Boxes, Hammer, ChevronRight, ChevronDown,
  Info, Save, ListChecks, Settings2
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQMasterService } from '@/services/boq-master-service';
import { BOQWorkItemMasterNode, UnitType } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';

export default function BOQMasterPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check, permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<Partial<BOQWorkItemMasterNode> | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);

  const canEdit = check('ref', 'edit').can;

  const nodesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqWorkItemsMaster(companyId))) : null, 
  [db, companyId]);

  const unitTypesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.unitTypes(companyId))) : null, 
  [db, companyId]);

  const { data: rawNodes, loading } = useCollection<BOQWorkItemMasterNode>(nodesQuery);
  const { data: unitTypes } = useCollection<UnitType>(unitTypesQuery);

  const service = useMemo(() => 
    db && companyId ? new BOQMasterService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

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
    
    if (!editingNode.parentId && !editingNode.code) {
      toast({ variant: "destructive", title: isRtl ? "الكود مطلوب للقسم الرئيسي" : "Code required for root section" });
      return;
    }

    setLoadingAction('save');
    try {
      if (editingNode.id) {
        await service.updateBOQReferenceNode(editingNode.id, editingNode, user.uid);
      } else {
        await service.createBOQReferenceNode(editingNode, user.uid);
      }
      toast({ title: t('saved') });
      setEditingNode(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!service || !confirm(t('confirmDelete'))) return;
    setLoadingAction(`delete_${id}`);
    try {
      await service.deleteBOQReferenceNode(id);
      toast({ title: t('deleted') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'section': return <LayoutGrid className="h-4 w-4 text-primary" />;
      case 'main_category': return <Boxes className="h-4 w-4 text-blue-600" />;
      case 'component': return <Hammer className="h-4 w-4 text-emerald-600" />;
      case 'work_item': return <ListChecks className="h-4 w-4 text-orange-600" />;
      default: return <FolderTree className="h-4 w-4" />;
    }
  };

  const renderNode = (node: any, pathPrefix: string) => {
    const isExpanded = expandedNodes.includes(node.id);
    const hasChildren = node.childrenCount > 0;

    return (
      <div key={node.id} className="space-y-1">
        <div 
          className={cn(
            "flex items-center justify-between p-3 rounded-xl border transition-all group",
            node.nodeType === 'section' ? "bg-white border-slate-200 shadow-sm" :
            node.nodeType === 'main_category' ? "bg-slate-50 border-slate-100 ms-4" :
            node.nodeType === 'component' ? "bg-white border-slate-50 ms-8" : "bg-white border-dashed border-slate-100 ms-12"
          )}
        >
          <div className="flex items-center gap-3">
             <div onClick={() => toggleNode(node.id)} className="cursor-pointer">
                {hasChildren ? (
                   isExpanded ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className={cn("h-3 w-3 text-slate-400", isRtl && "rotate-180")} />
                ) : <div className="w-3" />}
             </div>
             {getNodeIcon(node.nodeType)}
             <div className="text-start">
                <div className="flex items-center gap-2">
                   <span className="text-[9px] font-black text-primary font-mono bg-primary/5 px-1 rounded">{pathPrefix}</span>
                   <span className="text-xs font-bold text-slate-800">{node.title}</span>
                </div>
                {node.nodeType === 'work_item' && (
                   <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-mono text-slate-400 uppercase tracking-tighter">REF: {node.code || pathPrefix}</span>
                      <Badge variant="outline" className="h-3.5 px-1 text-[7px] bg-slate-50 text-primary border-primary/10">
                        {node.unitSymbol || node.unitName}
                      </Badge>
                   </div>
                )}
             </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
             {node.nodeType !== 'work_item' && canEdit && (
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-7 w-7 text-primary"
                 onClick={() => {
                   const childType = node.nodeType === 'section' ? 'main_category' : 
                                    node.nodeType === 'main_category' ? 'component' : 'work_item';
                   setEditingNode({ 
                     parentId: node.id, 
                     nodeType: childType, 
                     level: node.level + 1, 
                     title: '', 
                     code: '', 
                     order: node.childrenCount 
                   });
                 }}
               >
                 <Plus className="h-3.5 w-3.5" />
               </Button>
             )}
             <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" onClick={() => setEditingNode(node)}><Edit3 className="h-3.5 w-3.5" /></Button>
             <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-rose-500" 
                disabled={node.childrenCount > 0 || loadingAction?.startsWith('delete')}
                onClick={() => handleDelete(node.id)}
             >
                <Trash2 className="h-3.5 w-3.5" />
             </Button>
          </div>
        </div>
        {isExpanded && node.children.map((child: any, idx: number) => renderNode(child, `${pathPrefix}.${idx + 1}`))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-start">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-xl font-black font-headline flex items-center gap-2 text-slate-900">
            <FolderTree className="h-6 w-6 text-primary" />
            {isRtl ? 'قاموس بنود العمل' : 'Work Items Master'}
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sovereign WBS Registry</p>
        </div>
        <Button 
          onClick={() => setEditingNode({ nodeType: 'section', level: 0, parentId: null, title: '', code: '', order: treeData.length })}
          className="h-10 px-6 rounded-lg shadow-md hover:scale-105 transition-all"
        >
          <Plus className="me-2 h-4 w-4" /> {isRtl ? 'قسم جديد' : 'New Section'}
        </Button>
      </div>

      <Card className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50/50 border-b p-4">
            <div className="relative w-full max-w-xs">
               <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
               <Input 
                 placeholder={t('search')} 
                 className="ps-9 h-10 rounded-xl border-slate-200 bg-white font-bold text-sm" 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
         </CardHeader>
         <CardContent className="p-6 space-y-2 max-h-[70vh] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                 <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Indexing Tree...</p>
              </div>
            ) : treeData.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl opacity-40 flex flex-col items-center gap-4">
                 <Info className="h-8 w-8 text-slate-300" />
                 <p className="font-black text-lg text-slate-400">{isRtl ? 'القاموس فارغ' : 'Registry is Empty'}</p>
              </div>
            ) : (
              treeData.map((node, i) => renderNode(node, (i + 1).toString()))
            )}
         </CardContent>
      </Card>

      <Dialog open={!!editingNode} onOpenChange={open => !open && setEditingNode(null)}>
         <DialogContent className="rounded-2xl p-0 overflow-hidden max-w-lg border-0 shadow-2xl bg-white" dir={dir}>
            <div className="bg-primary/5 p-6 text-slate-900 text-start border-b">
               <DialogTitle className="text-xl font-black font-headline flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  {editingNode?.id ? (isRtl ? 'تعديل بيانات العقدة' : 'Edit Node') : (isRtl ? 'إضافة فرع جديد' : 'Add New Branch')}
               </DialogTitle>
               <Badge className="mt-2 bg-primary/10 text-primary uppercase text-[8px] font-black px-3 py-1 rounded-full border-0">{editingNode?.nodeType}</Badge>
            </div>

            <div className="p-6 space-y-4 text-start bg-white max-h-[60vh] overflow-y-auto scrollbar-hide">
               {editingNode && editingNode.parentId === null && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-bold uppercase text-slate-400">{t('code')}</Label>
                       <Input 
                         value={editingNode?.code || ''} 
                         onChange={e => setEditingNode({...editingNode!, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} 
                         className="h-10 rounded-xl border-2 font-mono font-bold text-primary" 
                       />
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-bold uppercase text-slate-400">{t('order')}</Label>
                       <Input 
                         type="number" 
                         value={editingNode?.order || 0} 
                         onChange={e => setEditingNode({...editingNode!, order: Number(e.target.value)})} 
                         className="h-10 rounded-xl border-2 font-bold text-center" 
                       />
                    </div>
                  </div>
               )}

               <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">{isRtl ? 'المسمى السيادي' : 'Sovereign Title'}</Label>
                  <Input 
                    value={editingNode?.title || ''} 
                    onChange={e => setEditingNode({...editingNode!, title: e.target.value})} 
                    className="h-11 rounded-xl border-2 font-bold text-base bg-slate-50/30" 
                  />
               </div>

               {editingNode?.nodeType === 'work_item' && (
                 <div className="space-y-4 animate-in slide-in-from-top-2">
                    <div className="p-5 rounded-2xl bg-slate-50/50 border-2 border-slate-100 space-y-4">
                       <h4 className="font-black text-[9px] text-primary uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                          <Settings2 className="h-3 w-3" /> {isRtl ? 'المعايير التنفيذية' : 'Execution Parameters'}
                       </h4>
                       
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-slate-400">{t('unitTypes')}</Label>
                          <Select 
                             value={editingNode.unitTypeId} 
                             onValueChange={v => {
                                const unit = unitTypes?.find(ut => ut.id === v);
                                setEditingNode({
                                   ...editingNode, 
                                   unitTypeId: v, 
                                   unitName: unit?.name,
                                   unitSymbol: unit?.symbol
                                });
                             }}
                          >
                             <SelectTrigger className="h-10 rounded-lg border-2 bg-white font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl border-0 shadow-2xl">
                                {unitTypes?.map(ut => <SelectItem key={ut.id} value={ut.id!} className="font-bold text-xs">{isRtl ? ut.name : ut.nameEn} ({ut.symbol})</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>

                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-slate-400">{isRtl ? 'الوصف الهندسي' : 'Description'}</Label>
                          <Textarea 
                             value={editingNode.description || ''} 
                             onChange={e => setEditingNode({...editingNode, description: e.target.value})}
                             className="min-h-[80px] rounded-xl bg-white border-2 text-xs font-bold leading-relaxed" 
                          />
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t">
               <Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-12 rounded-xl font-bold shadow-lg gap-2 border-b-4 border-orange-700">
                  {loadingAction === 'save' ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {t('save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
