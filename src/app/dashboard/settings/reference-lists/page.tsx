'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Loader2, Search, ArrowRight, 
  Trash2, Edit3, ShieldCheck, ListTree,
  Filter, CheckCircle2, X, XCircle,
  LayoutGrid, DollarSign, Clock, Package, Scale, CreditCard,
  Save, Percent, Info
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
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export default function ReferenceListsPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, isRtl, tSafe } = useLanguage();
  const { check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [activeTab, setActiveTab] = useState<ReferenceListType>('unitTypes');
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<Partial<BaseReferenceList> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const canEdit = check('ref', 'edit').can;
  const canCreate = check('ref', 'create').can;
  const canDelete = check('ref', 'delete').can;

  const listQuery = useMemo(() => {
    if (!companyId || !db) return null;
    let path = '';
    const pathFn = paths[activeTab as keyof typeof paths];
    if (pathFn && typeof pathFn === 'function') {
      path = (pathFn as Function)(companyId);
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
      toast({ title: t('common.saved') });
      setEditingItem(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!service || !deletingId) return;
    setLoadingAction(`delete_${deletingId}`);
    try {
      await service.delete(activeTab, deletingId);
      toast({ title: t('common.deleted') });
      setDeletingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const menuItems: { id: ReferenceListType, label: string, icon: any, color: string }[] = [
    { id: 'unitTypes', label: tSafe('unitTypes', 'وحدات القياس', 'Unit Types'), icon: Scale, color: 'text-blue-600' },
    { id: 'paymentMethods', label: tSafe('paymentMethods', 'طرق الدفع', 'Payment Methods'), icon: CreditCard, color: 'text-emerald-600' },
    { id: 'paymentConditionTypes', label: tSafe('paymentConditionTypes', 'شروط الدفع', 'Payment Conditions'), icon: DollarSign, color: 'text-amber-600' },
    { id: 'milestoneTimingTypes', label: tSafe('milestoneTimingTypes', 'توقيت الدفعات', 'Milestone Timing'), icon: Clock, color: 'text-indigo-600' },
    { id: 'itemCategories', label: tSafe('itemCategories', 'تصنيفات المواد', 'Material Categories'), icon: Package, color: 'text-orange-600' },
    { id: 'costTypeCategories', label: tSafe('costTypeCategories', 'أنواع التكاليف', 'Cost Categories'), icon: LayoutGrid, color: 'text-rose-600' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100 text-start">
        <div className="flex items-center gap-4 text-start">
           <Button variant="ghost" onClick={() => router.push('/dashboard/settings')} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50 transition-all">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
             <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
                <ListTree className="h-10 w-10 text-primary" />
                {t('referenceLists')}
             </h1>
             <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic text-start">
                {isRtl ? 'تخصيص القواميس المرجعية والوحدات التشغيلية للمنظمة.' : 'Customize reference dictionaries and operational units.'}
             </p>
           </div>
        </div>
        
        {canCreate && (
           <Button 
             onClick={() => setEditingItem({ name: '', nameEn: '', code: '', order: items.length + 1, isActive: true, isEditable: true, isSystem: false })}
             className="bg-primary text-white font-black rounded-2xl px-10 py-8 text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700"
           >
              <Plus className="h-7 w-7" />
              {tSafe('inline.addNewItem', 'إضافة بند جديد', 'Add New Item')}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-3 space-y-4 text-start">
           <div className="bg-white rounded-[2rem] shadow-xl border-2 border-slate-50 p-3 space-y-2">
              {menuItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <div 
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setSearchTerm(""); }}
                    className={cn(
                      "p-4 rounded-xl cursor-pointer transition-all flex items-center gap-4 group",
                      isActive 
                        ? "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white shadow-lg shadow-orange-500/30 scale-[1.02] border-0" 
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
           </div>
        </div>

        <div className="lg:col-span-9 space-y-6">
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <div className="relative w-full max-w-md text-start">
                    <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input 
                      placeholder={t('common.search')} 
                      className="ps-12 rounded-2xl h-14 bg-white border-2 border-slate-100 font-bold" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto text-start">
                 <Table>
                    <TableHeader className="bg-muted/30">
                       <TableRow>
                          <TableHead className="py-6 ps-8 text-start">{t('common.name')}</TableHead>
                          <TableHead className="text-start">{t('common.code')}</TableHead>
                          <TableHead className="text-center">{tSafe('order', 'الترتيب', 'Order')}</TableHead>
                          <TableHead className="text-start">{t('common.status')}</TableHead>
                          <TableHead className="pe-8 text-end">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {loading ? (
                         <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                       ) : filtered.length === 0 ? (
                         <TableRow><TableCell colSpan={5} className="text-center py-32 italic text-slate-400 font-bold">{isRtl ? 'لا توجد نتائج مطابقة.' : 'No items found.'}</TableCell></TableRow>
                       ) : (
                         filtered.map((item) => (
                           <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-b-slate-100 group">
                              <TableCell className="py-6 ps-8 text-start">
                                 <div className="flex flex-col text-start">
                                    <span className="font-black text-slate-800">{isRtl ? item.name : (item.nameEn || item.name)}</span>
                                    {item.description && <span className="text-[10px] text-slate-400 font-bold line-clamp-1 max-w-[200px]">{item.description}</span>}
                                 </div>
                              </TableCell>
                              <TableCell className="text-start">
                                 <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-primary font-black uppercase">{item.code}</code>
                              </TableCell>
                              <TableCell className="text-center font-bold text-slate-400">#{item.order}</TableCell>
                              <TableCell className="text-start">
                                 <div className="flex flex-wrap gap-2">
                                    {item.isSystem && <Badge className="bg-slate-900 text-white text-[8px] font-black uppercase">{tSafe('inline.system', 'النظام', 'SYSTEM')}</Badge>}
                                    {item.isActive ? (
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-black uppercase">{tSafe('inline.active', 'نشط', 'ACTIVE')}</Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 text-[8px] font-black uppercase">{tSafe('inline.inactive', 'غير نشط', 'INACTIVE')}</Badge>
                                    )}
                                 </div>
                              </TableCell>
                              <TableCell className="pe-8 text-end">
                                 <div className="flex justify-end gap-2">
                                    {canEdit && (
                                       <Button variant="outline" size="icon" onClick={() => setEditingItem(item)} className="rounded-xl h-10 w-10 text-primary border-primary/10 hover:bg-primary hover:text-white transition-all">
                                          <Edit3 className="h-4 w-4" />
                                       </Button>
                                    )}
                                    {canDelete && item.isEditable && (
                                       <Button variant="ghost" size="icon" onClick={() => setDeletingId(item.id!)} className="rounded-xl h-10 w-10 text-rose-300 hover:text-rose-600 hover:bg-rose-50">
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
      </div>

      <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-primary p-10 text-white text-start">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-3">
                  <Edit3 className="h-9 w-9 text-white" />
                  {editingItem?.id ? t('common.edit') : t('common.add')}
               </DialogTitle>
               <p className="text-white/80 font-bold mt-2 uppercase text-xs tracking-widest">{t(activeTab)}</p>
            </div>
            
            <div className="p-10 space-y-6 text-start bg-white max-h-[70vh] overflow-y-auto scrollbar-hide">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400">{t('common.code')}</Label>
                     <Input 
                       value={editingItem?.code || ''} 
                       onChange={e => setEditingItem({...editingItem, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} 
                       disabled={!!editingItem?.id && !editingItem.isEditable}
                       className="h-12 rounded-xl border-2 font-mono font-black text-primary" 
                     />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400">{tSafe('order', 'الترتيب', 'Order')}</Label>
                     <Input 
                       type="number" 
                       value={editingItem?.order || 0} 
                       onChange={e => setEditingItem({...editingItem, order: Number(e.target.value)})} 
                       className="h-12 rounded-xl border-2 font-black" 
                     />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">{tSafe('common.nameAr', 'الاسم (AR)', 'Name (AR)')}</Label>
                  <Input 
                    value={editingItem?.name || ''} 
                    onChange={e => setEditingItem({...editingItem, name: e.target.value})} 
                    className="h-12 rounded-xl border-2 font-black" 
                  />
               </div>

               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">{tSafe('common.nameEn', 'الاسم (EN)', 'Name (EN)')}</Label>
                  <Input 
                    value={editingItem?.nameEn || ''} 
                    onChange={e => setEditingItem({...editingItem, nameEn: e.target.value})} 
                    className="h-12 rounded-xl border-2 font-bold text-start" 
                    dir="ltr"
                  />
               </div>

               <div className="flex items-center justify-between p-6 bg-emerald-50/50 rounded-2xl border-2 border-white">
                  <div className="space-y-1">
                     <Label className="font-black text-emerald-900">{t('common.isActive')}</Label>
                     <p className="text-[10px] text-emerald-600 font-bold">{isRtl ? 'إتاحة العنصر للاستخدام في القوائم.' : 'Make item available in select lists.'}</p>
                  </div>
                  <Switch 
                    checked={editingItem?.isActive !== false} 
                    onCheckedChange={v => setEditingItem({...editingItem!, isActive: v})} 
                  />
               </div>
            </div>

            <DialogFooter className="p-10 bg-slate-50 border-t">
               <Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-3 border-b-8 border-orange-700">
                  {loadingAction === 'save' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6 me-2" />}
                  {t('common.save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-6 ring-8 ring-rose-50/50">
                <Trash2 className="h-10 w-10" />
             </div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{t('common.confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-2 text-lg">
                {isRtl ? 'هل أنت متأكد من حذف هذا العنصر؟ قد يؤثر ذلك على البيانات التاريخية المرتبطة به.' : 'Are you sure? Deleting this item may affect historical records linked to it.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white text-slate-600">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="flex-[2] h-14 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200">
               {isRtl ? 'نعم، احذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
