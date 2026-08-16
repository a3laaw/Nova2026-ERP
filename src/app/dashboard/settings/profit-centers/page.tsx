
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingUp, Plus, Loader2, Search, 
  Trash2, Edit3, Save, Briefcase,
  DatabaseZap, ShieldCheck, Landmark,
  X, Info, Sparkles
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { ProfitCenter } from '@/types/cost-profit-centers';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';
import { toast } from '@/hooks/use-toast';

export default function ProfitCentersPage() {
  const { globalUser } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<Partial<ProfitCenter> | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const centersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.profitCenters(companyId)), orderBy('code')) : null, 
  [db, companyId]);

  const projectsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId))) : null, 
  [db, companyId]);

  const { data: centers, loading } = useCollection<ProfitCenter>(centersQuery);
  const { data: projects } = useCollection<any>(projectsQuery);

  const filtered = (centers || []).filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    if (!db || !companyId || !editingItem?.name || !editingItem.code) return;
    setLoadingAction('save');
    try {
      const path = paths.profitCenters(companyId);
      const docData = {
        ...editingItem,
        companyId,
        isActive: editingItem.isActive !== false,
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
    <div className="space-y-6 text-start max-w-[1600px] mx-auto animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center px-1">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-4 text-slate-800">
             <DatabaseZap className="h-9 w-9 text-[#2563EB]" />
             {tSafe('inline.profit.centers', 'سجل مراكز الربحية', 'Profit Centers Registry')}
           </h1>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Revenue Performance Nodes Control</p>
        </div>
        <Button 
          onClick={() => setEditingItem({ code: '', name: '', isActive: true })} 
          className="h-12 px-8 rounded-xl bg-[#2563EB] text-white font-black shadow-xl border-b-4 border-[#1e40af] hover:scale-105 transition-all gap-3"
        >
          <Plus className="h-5 w-5" /> {isRtl ? 'إضافة مركز ربحية' : 'Add Profit Center'}
        </Button>
      </header>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-6">
           <div className="relative max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-12 h-10 border-2 border-slate-100 bg-white font-bold rounded-xl focus:border-[#2563EB]/40" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30 border-b">
              <TableRow>
                <TableHead className="py-5 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.code')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.name')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'المشروع المرتبط' : 'Linked Project'}</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.status')}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-300 font-black italic">{t('common.noResults')}</TableCell></TableRow>
              ) : (
                filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-blue-50/10 transition-colors border-b-slate-100 group cursor-pointer" onClick={() => setEditingItem(item)}>
                    <TableCell className="py-6 ps-10">
                       <Badge variant="outline" className="font-mono font-black text-[#2563EB] border-[#2563EB]/20 bg-[#2563EB]/5 px-3 py-1 rounded-lg">
                          {item.code}
                       </Badge>
                    </TableCell>
                    <TableCell className="font-black text-slate-800 text-sm">{item.name}</TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2 text-slate-400 font-bold text-xs">
                         <Briefcase className="h-3.5 w-3.5 opacity-40" />
                         {projects?.find(p => p.id === item.projectId)?.subServiceName || '---'}
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge className={cn(
                         "font-black text-[9px] uppercase border-0 px-4 py-1 rounded-lg shadow-sm", 
                         item.isActive ? "bg-blue-50 text-[#2563EB]" : "bg-slate-100 text-slate-400"
                       )}>
                          {item.isActive ? 'Active' : 'Inactive'}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-10 text-end">
                       <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-300 group-hover:text-[#2563EB] group-hover:bg-blue-50 transition-all">
                          <Edit3 className="h-4 w-4" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden max-w-xl border-0 shadow-3xl bg-white flex flex-col" dir={dir}>
           <div className="bg-blue-50 p-10 text-[#1e40af] text-start border-b shrink-0">
              <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                 <TrendingUp className="h-9 w-9" />
                 {editingItem?.id ? t('common.edit') : t('common.add')}
              </DialogTitle>
              <p className="text-blue-400 font-bold mt-2 uppercase text-[10px] tracking-widest">{isRtl ? 'تعديل بيانات مركز الربحية' : 'Modify Profit Center Node'}</p>
           </div>
           
           <div className="p-10 space-y-8 text-start bg-white flex-1 overflow-y-auto scrollbar-hide">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.code')}</Label>
                    <Input value={editingItem?.code || ''} onChange={e => setEditingItem({...editingItem!, code: e.target.value.toUpperCase()})} className="h-10 rounded-xl border-2 font-mono font-black text-[#2563EB] shadow-inner" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.name')}</Label>
                    <Input value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem!, name: e.target.value})} className="h-10 rounded-xl border-2 font-black" />
                 </div>
              </div>

              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase text-[#2563EB] tracking-widest flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5" /> {isRtl ? 'المشروع المرتبط (مركز الإيراد)' : 'Linked Project (Revenue Hub)'}
                 </Label>
                 <SearchableDropdown 
                    options={(projects || []).map(p => ({ id: p.id!, name: p.subServiceName, subText: p.clientName }))}
                    value={editingItem?.projectId || ''} 
                    onChange={v => setEditingItem({...editingItem!, projectId: v as string})}
                    placeholder={isRtl ? "اختر المشروع للمطابقة..." : "Select Project for Mapping..."}
                 />
              </div>

              <div className="flex items-center justify-between p-6 bg-blue-50/30 rounded-2xl border-2 border-white shadow-inner">
                 <div className="space-y-0.5">
                    <Label className="font-black text-sm">{t('common.isActive')}</Label>
                    <p className="text-[9px] text-blue-400 font-bold">تمكين المركز من استقبال الإيرادات</p>
                 </div>
                 <Switch checked={editingItem?.isActive !== false} onCheckedChange={v => setEditingItem({...editingItem!, isActive: v})} />
              </div>
           </div>

           <DialogFooter className="p-8 bg-blue-50/50 border-t shrink-0">
              <Button 
                onClick={handleSave} 
                disabled={loadingAction === 'save' || !editingItem?.code || !editingItem?.name} 
                className="w-full h-14 rounded-2xl bg-[#2563EB] text-white font-black text-xl shadow-xl shadow-blue-200 border-b-8 border-[#1e40af] hover:scale-[1.02] transition-all gap-3"
              >
                 {loadingAction === 'save' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} {t('common.save')}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
