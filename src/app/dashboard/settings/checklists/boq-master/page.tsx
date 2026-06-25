
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FolderTree, Plus, Loader2, Search, 
  Trash2, Edit3, ShieldCheck, LayoutGrid,
  Boxes, Hammer, ChevronRight, ChevronDown,
  Info, Save, X, Layers, ListChecks
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
  const { check, permissions } = usePermissions(); // تم جلب permissions هنا
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<Partial<BOQWorkItemMasterNode> | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);

  const canEdit = check('ref', 'edit').can;

  // جلب البيانات مع تثبيت الاستعلام لضمان استقرار الواجهة
  const nodesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.boqWorkItemsMaster(companyId)), orderBy('level'), orderBy('order')) : null, 
  [db, companyId]);

  const unitTypesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.unitTypes(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: rawNodes, loading } = useCollection<BOQWorkItemMasterNode>(nodesQuery);
  const { data: unitTypes } = useCollection<UnitType>(unitTypesQuery);

  // تم تمرير permissions هنا لحل مشكلة UNAUTHORIZED_ACTION
  const service = useMemo(() => 
    db && companyId ? new BOQMasterService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const treeData = useMemo(() => {
    const nodes = rawNodes || [];
    const buildTree = (parentId: string | null): any[] => {
      return nodes
        .filter(n => n.parentId === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(n => ({
          ...n,
          children: buildTree(n.id!)
        }));
    };
    return buildTree(null);
  }, [rawNodes]);

  const handleSave = async () => {
    if (!service || !user || !editingNode?.title || !editingNode.code) return;
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
      toast({ 
        variant: "destructive", 
        title: t('error'), 
        description: e.message 
      });
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

  const renderNode = (node: any) => {
    const isExpanded = expandedNodes.includes(node.id);
    const hasChildren = node.childrenCount > 0;

    return (
      <div key={node.id} className="space-y-1">
        <div 
          className={cn(
            "flex items-center justify-between p-3 rounded-xl border-2 transition-all group",
            node.nodeType === 'section' ? "bg-slate-900 text-white border-slate-800" :
            node.nodeType === 'main_category' ? "bg-slate-50 border-slate-100 ms-4" :
            node.nodeType === 'component' ? "bg-white border-slate-50 ms-8" : "bg-white border-dashed border-slate-100 ms-12"
          )}
        >
          <div className="flex items-center gap-3">
             <div onClick={() => toggleNode(node.id)} className="cursor-pointer">
                {hasChildren ? (
                   isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                ) : <div className="w-4" />}
             </div>
             {getNodeIcon(node.nodeType)}
             <div className="text-start">
                <span className="text-xs font-black">{node.title}</span>
                <span className="text-[9px] font-mono opacity-40 ms-2">[{node.code}]</span>
                {node.nodeType === 'work_item' && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[8px] ms-2 bg-white text-primary uppercase border-primary/20">
                    {node.unitSymbol || node.unitName}
                  </Badge>
                )}
             </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
             {node.nodeType !== 'work_item' && canEdit && (
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-8 w-8 text-primary"
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
                 <Plus className="h-4 w-4" />
               </Button>
             )}
             <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400" onClick={() => setEditingNode(node)}><Edit3 className="h-4 w-4" /></Button>
             <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-rose-400" 
                disabled={node.childrenCount > 0 || loadingAction?.startsWith('delete')}
                onClick={() => handleDelete(node.id)}
             >
                <Trash2 className="h-4 w-4" />
             </Button>
          </div>
        </div>
        {isExpanded && node.children.map((child: any) => renderNode(child))}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-start">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-2xl font-black font-headline flex items-center gap-3">
            <FolderTree className="h-7 w-7 text-primary" />
            {isRtl ? 'قاموس بنود العمل الشجري' : 'Work Items Master Tree'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Single Source of Engineering Truth</p>
        </div>
        <Button 
          onClick={() => setEditingNode({ nodeType: 'section', level: 0, parentId: null, title: '', code: '', order: treeData.length })}
          className="h-11 px-8 rounded-xl shadow-lg"
        >
          <Plus className="me-2 h-5 w-5" /> {isRtl ? 'إضافة قسم جذري' : 'New Section'}
        </Button>
      </div>

      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50/50 border-b p-6">
            <div className="relative w-full max-w-sm">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
               <Input 
                 placeholder={t('search')} 
                 className="ps-12 rounded-xl h-11 border-slate-200" 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
         </CardHeader>
         <CardContent className="p-8 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                 <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
                 <p className="text-[10px] font-black text-slate-300 uppercase">Indexing Tree...</p>
              </div>
            ) : treeData.length === 0 ? (
              <div className="py-20 text-center border-4 border-dashed rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
                 <Info className="h-12 w-12" />
                 <p className="font-black text-xl">{isRtl ? 'القاموس فارغ حالياً' : 'Tree is Empty'}</p>
              </div>
            ) : (
              treeData.map(renderNode)
            )}
         </CardContent>
      </Card>

      {/* Node Editor Dialog */}
      <Dialog open={!!editingNode} onOpenChange={open => !open && setEditingNode(null)}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-900 p-10 text-white text-start">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                  <ShieldCheck className="h-9 w-9 text-primary" />
                  {editingNode?.id ? (isRtl ? 'تعديل بيانات العقدة' : 'Edit Node') : (isRtl ? 'إضافة فرع جديد' : 'Add New Branch')}
               </DialogTitle>
               <Badge className="mt-4 bg-primary text-white uppercase text-[10px] px-4 py-1 rounded-full">{editingNode?.nodeType}</Badge>
            </div>

            <div className="p-10 space-y-6 text-start bg-white max-h-[60vh] overflow-y-auto scrollbar-hide">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{t('code')}</Label>
                     <Input 
                       value={editingNode?.code || ''} 
                       onChange={e => setEditingNode({...editingNode!, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} 
                       className="h-12 rounded-xl border-2 font-mono font-black text-primary" 
                     />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{t('order')}</Label>
                     <Input 
                       type="number" 
                       value={editingNode?.order || 0} 
                       onChange={e => setEditingNode({...editingNode!, order: Number(e.target.value)})} 
                       className="h-12 rounded-xl border-2 font-black" 
                     />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المسمى السيادي' : 'Sovereign Title'}</Label>
                  <Input 
                    value={editingNode?.title || ''} 
                    onChange={e => setEditingNode({...editingNode!, title: e.target.value})} 
                    className="h-14 rounded-xl border-2 font-black text-lg" 
                  />
               </div>

               {editingNode?.nodeType === 'work_item' && (
                 <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner space-y-6">
                       <h4 className="font-black text-xs text-primary uppercase tracking-widest border-b pb-2">{isRtl ? 'البيانات التنفيذية والفوترة' : 'Execution & Billing Data'}</h4>
                       
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-400">{t('unitTypes')}</Label>
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
                                <SelectTrigger className="h-11 rounded-xl border-2 bg-white font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   {unitTypes?.map(ut => <SelectItem key={ut.id} value={ut.id!} className="font-bold text-xs py-3">{isRtl ? ut.name : ut.nameEn} ({ut.symbol})</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'مجموعة الفوترة' : 'Billing Group'}</Label>
                             <Input 
                                value={editingNode.billingTriggerGroup || ''} 
                                onChange={e => setEditingNode({...editingNode, billingTriggerGroup: e.target.value})}
                                className="h-11 rounded-xl border-2 bg-white"
                             />
                          </div>
                       </div>

                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الوصف الهندسي' : 'Technical Description'}</Label>
                          <Textarea 
                             value={editingNode.description || ''} 
                             onChange={e => setEditingNode({...editingNode, description: e.target.value})}
                             className="min-h-[100px] rounded-2xl bg-white border-2 text-xs" 
                          />
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <DialogFooter className="p-10 bg-slate-50 border-t">
               <Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-3 border-b-8 border-orange-700">
                  {loadingAction === 'save' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                  {t('save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
