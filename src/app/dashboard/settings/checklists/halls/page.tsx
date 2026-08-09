'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Landmark, Plus, Loader2, Search, 
  Trash2, Edit3, Save, X, AlertTriangle, Users
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { MeetingRoom } from '@/types/reference';
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

export default function HallsManagementPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<Partial<MeetingRoom> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const canEdit = check('ref', 'edit').can;
  const canCreate = check('ref', 'create').can;
  const canDelete = check('ref', 'delete').can;

  const listQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.meetingRooms(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: items, loading } = useCollection<MeetingRoom>(listQuery);

  const filtered = (items || []).filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    if (!db || !companyId || !user || !editingItem?.name) return;
    setLoadingAction('save');
    try {
      const path = paths.meetingRooms(companyId);
      const docData = {
        ...editingItem,
        companyId,
        isActive: editingItem.isActive !== false,
        order: editingItem.order ?? 0,
        updatedAt: serverTimestamp()
      };

      if (editingItem.id) {
        await updateDoc(doc(db, path, editingItem.id), docData);
      } else {
        await addDoc(collection(db, path), {
          ...docData,
          createdAt: serverTimestamp()
        });
      }
      toast({ title: t('common.saved') });
      setEditingItem(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!db || !companyId || !deletingId) return;
    setLoadingAction(`delete_${deletingId}`);
    try {
      await deleteDoc(doc(db, paths.meetingRooms(companyId), deletingId));
      toast({ title: t('common.deleted') });
      setDeletingId(null);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-start">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Landmark className="h-7 w-7 text-primary" />
            {isRtl ? 'إدارة قاعات الاجتماعات' : 'Meeting Rooms Registry'}
          </h2>
        </div>
        
        {canCreate && (
           <Button 
             onClick={() => setEditingItem({ name: '', nameEn: '', capacity: 10, order: items.length + 1, isActive: true })}
             className="h-11 px-8 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all gap-2"
           >
              <Plus className="h-5 w-5" /> {isRtl ? 'إضافة قاعة جديدة' : 'Add New Room'}
           </Button>
        )}
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-6">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input placeholder={t('common.search')} className="ps-12 h-11 bg-white border-slate-200 font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{t('common.name')}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الاسم (إنجليزي)' : 'Name (EN)'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'السعة' : 'Capacity'}</TableHead>
                <TableHead className="text-center">{t('order')}</TableHead>
                <TableHead className="text-start">{t('common.status')}</TableHead>
                <TableHead className="pe-8 text-end">{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20 italic text-slate-300 font-bold">{t('common.noResults')}</TableCell></TableRow>
              ) : (
                filtered.map((room) => (
                  <TableRow key={room.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="py-6 ps-8 text-start font-black text-slate-800">{room.name}</TableCell>
                    <TableCell className="text-start font-bold text-slate-500">{room.nameEn}</TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="font-black text-[10px] gap-1.5 px-3 py-1 border-2 border-slate-100 bg-white">
                          <Users className="h-3 w-3 text-primary" /> {room.capacity || '---'}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center font-black text-slate-400">#{room.order}</TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn("text-[8px] font-black uppercase border-0 shadow-sm", room.isActive ? "bg-emerald-500 text-white" : "bg-slate-300 text-white")}>
                          {room.isActive ? 'Active' : 'Inactive'}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                       <div className="flex justify-end gap-2">
                          {canEdit && (
                             <Button variant="outline" size="icon" onClick={() => setEditingItem(room)} className="rounded-xl h-10 w-10 text-primary border-primary/10 hover:bg-primary hover:text-white transition-all"><Edit3 className="h-4 w-4" /></Button>
                          )}
                          {canDelete && (
                             <Button variant="ghost" size="icon" onClick={() => setDeletingId(room.id!)} className="rounded-xl h-10 w-10 text-rose-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
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

      <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
         <DialogContent className="rounded-xl p-0 overflow-hidden max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-primary p-8 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <Landmark className="h-8 w-8 text-white" />
                  {editingItem?.id ? t('edit') : t('common.add')}
               </DialogTitle>
            </div>
            
            <div className="p-10 space-y-6 text-start bg-white">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400">{t('common.nameAr')}</Label>
                     <Input value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem!, name: e.target.value})} className="h-12 rounded-xl border-2 font-black" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400">{t('common.nameEn')}</Label>
                     <Input value={editingItem?.nameEn || ''} onChange={e => setEditingItem({...editingItem!, nameEn: e.target.value})} className="h-12 rounded-xl border-2 font-black text-start" dir="ltr" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'السعة الاستيعابية' : 'Capacity'}</Label>
                     <Input type="number" value={editingItem?.capacity || 0} onChange={e => setEditingItem({...editingItem!, capacity: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-slate-400">{t('order')}</Label>
                     <Input type="number" value={editingItem?.order || 0} onChange={e => setEditingItem({...editingItem!, order: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black" />
                  </div>
               </div>

               <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border-2">
                  <Label className="font-black text-slate-700">{t('common.isActive')}</Label>
                  <Switch checked={editingItem?.isActive !== false} onCheckedChange={v => setEditingItem({...editingItem!, isActive: v})} />
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-14 rounded-2xl font-black">
                  {loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('common.save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-6 ring-8 ring-rose-50/50"><Trash2 className="h-10 w-10" /></div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900">{t('common.confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-2 text-lg">
                {isRtl ? 'سيتم حذف القاعة نهائياً من النظام، مما قد يؤدي لإزالة المواعيد التاريخية المرتبطة بها.' : 'This will permanently delete the hall and its historical links.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="flex-[2] h-14 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl">{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
