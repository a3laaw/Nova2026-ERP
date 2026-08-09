'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Plus, Search, Loader2, 
  ArrowRight, Filter, Hammer
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { WorkGroup, Employee } from '@/types/hr';
import { Department } from '@/types/reference';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from '@/hooks/use-toast';

export default function WorkGroupsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState<Partial<WorkGroup>>({
    name: '', code: '', departmentId: '', supervisorId: '', memberIds: [], isActive: true
  });

  const groupsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.workGroups(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, 
  [db, companyId]);

  const deptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: groups, loading: groupsLoading } = useCollection<WorkGroup>(groupsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);
  const { data: departments } = useCollection<Department>(deptsQuery);

  const filteredEmployeesForSelection = useMemo(() => {
    if (!form.departmentId) return [];
    return (employees || []).filter(e => e.departmentId === form.departmentId);
  }, [employees, form.departmentId]);

  const supervisors = useMemo(() => {
    return filteredEmployeesForSelection.filter(e => 
      e.jobTitle?.includes('مراقب') || e.jobTitle?.includes('Supervisor') || e.jobTitle?.includes('مهندس')
    );
  }, [filteredEmployeesForSelection]);

  const handleSave = async () => {
    if (!db || !companyId || !form.name || !form.departmentId) return;
    setLoading(true);
    try {
      const supervisor = employees?.find(e => e.id === form.supervisorId);
      const department = departments?.find(d => d.id === form.departmentId);
      
      const data = {
        ...form,
        companyId,
        departmentName: department ? (isRtl ? department.name : department.nameEn) : '',
        supervisorName: supervisor?.fullName || '',
        memberCount: form.memberIds?.length || 0,
        createdAt: form.id ? form.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (form.id) {
        await updateDoc(doc(db, paths.workGroups(companyId), form.id), data);
      } else {
        await addDoc(collection(db, paths.workGroups(companyId)), data);
      }
      
      toast({ title: t('common.saved') });
      setIsAddOpen(false);
      setForm({ name: '', code: '', departmentId: '', supervisorId: '', memberIds: [], isActive: true });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = (groups || []).filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.supervisorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500" dir={dir}>
      {/* Unified Header Design */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <Users className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('construction.groups')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5">{t('construction.groupsDesc')}</p>
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 px-8 font-black rounded-xl shadow-lg shadow-primary/20">
               <Plus className="h-5 w-5 me-2" /> {isRtl ? 'تكوين طاقم عمل' : 'New Group'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-xl text-start" dir={dir}>
             <div className="bg-slate-50/50 p-8 border-b">
                <DialogTitle className="text-2xl font-black font-headline">{isRtl ? 'إعداد طاقم جديد' : 'Setup Crew'}</DialogTitle>
             </div>
             
             <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الطاقم' : 'Crew Name'}</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-11 border-2 rounded-xl font-bold" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('orgRef')}</Label>
                      <Select value={form.departmentId} onValueChange={v => setForm({...form, departmentId: v, supervisorId: '', memberIds: []})}>
                         <SelectTrigger className="h-11 border-2 rounded-xl font-bold">
                            <SelectValue placeholder="..." />
                         </SelectTrigger>
                         <SelectContent className="rounded-xl border-0 shadow-2xl z-[200]">
                            {departments?.map(d => <SelectItem key={d.id} value={d.id!} className="font-bold py-3">{isRtl ? d.name : d.nameEn}</SelectItem>)}
                         </SelectContent>
                      </Select>
                   </div>
                </div>

                <div className={cn("space-y-2", !form.departmentId && "opacity-30 pointer-events-none")}>
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المشرف المسؤول' : 'Supervisor'}</Label>
                   <Select value={form.supervisorId} onValueChange={v => setForm({...form, supervisorId: v})}>
                      <SelectTrigger className="h-11 border-2 rounded-xl font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl border-0 shadow-2xl z-[200]">
                         {supervisors.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold py-3">{s.fullName}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>

                <div className={cn("space-y-3 pt-4 border-t", !form.departmentId && "opacity-30 pointer-events-none")}>
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'أعضاء الطاقم' : 'Members'}</Label>
                   <ScrollArea className="h-48 border-2 rounded-2xl p-4 bg-slate-50/50 shadow-inner">
                      <div className="grid grid-cols-1 gap-2">
                         {filteredEmployeesForSelection.filter(e => e.id !== form.supervisorId).map(e => {
                           const isChecked = form.memberIds?.includes(e.id!);
                           return (
                             <div 
                               key={e.id} 
                               onClick={() => {
                                 const current = form.memberIds || [];
                                 const updated = isChecked ? current.filter(id => id !== e.id) : [...current, e.id!];
                                 setForm({...form, memberIds: updated});
                               }}
                               className={cn(
                                 "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border-2",
                                 isChecked ? "bg-white border-primary shadow-sm" : "bg-white/40 border-transparent hover:border-slate-100"
                               )}
                             >
                                <div className="flex items-center gap-3">
                                   <Checkbox checked={isChecked} className="h-5 w-5 pointer-events-none" />
                                   <span className="text-xs font-bold text-slate-700">{e.fullName}</span>
                                </div>
                             </div>
                           );
                         })}
                      </div>
                   </ScrollArea>
                </div>
             </div>

             <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleSave} disabled={loading || !form.name} className="w-full h-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 border-b-8 border-orange-700">
                   {loading ? <Loader2 className="animate-spin h-6 w-6" /> : t('common.save')}
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="rounded-xl shadow-sm border border-slate-100 overflow-hidden bg-white">
         <div className="p-4 flex flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
            <div className="relative w-full max-w-sm text-start">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
               <Input 
                 placeholder={t('common.search')} 
                 className="ps-11 h-11 border-2 border-slate-100 bg-white font-bold text-sm rounded-xl focus:border-primary/40 transition-all" 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
            <Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs border-2"><Filter className="h-4 w-4 me-2" /> {t('common.filter')}</Button>
         </div>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b-0">
                     <TableHead className="py-5 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'بيانات الطاقم والقسم' : 'Crew & Dept'}</TableHead>
                     <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'المشرف المسؤول' : 'Supervisor'}</TableHead>
                     <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'العدد' : 'Count'}</TableHead>
                     <TableHead className="pe-10"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {groupsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredGroups.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-24 text-slate-300 font-black italic">{t('common.noResults')}</TableCell></TableRow>
                  ) : filteredGroups.map(group => (
                    <TableRow key={group.id} className="hover:bg-primary/[0.01] border-b-slate-100 group cursor-pointer" onClick={() => { setForm(group); setIsAddOpen(true); }}>
                       <TableCell className="py-4 ps-10 text-start">
                          <div className="flex flex-col text-start">
                             <span className="font-black text-slate-800 text-base">{group.name}</span>
                             <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mt-1">{group.departmentName}</span>
                          </div>
                       </TableCell>
                       <TableCell className="text-start">
                          <span className="text-sm font-bold text-slate-600">{group.supervisorName}</span>
                       </TableCell>
                       <TableCell className="text-center">
                          <Badge variant="secondary" className="font-black border-0 bg-blue-50 text-blue-600 text-[10px] px-4 py-1 rounded-lg shadow-sm">{group.memberCount} Staff</Badge>
                       </TableCell>
                       <TableCell className="pe-10 text-end">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 group-hover:text-primary transition-all">
                             <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                          </Button>
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
