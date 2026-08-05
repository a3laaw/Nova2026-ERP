'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Plus, Search, Loader2, 
  UserCircle, Trash2, Edit3, ShieldCheck,
  Briefcase, HardHat, Filter, ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { WorkGroup, Employee } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from '@/hooks/use-toast';

export default function WorkGroupsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState<Partial<WorkGroup>>({
    name: '',
    code: '',
    supervisorId: '',
    category: 'general',
    memberIds: [],
    isActive: true
  });

  const groupsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.workGroups(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, 
  [db, companyId]);

  const { data: groups, loading: groupsLoading } = useCollection<WorkGroup>(groupsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const supervisors = useMemo(() => 
    (employees || []).filter(e => e.jobTitle?.includes('مراقب') || e.jobTitle?.includes('Supervisor') || e.jobTitle?.includes('مهندس')),
  [employees]);

  const handleSave = async () => {
    if (!db || !companyId || !form.name) return;
    setLoading(true);
    try {
      const supervisor = employees?.find(e => e.id === form.supervisorId);
      const data = {
        ...form,
        companyId,
        supervisorName: supervisor?.fullName || '',
        memberCount: form.memberIds?.length || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (form.id) {
        await updateDoc(doc(db, paths.workGroups(companyId), form.id), data);
      } else {
        await addDoc(collection(db, paths.workGroups(companyId)), data);
      }
      
      toast({ title: t('saved') });
      setIsAddOpen(false);
      setForm({ name: '', code: '', supervisorId: '', category: 'general', memberIds: [], isActive: true });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = (groups || []).filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.supervisorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-slate-900">
             <Users className="h-8 w-8 text-primary" />
             {t('workGroups')}
           </h1>
           <p className="text-slate-600 text-sm font-bold opacity-80">{isRtl ? 'إدارة أطقم الميدان والمجموعات المتخصصة.' : 'Field crew and specialty group management.'}</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ name: '', code: '', supervisorId: '', category: 'general', memberIds: [], isActive: true })} className="h-12 px-8 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2">
               <Plus className="h-5 w-5" /> {t('newGroup')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
             <div className="bg-slate-900 p-8 text-white text-start flex items-center gap-4">
                <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white"><Users className="h-6 w-6" /></div>
                <DialogTitle className="text-2xl font-black">{isRtl ? 'تكوين مجموعة عمل جديدة' : 'Setup New Crew'}</DialogTitle>
             </div>
             
             <div className="p-8 space-y-6 text-start max-h-[60vh] overflow-y-auto scrollbar-hide bg-white">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'اسم الطاقم' : 'Crew Name'}</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-11 border-2 font-bold" placeholder={isRtl ? "مثال: طاقم النجارة أ" : "e.g. Carpentry Team A"} />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'التصنيف' : 'Category'}</Label>
                      <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                         <SelectTrigger className="h-11 border-2 font-bold"><SelectValue /></SelectTrigger>
                         <SelectContent className="rounded-xl">
                            <SelectItem value="skeleton" className="font-bold">هيكل أسود (Skeleton)</SelectItem>
                            <SelectItem value="finishing" className="font-bold">تشطيبات (Finishing)</SelectItem>
                            <SelectItem value="electrical" className="font-bold">كهرباء (Electrical)</SelectItem>
                            <SelectItem value="general" className="font-bold">عام (General)</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                </div>

                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'المشرف المسؤول (رئيس الطاقم)' : 'Supervisor / Foreman'}</Label>
                   <Select value={form.supervisorId} onValueChange={v => setForm({...form, supervisorId: v})}>
                      <SelectTrigger className="h-12 border-2 font-black"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         {supervisors.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{s.fullName}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>

                <div className="space-y-3">
                   <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'أعضاء الطاقم (العمالة الميدانية)' : 'Crew Members'}</Label>
                   <ScrollArea className="h-48 border-2 rounded-2xl p-4 bg-slate-50/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {employees?.filter(e => e.id !== form.supervisorId).map(e => (
                           <div key={e.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                              <Checkbox 
                                id={`mem-${e.id}`} 
                                checked={form.memberIds?.includes(e.id!)} 
                                onCheckedChange={checked => {
                                  const current = form.memberIds || [];
                                  const updated = checked ? [...current, e.id!] : current.filter(id => id !== e.id);
                                  setForm({...form, memberIds: updated});
                                }}
                              />
                              <label htmlFor={`mem-${e.id}`} className="text-xs font-bold cursor-pointer truncate">
                                 {e.fullName} <span className="text-[9px] text-slate-400 opacity-70">({e.jobTitle})</span>
                              </label>
                           </div>
                         ))}
                      </div>
                   </ScrollArea>
                   <p className="text-[10px] text-slate-400 font-bold italic">{isRtl ? `* تم اختيار ${form.memberIds?.length || 0} عضو.` : `* ${form.memberIds?.length || 0} members selected.`}</p>
                </div>
             </div>

             <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleSave} disabled={loading || !form.name} className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20">
                   {loading ? <Loader2 className="animate-spin" /> : (isRtl ? 'اعتماد تكوين المجموعة' : 'Confirm Crew Setup')}
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'إجمالي المجموعات' : 'Total Crews', val: groups?.length || 0, icon: Users, color: 'text-primary', bg: 'bg-orange-50' },
           { label: isRtl ? 'العمالة النشطة' : 'Labor Force', val: groups?.reduce((acc, g) => acc + (g.memberCount || 0), 0) || 0, icon: HardHat, color: 'text-blue-600', bg: 'bg-blue-50' },
         ].map((stat, i) => (
           <Card key={i} className="border-0 shadow-lg rounded-2xl bg-white p-6 flex items-center justify-between">
              <div className="text-start">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                 <h3 className="text-3xl font-black text-slate-900">{stat.val}</h3>
              </div>
              <div className={cn("p-4 rounded-xl", stat.bg, stat.color)}>
                 <stat.icon className="h-6 w-6" />
              </div>
           </Card>
         ))}
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
               <Input 
                 placeholder={t('search')} 
                 className="ps-12 h-11 bg-white border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary transition-all font-bold" 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-muted/10 border-b">
                  <TableRow>
                     <TableHead className="py-5 ps-8 text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'اسم الطاقم' : 'Crew Name'}</TableHead>
                     <TableHead className="text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'المشرف المسؤول' : 'Foreman / Supervisor'}</TableHead>
                     <TableHead className="text-center font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'عدد العمالة' : 'Size'}</TableHead>
                     <TableHead className="text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{t('status')}</TableHead>
                     <TableHead className="pe-8 text-end"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {groupsLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : filteredGroups.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد مجموعات عمل.' : 'No work groups found.'}</TableCell></TableRow>
                  ) : filteredGroups.map(group => (
                    <TableRow key={group.id} className="hover:bg-primary/[0.02] transition-colors border-b-slate-100 group">
                       <TableCell className="py-5 ps-8 text-start">
                          <div className="flex flex-col">
                             <span className="font-black text-slate-800 text-sm">{group.name}</span>
                             <Badge variant="secondary" className="w-fit text-[8px] font-black uppercase bg-primary/5 text-primary border-0 mt-1">{group.category}</Badge>
                          </div>
                       </TableCell>
                       <TableCell className="text-start">
                          <div className="flex items-center gap-2">
                             <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all"><Briefcase className="h-4 w-4" /></div>
                             <span className="text-xs font-bold text-slate-700">{group.supervisorName}</span>
                          </div>
                       </TableCell>
                       <TableCell className="text-center">
                          <Badge variant="outline" className="font-black border-2 border-slate-100 bg-white shadow-sm">{group.memberCount} {isRtl ? 'عامل' : 'Workers'}</Badge>
                       </TableCell>
                       <TableCell className="text-start">
                          <Badge className={cn("text-[9px] font-black uppercase border-0", group.isActive ? "bg-emerald-500 text-white" : "bg-slate-300 text-white")}>
                             {group.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                       </TableCell>
                       <TableCell className="pe-8 text-end">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button variant="outline" size="icon" onClick={() => { setForm(group); setIsAddOpen(true); }} className="h-9 w-9 rounded-xl border-primary/20 text-primary hover:bg-primary hover:text-white"><Edit3 className="h-4 w-4" /></Button>
                             <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
                             <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9"><ArrowRight className={cn("h-4 w-4 text-slate-300", isRtl && "rotate-180")} /></Button>
                          </div>
                       </TableCell>
                    </TableRow>
                  ))}
               </TableBody>
            </Table>
         </CardContent>
      </Card>
    </div>
  );
}
