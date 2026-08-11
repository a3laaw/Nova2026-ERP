'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  LayoutGrid, Plus, Loader2, Search, 
  Trash2, Edit3, Save, Building2, Briefcase
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { CostCenter } from '@/types/cost-profit-centers';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';

export default function CostCentersPage() {
  const { globalUser } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<Partial<CostCenter> | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const centersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.costCenters(companyId)), orderBy('code')) : null, 
  [db, companyId]);

  const projectsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId))) : null, 
  [db, companyId]);

  const { data: centers, loading } = useCollection<CostCenter>(centersQuery);
  const { data: projects } = useCollection<any>(projectsQuery);

  const filtered = (centers || []).filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    if (!db || !companyId || !editingItem?.name || !editingItem.code) return;
    setLoadingAction('save');
    try {
      const path = paths.costCenters(companyId);
      const docData = {
        ...editingItem,
        companyId,
        isActive: editingItem.isActive !== false,
        isAdministrative: !!editingItem.isAdministrative,
        updatedAt: serverTimestamp()
      };

      if (editingItem.id) {
        await updateDoc(doc(db, path, editingItem.id), docData);
      } else {
        await addDoc(collection(db, path), { ...docData, createdAt: serverTimestamp() });
      }
      toast({ title: t('common.saved') });
      setEditingItem(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 text-start" dir={dir}>
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-black font-headline flex items-center gap-3">
          <LayoutGrid className="h-7 w-7 text-primary" />
          {tSafe('inline.cost.centers', 'مراكز التكلفة', 'Cost Centers')}
        </h1>
        <Button onClick={() => setEditingItem({ code: '', name: '', isAdministrative: false, isActive: true })} className="rounded-xl shadow-lg">
          <Plus className="h-5 w-5 me-2" /> {t('common.add')}
        </Button>
      </header>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b">
           <div className="relative max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder={t('common.search')} className="ps-11 h-11 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-5 ps-8 text-start">{t('common.code')}</TableHead>
                <TableHead className="text-start">{t('common.name')}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الارتباط' : 'Link'}</TableHead>
                <TableHead className="text-center">{t('common.status')}</TableHead>
                <TableHead className="pe-8 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-black italic">{t('common.noResults')}</TableCell></TableRow>
              ) : (
                filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                    <TableCell className="py-5 ps-8 font-mono font-black text-primary">{item.code}</TableCell>
                    <TableCell className="font-bold text-slate-700">{item.name}</TableCell>
                    <TableCell>
                       {item.isAdministrative ? (
                         <Badge className="bg-blue-50 text-blue-600 border-0">{isRtl ? 'إداري عام' : 'Administrative'}</Badge>
                       ) : (
                         <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs">
                           <Briefcase className="h-3 w-3" />
                           {projects?.find(p => p.id === item.projectId)?.subServiceName || '---'}
                         </div>
                       )}
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge className={cn("text-[9px] uppercase", item.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                          {item.isActive ? 'Active' : 'Inactive'}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                       <Button variant="ghost" size="icon" onClick={() => setEditingItem(item)} className="rounded-lg h-9 w-9 text-blue-600 hover:bg-blue-50"><Edit3 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
        <DialogContent className="rounded-xl p-0 overflow-hidden max-w-lg border-0 shadow-3xl bg-white">
           <div className="bg-primary/5 p-8 text-slate-900 text-start border-b">
              <DialogTitle className="text-2xl font-black font-headline">{editingItem?.id ? t('common.edit') : t('common.add')}</DialogTitle>
           </div>
           <div className="p-8 space-y-6 text-start">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5"><Label className="text-xs font-black uppercase text-slate-400">{t('common.code')}</Label><Input value={editingItem?.code || ''} onChange={e => setEditingItem({...editingItem!, code: e.target.value.toUpperCase()})} className="h-11 border-2 font-mono" /></div>
                 <div className="space-y-1.5"><Label className="text-xs font-black uppercase text-slate-400">{t('common.name')}</Label><Input value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem!, name: e.target.value})} className="h-11 border-2 font-bold" /></div>
              </div>
              <div className="space-y-1.5">
                 <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'المشروع المرتبط' : 'Linked Project'}</Label>
                 <Select disabled={editingItem?.isAdministrative} value={editingItem?.projectId || 'NONE'} onValueChange={v => setEditingItem({...editingItem!, projectId: v === 'NONE' ? '' : v})}>
                    <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                       <SelectItem value="NONE" className="italic text-slate-400">{isRtl ? '--- بدون مشروع ---' : '--- No Project ---'}</SelectItem>
                       {projects?.map(p => <SelectItem key={p.id} value={p.id!} className="font-bold py-3">{p.subServiceName}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border-2">
                    <Label className="text-xs font-black">{isRtl ? 'مركز إداري' : 'Administrative'}</Label>
                    <Switch checked={editingItem?.isAdministrative || false} onCheckedChange={v => setEditingItem({...editingItem!, isAdministrative: v, projectId: v ? '' : editingItem?.projectId})} />
                 </div>
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border-2">
                    <Label className="text-xs font-black">{t('common.isActive')}</Label>
                    <Switch checked={editingItem?.isActive !== false} onCheckedChange={v => setEditingItem({...editingItem!, isActive: v})} />
                 </div>
              </div>
           </div>
           <DialogFooter className="p-8 bg-slate-50 border-t">
              <Button onClick={handleSave} disabled={loadingAction === 'save' || !editingItem?.code || !editingItem?.name} className="w-full h-14 rounded-xl font-black">
                 {loadingAction === 'save' ? <Loader2 className="animate-spin" /> : <Save className="h-5 w-5 me-2" />} {t('common.save')}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
