'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Loader2, Search, 
  Trash2, Edit3, ShieldCheck,
  Scale, CreditCard, DollarSign, Clock, Package, LayoutGrid,
  Save, X, RefreshCcw, DownloadCloud, ListPlus, Star
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { ReferenceListService, ReferenceListType } from '@/services/reference-list-service';
import { BaseReferenceList } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { toast } from '@/hooks/use-toast';

export default function GeneralListsPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // States
  const [activeTab, setActiveTab] = useState<ReferenceListType>('unitTypes');
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<Partial<BaseReferenceList> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [customLists, setCustomLists] = useState<any[]>([]);
  
  // Custom List Creator State
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListForm, setNewListForm] = useState({ name: '', nameEn: '', code: '' });

  // Permissions
  const canEdit = check('ref', 'edit').can;
  const canCreate = check('ref', 'create').can;
  const canDelete = check('ref', 'delete').can;

  // Data Fetching
  const listQuery = useMemo(() => {
    if (!companyId || !db) return null;
    let path = '';
    if (paths[activeTab as keyof typeof paths] && typeof paths[activeTab as keyof typeof paths] === 'function') {
      path = (paths[activeTab as keyof typeof paths] as Function)(companyId);
    } else {
      path = `companies/${companyId}/customReferenceLists/${activeTab}/items`;
    }
    return query(collection(db, path), orderBy('order'));
  }, [db, companyId, activeTab]);

  const { data: rawItems, loading } = useCollection<BaseReferenceList>(listQuery);
  const items = rawItems || [];

  const service = useMemo(() => 
    db && companyId ? new ReferenceListService(db, companyId) : null, 
  [db, companyId]);

  useEffect(() => {
    if (service) {
      service.getCustomListsMetadata().then(setCustomLists);
    }
  }, [service, isAddingList]);

  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSave = async () => {
    if (!service || !user || !editingItem?.name || !editingItem.code) return;
    setLoadingAction('save');
    try {
      if (editingItem.id) {
        await service.update(activeTab, editingItem.id, editingItem, user.uid);
      } else {
        await service.add(activeTab, editingItem, user.uid);
      }
      toast({ title: t('saved') });
      setEditingItem(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!service || !deletingId) return;
    setLoadingAction(`delete_${deletingId}`);
    try {
      await service.delete(activeTab, deletingId);
      toast({ title: t('deleted') });
      setDeletingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateNewList = async () => {
    if (!service || !user || !newListForm.name || !newListForm.code) return;
    setLoadingAction('create_list');
    try {
      await service.createCustomList({
        ...newListForm,
        code: newListForm.code.toUpperCase().replace(/\s+/g, '_'),
        order: (6 + customLists.length + 1)
      }, user.uid);
      toast({ title: isRtl ? "تم إنشاء القائمة الجديدة" : "New list created" });
      setIsAddingList(false);
      setNewListForm({ name: '', nameEn: '', code: '' });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePullDefaults = async () => {
    if (!service || !user) return;
    setLoadingAction('seeding');
    try {
      await service.seedAllLists(user.uid);
      toast({ title: isRtl ? "تم سحب البيانات الافتراضية بنجاح" : "System defaults pulled successfully" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadCSV = () => {
    if (items.length === 0) return;
    const headers = ["Code", "Name (AR)", "Order", "Is Active"];
    const rows = items.map(it => [it.code, it.name, it.order, it.isActive]);
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NovaFlow_${activeTab}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const staticMenuItems: { id: ReferenceListType, label: string, icon: any, color: string }[] = [
    { id: 'unitTypes', label: t('unitTypes'), icon: Scale, color: 'text-blue-600' },
    { id: 'paymentMethods', label: t('paymentMethods'), icon: CreditCard, color: 'text-emerald-600' },
    { id: 'paymentConditionTypes', label: t('paymentConditionTypes'), icon: DollarSign, color: 'text-amber-600' },
    { id: 'milestoneTimingTypes', label: t('milestoneTimingTypes'), icon: Clock, color: 'text-indigo-600' },
    { id: 'itemCategories', label: t('itemCategories'), icon: Package, color: 'text-orange-600' },
    { id: 'costTypeCategories', label: t('costTypeCategories'), icon: LayoutGrid, color: 'text-rose-600' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500">
      
      {/* Navigation Sidebar */}
      <div className="lg:col-span-3 space-y-4 text-start">
         <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 py-2">{isRtl ? 'القوائم الأساسية' : 'Main Lists'}</p>
            {staticMenuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSearchTerm(""); }}
                  className={cn(
                    "p-4 rounded-xl cursor-pointer transition-all flex items-center gap-4 group",
                    isActive 
                      ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                      : "hover:bg-slate-50 border-2 border-transparent"
                  )}
                >
                   <div className={cn(
                     "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                     isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-primary"
                   )}>
                      <item.icon className="h-5 w-5" />
                   </div>
                   <span className={cn(
                     "text-sm font-black transition-colors",
                     isActive ? "text-white" : "text-slate-500"
                   )}>{item.label}</span>
                </div>
              );
            })}

            {canCreate && (
              <Dialog open={isAddingList} onOpenChange={setIsAddingList}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full mt-6 h-14 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 font-black text-xs gap-2"
                  >
                    <ListPlus className="h-5 w-5" />
                    {isRtl ? 'قائمة مرجعية جديدة' : 'New Main List'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-xl p-8 max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
                  <DialogHeader className="text-start">
                    <DialogTitle className="font-black text-2xl flex items-center gap-3">
                       <ListPlus className="h-6 w-6 text-primary" />
                       {isRtl ? 'إنشاء قائمة مرجعية جديدة' : 'New Reference List'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-6 text-start">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'الاسم (عربي)' : 'Name (AR)'}</Label>
                      <Input value={newListForm.name} onChange={e => setNewListForm({...newListForm, name: e.target.value})} className="h-11 border-2" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'الاسم (English)' : 'Name (EN)'}</Label>
                      <Input value={newListForm.nameEn} onChange={e => setNewListForm({...newListForm, nameEn: e.target.value})} className="h-11 border-2 text-start" dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'الكود التعريفي' : 'List Code'}</Label>
                      <Input value={newListForm.code} onChange={e => setNewListForm({...newListForm, code: e.target.value.toUpperCase()})} placeholder="e.g. NATIONALITIES" className="h-11 border-2 font-mono font-black" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateNewList} disabled={loadingAction === 'create_list'} className="w-full h-12">
                      {loadingAction === 'create_list' ? <Loader2 className="animate-spin" /> : (isRtl ? 'إنشاء القائمة' : 'Create List')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
         </div>
      </div>

      {/* Content Area */}
      <div className="lg:col-span-9 space-y-6">
         <Card className="border-0 shadow-lg rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="relative w-full max-w-sm">
                  <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    placeholder={t('search')} 
                    className="ps-12 h-11 bg-white border-slate-200 font-bold" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
               <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCSV}
                    disabled={items.length === 0}
                    className="h-11 border-2 font-black gap-2"
                  >
                     <DownloadCloud className="h-4 w-4" />
                  </Button>
                  
                  {canCreate && (
                    <Button 
                      onClick={() => setEditingItem({ name: '', nameEn: '', code: '', order: items.length + 1, isActive: true, isEditable: true, isSystem: false })}
                      variant="default"
                      className="h-11 px-6 shadow-lg shadow-primary/20 flex items-center gap-2"
                    >
                        <Plus className="h-5 w-5" />
                        {isRtl ? 'إضافة بند' : 'Add Entry'}
                    </Button>
                  )}
               </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
               <Table>
                  <TableHeader className="bg-muted/30">
                     <TableRow>
                        <TableHead className="py-6 ps-8 text-start">{t('name')}</TableHead>
                        <TableHead className="text-start">{t('code')}</TableHead>
                        <TableHead className="text-center">{t('order')}</TableHead>
                        <TableHead className="text-start">{t('status')}</TableHead>
                        <TableHead className="pe-8 text-end">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {loading ? (
                       <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                     ) : filtered.length === 0 ? (
                       <TableRow><TableCell colSpan={5} className="text-center py-24 italic text-slate-300 font-bold">{isRtl ? 'لا توجد بيانات.' : 'No items found.'}</TableCell></TableRow>
                     ) : (
                       filtered.map((item) => (
                         <TableRow key={item.id} className="hover:bg-primary/5 transition-colors group">
                            <TableCell className="py-6 ps-8 text-start">
                               <div className="flex flex-col">
                                  <span className="font-black text-slate-800">{isRtl ? item.name : (item.nameEn || item.name)}</span>
                               </div>
                            </TableCell>
                            <TableCell className="text-start">
                               <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-primary font-black">{item.code}</code>
                            </TableCell>
                            <TableCell className="text-center font-bold text-slate-400">#{item.order}</TableCell>
                            <TableCell className="text-start">
                               {item.isActive ? (
                                 <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-black uppercase">ACTIVE</Badge>
                               ) : (
                                 <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 text-[8px] font-black uppercase">INACTIVE</Badge>
                               )}
                            </TableCell>
                            <TableCell className="pe-8 text-end">
                               <div className="flex justify-end gap-2">
                                  {canEdit && (
                                     <Button variant="outline" size="icon" onClick={() => setEditingItem(item)} className="h-9 w-9 text-primary border-primary/20">
                                        <Edit3 className="h-4 w-4" />
                                     </Button>
                                  )}
                                  {canDelete && item.isEditable && (
                                     <Button variant="ghost" size="icon" onClick={() => setDeletingId(item.id!)} className="h-9 w-9 text-rose-500">
                                        <Trash2 className="h-4 w-4" />
                                     </Button>
                                  )}
                               </div>
                            </TableCell>
                         </TableRow>
                       ))
                     )}
                  </TableBody>
               </Table>
            </CardContent>
         </Card>
      </div>

      {/* Editor Dialog */}
      <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
         <DialogContent className="rounded-xl p-0 overflow-hidden max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-primary p-8 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <Edit3 className="h-8 w-8 text-white" />
                  {editingItem?.id ? (isRtl ? 'تعديل بند' : 'Edit Entry') : (isRtl ? 'إضافة بند جديد' : 'Add Entry')}
               </DialogTitle>
            </div>
            
            <div className="p-10 space-y-6 text-start bg-white">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400">{t('code')}</Label>
                     <Input 
                       value={editingItem?.code || ''} 
                       onChange={e => setEditingItem({...editingItem, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} 
                       disabled={!!editingItem?.id && !editingItem.isEditable}
                       className="h-11 border-2 font-mono font-black" 
                     />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400">{t('order')}</Label>
                     <Input 
                       type="number" 
                       value={editingItem?.order || 0} 
                       onChange={e => setEditingItem({...editingItem, order: Number(e.target.value)})} 
                       className="h-11 border-2" 
                     />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">{t('name')} (AR)</Label>
                  <Input value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-11 border-2" />
               </div>

               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">{t('name')} (EN)</Label>
                  <Input value={editingItem?.nameEn || ''} onChange={e => setEditingItem({...editingItem, nameEn: e.target.value})} className="h-11 border-2 text-start" dir="ltr" />
               </div>

               <div className="flex items-center justify-between p-6 bg-slate-50 rounded-xl border-2">
                  <Label className="font-black text-slate-700">{t('isActive')}</Label>
                  <Switch checked={editingItem?.isActive !== false} onCheckedChange={v => setEditingItem({...editingItem, isActive: v})} />
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-12 rounded-xl">
                  {loadingAction === 'save' ? <Loader2 className="animate-spin" /> : <Save className="h-5 w-5 me-2" />}
                  {t('save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
