'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Plus, Search, Loader2, 
  Trash2, Edit3, 
  Briefcase, HardHat, Filter, ArrowRight,
  Building2, Check, LayoutGrid, AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
    departmentId: '',
    departmentName: '',
    supervisorId: '',
    memberIds: [],
    isActive: true
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

  // حصر قائمة المشرفين والموظفين بناءً على القسم المختار للمجموعة حصراً
  const filteredEmployeesForSelection = useMemo(() => {
    if (!form.departmentId) return [];
    return (employees || []).filter(e => e.departmentId === form.departmentId);
  }, [employees, form.departmentId]);

  const supervisors = useMemo(() => {
    return filteredEmployeesForSelection.filter(e => 
      e.jobTitle?.includes('مراقب') || 
      e.jobTitle?.includes('Supervisor') || 
      e.jobTitle?.includes('مهندس') ||
      e.jobTitle?.includes('رئيس')
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
        departmentName: department?.name || '',
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
      
      toast({ title: t('saved') });
      setIsAddOpen(false);
      resetForm();
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', code: '', departmentId: '', departmentName: '', supervisorId: '', memberIds: [], isActive: true });
  };

  const filteredGroups = (groups || []).filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.departmentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-slate-900">
             <Users className="h-8 w-8 text-primary" />
             {t('workGroups')}
           </h1>
           <p className="text-slate-600 text-sm font-bold opacity-80">{isRtl ? 'إدارة أطقم الميدان حسب التخصصات والأقسام.' : 'Field crew management by department.'}</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(v) => { setIsAddOpen(v); if(!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="h-12 px-8 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2">
               <Plus className="h-5 w-5" /> {t('newGroup')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl" dir={dir}>
             <div className="bg-slate-900 p-8 text-white text-start flex items-center gap-4">
                <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20"><Users className="h-6 w-6" /></div>
                <DialogTitle className="text-2xl font-black">{isRtl ? 'تكوين طاقم عمل تخصصي' : 'Setup Dept Crew'}</DialogTitle>
             </div>
             
             <div className="p-8 space-y-6 text-start max-h-[65vh] overflow-y-auto scrollbar-hide bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'اسم الطاقم' : 'Crew Name'}</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-11 border-2 font-bold rounded-xl" placeholder={isRtl ? "مثال: طاقم النجارة أ" : "e.g. Carpentry Team A"} />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-primary flex items-center gap-2">
                        <Building2 className="h-3 w-3" /> {isRtl ? 'القسم المرجعي (التخصص)' : 'Responsible Dept'}
                      </Label>
                      <Select value={form.departmentId} onValueChange={v => setForm({...form, departmentId: v, supervisorId: '', memberIds: []})}>
                         <SelectTrigger className="h-11 border-2 font-black rounded-xl bg-slate-50/50 shadow-inner">
                            <SelectValue placeholder={isRtl ? "اختر القسم أولاً..." : "Select Department..."} />
                         </SelectTrigger>
                         <SelectContent className="rounded-xl border-0 shadow-2xl z-[150]">
                            {departments?.map(d => <SelectItem key={d.id} value={d.id!} className="font-bold">{isRtl ? d.name : d.nameEn}</SelectItem>)}
                         </SelectContent>
                      </Select>
                   </div>
                </div>

                <div className={cn("space-y-2 transition-opacity", !form.departmentId && "opacity-30 pointer-events-none")}>
                   <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'المشرف المسؤول (من داخل القسم)' : 'Department Supervisor'}</Label>
                   <Select value={form.supervisorId} onValueChange={v => setForm({...form, supervisorId: v})}>
                      <SelectTrigger className="h-12 border-2 font-black rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl border-0 shadow-2xl z-[150]">
                         {supervisors.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold py-3">{s.fullName}</SelectItem>)}
                         {supervisors.length === 0 && <div className="p-4 text-center text-[10px] font-bold text-slate-400">لا يوجد مهندسين أو مراقبين في هذا القسم.</div>}
                      </SelectContent>
                   </Select>
                </div>

                <div className={cn("space-y-4 pt-4 border-t transition-opacity", !form.departmentId && "opacity-30 pointer-events-none")}>
                   <div className="flex justify-between items-center">
                      <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'أعضاء الطاقم (من داخل القسم)' : 'Crew Members Selection'}</Label>
                      <Badge className="bg-primary/10 text-primary border-0 font-black text-[9px] px-3">{filteredEmployeesForSelection.length} {isRtl ? 'موظف متاح' : 'Available'}</Badge>
                   </div>
                   
                   <ScrollArea className="h-56 border-2 rounded-[2rem] p-4 bg-slate-50/30 shadow-inner ring-1 ring-black/[0.02]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                 "p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between border-2",
                                 isChecked ? "bg-white border-primary shadow-md ring-1 ring-primary/5" : "bg-white/50 border-slate-100 hover:border-slate-200"
                               )}
                             >
                                <div className="flex items-center gap-3 truncate">
                                   <Checkbox 
                                     id={`mem-${e.id}`} 
                                     checked={isChecked}
                                     className="h-5 w-5 pointer-events-none"
                                   />
                                   <div className="flex flex-col text-start truncate">
                                      <span className={cn("text-xs font-black", isChecked ? "text-slate-900" : "text-slate-600")}>{e.fullName}</span>
                                      <span className="text-[8px] text-slate-400 font-bold uppercase truncate">{e.jobTitle}</span>
                                   </div>
                                </div>
                                {isChecked && <Check className="h-4 w-4 text-primary shrink-0" />}
                             </div>
                           );
                         })}
                         {filteredEmployeesForSelection.length === 0 && form.departmentId && (
                            <div className="col-span-full py-10 text-center opacity-30">
                               <HardHat className="h-10 w-10 mx-auto text-slate-300" />
                               <p className="text-xs font-bold text-slate-400 mt-2">{isRtl ? 'لا يوجد موظفين مسجلين في هذا القسم.' : 'No employees in this department.'}</p>
                            </div>
                         )}
                         {!form.departmentId && <div className="col-span-full py-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">يرجى اختيار القسم أولاً</div>}
                      </div>
                   </ScrollArea>
                   <div className="flex justify-between items-center px-4">
                      <p className="text-[10px] text-slate-400 font-black italic">{isRtl ? `* تم اختيار ${form.memberIds?.length || 0} عضو للطاقم.` : `* ${form.memberIds?.length || 0} members selected.`}</p>
                      {form.memberIds && form.memberIds.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setForm({...form, memberIds: []})} className="h-6 text-[9px] font-black text-rose-500 uppercase">{isRtl ? 'تصفير الاختيار' : 'Clear All'}</Button>
                      )}
                   </div>
                </div>
             </div>

             <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleSave} disabled={loading || !form.name || !form.departmentId} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all border-b-8 border-orange-700">
                   {loading ? <Loader2 className="animate-spin" /> : (isRtl ? 'اعتماد وحفظ الطاقم' : 'Confirm Crew Setup')}
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'إجمالي المجموعات' : 'Total Crews', val: groups?.length || 0, icon: Users, color: 'text-primary', bg: 'bg-orange-50' },
           { label: isRtl ? 'العمالة الميدانية الموزعة' : 'Deployed Force', val: groups?.reduce((acc, g) => acc + (g.memberCount || 0), 0) || 0, icon: HardHat, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: isRtl ? 'إجمالي الأقسام المشغولة' : 'Active Departments', val: new Set(groups?.map(g => g.departmentId)).size || 0, icon: LayoutGrid, color: 'text-emerald-600', bg: 'bg-emerald-50' },
         ].map((stat, i) => (
           <Card key={i} className="border-0 shadow-lg rounded-[2rem] bg-white p-6 flex items-center justify-between group hover:scale-[1.03] transition-all">
              <div className="text-start">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                 <h3 className="text-3xl font-black text-slate-900">{stat.val}</h3>
              </div>
              <div className={cn("p-4 rounded-2xl shadow-sm transition-transform group-hover:rotate-6", stat.bg, stat.color)}>
                 <stat.icon className="h-6 w-6" />
              </div>
           </Card>
         ))}
      </div>

      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
               <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
               <Input 
                 placeholder={isRtl ? "بحث باسم الطاقم أو القسم..." : "Search crews..."} 
                 className="ps-12 h-11 bg-white border-2 border-slate-100 rounded-xl focus:border-primary/30 transition-all font-bold" 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" className="h-10 rounded-xl border-2 font-bold px-5 bg-white"><Filter className="h-4 w-4 me-2" /> {isRtl ? 'تصفية' : 'Filters'}</Button>
            </div>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-muted/10 border-b">
                  <TableRow>
                     <TableHead className="py-5 ps-8 text-start font-black text-slate-500 uppercase text-[10px] tracking-widest">{isRtl ? 'اسم الطاقم / القسم' : 'Crew / Dept'}</TableHead>
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
                    <TableRow key={group.id} className="hover:bg-primary/[0.02] transition-colors border-b-slate-100 group cursor-pointer" onClick={() => { setForm(group); setIsAddOpen(true); }}>
                       <TableCell className="py-5 ps-8 text-start">
                          <div className="flex flex-col">
                             <span className="font-black text-slate-800 text-sm leading-tight">{group.name}</span>
                             <Badge variant="secondary" className="w-fit text-[8px] font-black uppercase bg-primary/5 text-primary border-0 mt-1.5 px-2">
                                <Building2 className="h-2 w-2 me-1" /> {group.departmentName}
                             </Badge>
                          </div>
                       </TableCell>
                       <TableCell className="text-start">
                          <div className="flex items-center gap-3">
                             <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-inner border"><Briefcase className="h-4.5 w-4.5" /></div>
                             <span className="text-xs font-bold text-slate-700">{group.supervisorName}</span>
                          </div>
                       </TableCell>
                       <TableCell className="text-center">
                          <Badge variant="outline" className="font-black border-2 border-slate-100 bg-white shadow-sm px-4 h-7 text-xs">{group.memberCount} {isRtl ? 'عامل' : 'Workers'}</Badge>
                       </TableCell>
                       <TableCell className="text-start">
                          <Badge className={cn("text-[9px] font-black uppercase border-0 px-4", group.isActive ? "bg-emerald-50 text-white" : "bg-slate-300 text-white")}>
                             {group.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                       </TableCell>
                       <TableCell className="pe-8 text-end" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button variant="outline" size="icon" onClick={() => { setForm(group); setIsAddOpen(true); }} className="h-10 w-10 rounded-xl border-primary/20 text-primary hover:bg-primary hover:text-white shadow-sm"><Edit3 className="h-4.5 w-4.5" /></Button>
                             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50" onClick={() => { if(confirm(t('confirmDelete'))) deleteDoc(doc(db, paths.workGroups(companyId!), group.id!)); }}><Trash2 className="h-4.5 w-4.5" /></Button>
                             <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-300"><ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} /></Button>
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
