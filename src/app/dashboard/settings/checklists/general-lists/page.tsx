
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Loader2, Search, 
  Trash2, Edit3, Scale, CreditCard, 
  DollarSign, Clock, Package, LayoutGrid,
  Save, Percent, Filter, Info
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

export default function GeneralListsPage() {
  const { globalUser, user } = useAuthContext();
  const { t, tSafe, lang, dir, isRtl } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
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
    // FIXED: Removed 'this.' to resolve TypeError
    if (paths[activeTab as keyof typeof paths] && typeof paths[activeTab as keyof typeof paths] === 'function') {
      path = (paths[activeTab as keyof typeof paths] as Function)(companyId);
    } else {
      path = `companies/${companyId}/customReferenceLists/${activeTab}/items`;
    }
    return query(collection(db, path), orderBy('order'));
  }, [db, companyId, activeTab]);

  const { data: rawItems, loading } = useCollection<BaseReferenceList>(listQuery);
  const items = rawItems || [];

  const service = useMemo(() => db && companyId ? new ReferenceListService(db, companyId) : null, [db, companyId]);

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
    } finally {
      setLoadingAction(null);
    }
  };

  const staticMenuItems: { id: ReferenceListType, label: string, icon: any }[] = [
    { id: 'unitTypes', label: t('unitTypes'), icon: Scale },
    { id: 'paymentMethods', label: t('paymentMethods'), icon: CreditCard },
    { id: 'paymentConditionTypes', label: t('paymentConditionTypes'), icon: DollarSign },
    { id: 'milestoneTimingTypes', label: t('milestoneTimingTypes'), icon: Clock },
    { id: 'itemCategories', label: t('itemCategories'), icon: Package },
    { id: 'costTypeCategories', label: t('costTypeCategories'), icon: LayoutGrid },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500">
      
      <div className="lg:col-span-3 space-y-4 text-start">
         <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-2 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 py-2">{t('referenceLists')}</p>
            {staticMenuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSearchTerm(""); }}
                  className={cn(
                    "p-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 group",
                    isActive ? "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white shadow-lg" : "hover:bg-slate-50"
                  )}
                >
                   <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all", isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400 group-hover:text-primary")}><item.icon className="h-4 w-4" /></div>
                   <span className="text-xs font-black">{item.label}</span>
                </div>
              );
            })}
         </div>
      </div>

      <div className="lg:col-span-9 space-y-6">
         <Card className="border-0 shadow-lg rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="relative w-full max-w-sm">
                  <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input placeholder={t('common.search')} className="ps-12 h-11 bg-white border-slate-200 font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               </div>
               <div className="flex items-center gap-2">
                  {canCreate && (
                    <Button onClick={() => setEditingItem({ name: '', nameEn: '', code: '', order: items.length + 1, isActive: true, isEditable: true, isSystem: false, feePercentage: 0, feeFixedAmount: 0 })} variant="default" className="h-11 px-6 shadow-lg flex items-center gap-2"><Plus className="h-5 w-5" /> {t('common.add')}</Button>
                  )}
               </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
               <Table>
                  <TableHeader className="bg-muted/30">
                     <TableRow>
                        <TableHead className="py-6 ps-8 text-start">{t('common.name')}</TableHead>
                        <TableHead className="text-start">{t('common.code')}</TableHead>
                        {activeTab === 'paymentMethods' && <TableHead className="text-center">{tSafe('inline.commissions', 'العمولة', 'Commissions')}</TableHead>}
                        <TableHead className="text-center">{t('order')}</TableHead>
                        <TableHead className="text-start">{t('common.status')}</TableHead>
                        <TableHead className="pe-8 text-end">{tSafe('inline.actions', 'إجراءات', 'Actions')}</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {loading ? (
                       <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                     ) : (
                       filtered.map((item) => (
                         <TableRow key={item.id} className="hover:bg-primary/5 transition-colors border-b-slate-100 group">
                            <TableCell className="py-6 ps-8 text-start font-black text-slate-800">{tSafe('data.item.name', item.name, item.nameEn || item.name)}</TableCell>
                            <TableCell className="text-start"><code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-primary font-black uppercase">{item.code}</code></TableCell>
                            {activeTab === 'paymentMethods' && (
                               <TableCell className="text-center">
                                  <div className="flex flex-col items-center gap-1">
                                     <Badge className="bg-blue-50 text-blue-600 border-0 text-[8px] font-black">{item.feePercentage ? (item.feePercentage * 100).toFixed(2) + '%' : '-'}</Badge>
                                     <Badge className="bg-amber-50 text-amber-600 border-0 text-[8px] font-black">{item.feeFixedAmount ? item.feeFixedAmount.toFixed(3) + ' KWD' : '-'}</Badge>
                                  </div>
                               </TableCell>
                            )}
                            <TableCell className="text-center font-bold text-slate-400">#{item.order}</TableCell>
                            <TableCell className="text-start"><Badge className={cn("text-[8px] font-black uppercase border-0", item.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-300 text-white")}>{item.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                            <TableCell className="pe-8 text-end">
                               <div className="flex justify-end gap-2">
                                  {canEdit && <Button variant="outline" size="icon" onClick={() => setEditingItem(item)} className="rounded-xl h-10 w-10 text-primary border-primary/10 hover:bg-primary hover:text-white transition-all"><Edit3 className="h-4 w-4" /></Button>}
                                  {canDelete && item.isEditable && <Button variant="ghost" size="icon" onClick={() => setDeletingId(item.id!)} className="rounded-xl h-10 w-10 text-rose-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>}
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

      <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
         <DialogContent className="rounded-xl p-0 overflow-hidden max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-[#FFA000] p-8 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3"><Edit3 className="h-8 w-8 text-white" /> {editingItem?.id ? t('common.edit') : t('common.add')}</DialogTitle>
            </div>
            <div className="p-10 space-y-6 text-start bg-white">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('common.code')}</Label><Input value={editingItem?.code || ''} onChange={e => setEditingItem({...editingItem, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})} className="h-11 border-2 font-mono font-black" /></div>
                  <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('order')}</Label><Input type="number" value={editingItem?.order === 0 ? '' : (editingItem?.order || '')} onChange={e => setEditingItem({...editingItem, order: e.target.value === '' ? 0 : Number(e.target.value)})} className="h-11 border-2" /></div>
               </div>
               <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('common.name')}</Label><Input value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-11 border-2" /></div>
               
               {activeTab === 'paymentMethods' && (
                  <div className="p-6 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-200 space-y-6">
                     <div className="flex items-center gap-2 text-blue-600 font-black text-xs uppercase tracking-widest">
                        <Percent className="h-4 w-4" /> {tSafe('inline.bank.comm.rules', 'إعدادات عمولات البنوك', 'Bank Commission Rules')}
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('inline.percentage', 'النسبة المئوية (%)', 'Percentage (%)')}</Label>
                           <Input 
                             type="number" 
                             step="0.01" 
                             value={(editingItem?.feePercentage || 0) === 0 ? "" : (editingItem!.feePercentage! * 100)} 
                             onChange={e => {
                                const rawVal = e.target.value === '' ? 0 : Number(e.target.value);
                                setEditingItem({...editingItem!, feePercentage: rawVal / 100});
                             }} 
                             className="h-11 border-2 bg-white font-black" 
                             placeholder="مثال: 2.5"
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('inline.fixed.amount', 'مبلغ ثابت (KWD)', 'Fixed Amount')}</Label>
                           <Input 
                             type="number" 
                             step="0.001" 
                             value={(editingItem?.feeFixedAmount || 0) === 0 ? "" : editingItem?.feeFixedAmount} 
                             onChange={e => setEditingItem({...editingItem!, feeFixedAmount: e.target.value === '' ? 0 : Number(e.target.value)})} 
                             className="h-11 border-2 bg-white font-black" 
                           />
                        </div>
                     </div>
                  </div>
               )}

               <div className="flex items-center justify-between p-6 bg-slate-50 rounded-xl border-2"><Label className="font-black text-slate-700">{t('common.isActive')}</Label><Switch checked={editingItem?.isActive !== false} onCheckedChange={v => setEditingItem({...editingItem!, isActive: v})} /></div>
            </div>
            <div className="p-8 rounded-b-xl bg-slate-50 border-t flex items-start gap-4">
               <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
               <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{tSafe('inline.available.lists', 'إتاحة العنصر للاستخدام في القوائم.', 'Make item available in select lists.')}</p>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t"><Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-12 rounded-xl">{loadingAction === 'save' ? <Loader2 className="animate-spin" /> : <Save className="h-5 w-5 me-2" />}{t('common.save')}</Button></DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-xl p-8" dir={dir}>
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4"><Trash2 className="h-8 w-8" /></div>
            <AlertDialogTitle className="text-start font-black text-2xl">{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start font-bold">
               {tSafe('inline.confirm_delete_msg', 'هل أنت متأكد من حذف هذا العنصر؟ قد يؤثر ذلك على البيانات التاريخية المرتبطة به.', 'Are you sure? This may affect historical data.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4"><AlertDialogCancel className="rounded-xl h-11 border-2">{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white px-8">{t('common.confirm')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
