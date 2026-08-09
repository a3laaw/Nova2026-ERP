'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Plus, Search, Loader2, 
  ArrowRight, Filter
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
    <div className="space-y-4 w-full animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-start">
        <div className="text-start">
           <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
             <Users className="h-6 w-6 text-primary" />
             {t('construction.groups')}
           </h1>
           <p className="text-xs text-muted-foreground font-medium">{t('construction.groupsDesc')}</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 px-4 font-bold rounded-md shadow-sm">
               <Plus className="h-4 w-4 me-2" /> {t('construction.newGroup')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-lg p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-xl" dir={dir}>
             <div className="bg-slate-50 p-6 text-slate-900 text-start border-b">
                <DialogTitle className="text-lg font-bold">{t('construction.setupCrew')}</DialogTitle>
             </div>
             
             <div className="p-6 space-y-4 text-start bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">{t('groups.form.name')}</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-9 border-slate-200 text-xs font-medium rounded-md" />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">{t('orgRef')}</Label>
                      <Select value={form.departmentId} onValueChange={v => setForm({...form, departmentId: v, supervisorId: '', memberIds: []})}>
                         <SelectTrigger className="h-9 border-slate-200 text-xs font-medium rounded-md">
                            <SelectValue placeholder="..." />
                         </SelectTrigger>
                         <SelectContent className="rounded-md">
                            {departments?.map(d => <SelectItem key={d.id} value={d.id!} className="text-xs">{isRtl ? d.name : d.nameEn}</SelectItem>)}
                         </SelectContent>
                      </Select>
                   </div>
                </div>

                <div className={cn("space-y-1.5", !form.departmentId && "opacity-30 pointer-events-none")}>
                   <Label className="text-[10px] font-bold uppercase text-slate-400">{t('groups.form.supervisor')}</Label>
                   <Select value={form.supervisorId} onValueChange={v => setForm({...form, supervisorId: v})}>
                      <SelectTrigger className="h-9 border-slate-200 text-xs font-medium rounded-md"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-md">
                         {supervisors.map(s => <SelectItem key={s.id} value={s.id!} className="text-xs">{s.fullName}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>

                <div className={cn("space-y-2 pt-2 border-t", !form.departmentId && "opacity-30 pointer-events-none")}>
                   <Label className="text-[10px] font-bold uppercase text-slate-400">{t('groups.form.members')}</Label>
                   <ScrollArea className="h-40 border rounded-md p-2 bg-slate-50/30">
                      <div className="grid grid-cols-1 gap-1.5">
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
                                 "p-2 rounded-md cursor-pointer transition-all flex items-center gap-3 border",
                                 isChecked ? "bg-white border-primary shadow-sm" : "bg-white/50 border-transparent"
                               )}
                             >
                                <Checkbox checked={isChecked} className="h-4 w-4 pointer-events-none" />
                                <span className="text-[11px] font-medium text-slate-700">{e.fullName}</span>
                             </div>
                           );
                         })}
                      </div>
                   </ScrollArea>
                </div>
             </div>

             <DialogFooter className="p-6 bg-slate-50 border-t">
                <Button onClick={handleSave} disabled={loading || !form.name} size="sm" className="w-full h-10 font-bold rounded-md">
                   {loading ? <Loader2 className="animate-spin h-4 w-4" /> : t('common.save')}
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="rounded-lg shadow-sm border border-slate-100 overflow-hidden bg-white">
         <div className="p-3 flex flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
            <div className="relative w-full max-w-sm">
               <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
               <Input 
                 placeholder={t('common.search')} 
                 className="ps-9 h-9 border-slate-200 bg-white font-medium text-sm rounded-md" 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
            <Button variant="outline" size="sm" className="h-9 px-3 rounded-md font-bold text-xs border-slate-200"><Filter className="h-3.5 w-3.5 me-2" /> {t('common.filter')}</Button>
         </div>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50">
                  <TableRow>
                     <TableHead className="py-3 ps-6 text-start text-[10px] font-bold uppercase text-slate-500">{t('groups.table.crewDept')}</TableHead>
                     <TableHead className="text-start text-[10px] font-bold uppercase text-slate-500">{t('groups.table.supervisor')}</TableHead>
                     <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">{t('groups.table.count')}</TableHead>
                     <TableHead className="pe-6"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {groupsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredGroups.map(group => (
                    <TableRow key={group.id} className="hover:bg-slate-50/50 border-b-slate-100 group cursor-pointer" onClick={() => { setForm(group); setIsAddOpen(true); }}>
                       <TableCell className="py-2.5 ps-6 text-start">
                          <div className="flex flex-col">
                             <span className="font-bold text-slate-800 text-sm">{group.name}</span>
                             <span className="text-[9px] text-slate-400 font-medium">{group.departmentName}</span>
                          </div>
                       </TableCell>
                       <TableCell className="text-start">
                          <span className="text-xs font-medium text-slate-600">{group.supervisorName}</span>
                       </TableCell>
                       <TableCell className="text-center">
                          <Badge variant="outline" className="font-bold border-slate-100 bg-slate-50 text-[10px] px-2 rounded-md">{group.memberCount} Staff</Badge>
                       </TableCell>
                       <TableCell className="pe-6 text-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 group-hover:text-primary">
                             <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
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
