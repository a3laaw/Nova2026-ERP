'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Briefcase, Search, ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { DepartmentService } from '@/services/department-service';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Department, Job } from '@/types/reference';
import { Role } from '@/types/roles';

export default function DepartmentsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [isJobOpen, setIsJobOpen] = useState(false);
  const [deptForm, setDeptForm] = useState<Partial<Department>>({ name: '', nameEn: '', description: '' });
  const [jobForm, setJobForm] = useState<Partial<Job>>({ name: '', nameEn: '', roleId: '' });

  const deptService = useMemo(() => {
    if (!db || !companyId) return null;
    return new DepartmentService(db, companyId);
  }, [db, companyId]);

  const deptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const jobsQuery = useMemo(() => 
    companyId && db && selectedDept?.id ? query(collection(db, paths.jobs(companyId, selectedDept.id)), orderBy('order')) : null, 
  [db, companyId, selectedDept]);

  const rolesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.roles(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: departments, loading: deptsLoading } = useCollection<Department>(deptsQuery);
  const { data: jobs, loading: jobsLoading } = useCollection<Job>(jobsQuery);
  const { data: roles } = useCollection<Role>(rolesQuery);

  const handleSaveDept = async () => {
    if (!deptService || !deptForm.name) return;
    setLoadingAction('save_dept');
    try {
      const data = { ...deptForm, order: departments?.length || 0, isActive: true, name: deptForm.name || '', nameEn: deptForm.nameEn || '' };
      if (deptForm.id) await deptService.updateDepartment(deptForm.id, data);
      else await deptService.addDepartment(data as any);
      toast({ title: t('saved') });
      setIsDeptOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveJob = async () => {
    if (!deptService || !selectedDept?.id || !jobForm.name) return;
    setLoadingAction('save_job');
    try {
      const selectedRole = roles?.find(r => r.id === jobForm.roleId);
      const data = { 
        ...jobForm, 
        order: jobs?.length || 0, 
        isActive: true, 
        roleName: selectedRole ? (isRtl ? selectedRole.name : selectedRole.nameEn) : '',
        name: jobForm.name || '', 
        nameEn: jobForm.nameEn || '' 
      };
      if (jobForm.id) await deptService.updateJob(selectedDept.id, jobForm.id, data);
      else await deptService.addJob(selectedDept.id, data as any);
      toast({ title: t('saved') });
      setIsJobOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-start">
          <Building2 className="h-6 w-6 text-primary" /> 
          {isRtl ? 'الهيكل التنظيمي' : 'Organizational Structure'}
        </h2>
        
        <Dialog open={isDeptOpen} onOpenChange={setIsDeptOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDeptForm({ name: '', nameEn: '', description: '' })} className="btn-nova-primary h-12 px-6 rounded-2xl flex items-center gap-2">
              <Plus className="h-5 w-5" /> {t('newDept')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] max-w-2xl p-8" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-2xl">{deptForm.id ? t('edit') : t('newDept')}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-6 py-4 text-start">
              <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={deptForm.name || ''} onChange={e => setDeptForm({...deptForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={deptForm.nameEn || ''} onChange={e => setDeptForm({...deptForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
              <div className="col-span-2 space-y-2"><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={deptForm.description || ''} onChange={e => setDeptForm({...deptForm, description: e.target.value})} /></div>
            </div>
            <DialogFooter className="mt-6">
              <Button onClick={handleSaveDept} disabled={loadingAction === 'save_dept'} className="w-full h-12 rounded-xl font-bold bg-primary text-white">
                {loadingAction === 'save_dept' ? <Loader2 className="animate-spin" /> : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 text-start">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-4">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('search')} className="ps-10 rounded-xl bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {deptsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                departments?.filter(d => d.name.includes(searchTerm)).map(dept => (
                  <div 
                    key={dept.id} 
                    onClick={() => setSelectedDept(dept)} 
                    className={cn(
                      "p-5 border-b flex items-center justify-between cursor-pointer transition-all group relative", 
                      selectedDept?.id === dept.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30'
                    )}
                  >
                    <span className="text-sm font-black">{isRtl ? dept.name : dept.nameEn}</span>
                    <div className="flex items-center gap-1 z-20">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeptForm(dept); setIsDeptOpen(true); }}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className={cn("h-4 w-4 ms-2", isRtl && 'rotate-180', selectedDept?.id === dept.id && 'text-primary')} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-7", !selectedDept && 'opacity-40')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white text-start">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div><CardTitle className="text-lg font-black flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> {isRtl ? 'الوظائف' : 'Job Titles'}</CardTitle></div>
              {selectedDept && (
                <Dialog open={isJobOpen} onOpenChange={setIsJobOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="rounded-xl h-10 px-4" onClick={() => setJobForm({ name: '', nameEn: '', roleId: '' })}>
                      <Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة وظيفة' : 'Add Job'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2.5rem] p-8 max-w-xl" dir={dir}>
                    <DialogHeader><DialogTitle className="text-start font-black text-xl">{jobForm.id ? (isRtl ? 'تعديل وظيفة' : 'Edit Job') : (isRtl ? 'إضافة وظيفة' : 'Add Job')}</DialogTitle></DialogHeader>
                    <div className="space-y-6 py-4 text-start">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={jobForm.name || ''} onChange={e => setJobForm({...jobForm, name: e.target.value})} /></div>
                        <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={jobForm.nameEn || ''} onChange={e => setJobForm({...jobForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
                      </div>
                      <div className="p-6 bg-primary/5 rounded-2xl border-2 border-primary/10 space-y-4">
                         <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                            <ShieldCheck className="h-4 w-4" /> {isRtl ? 'ربط الصلاحيات (الدور)' : 'Permission Binding (Role)'}
                         </div>
                         <Select value={jobForm.roleId} onValueChange={v => setJobForm({...jobForm, roleId: v})}>
                            <SelectTrigger className="h-12 rounded-xl bg-white border-2">
                               <SelectValue placeholder={isRtl ? "اختر الدور المرتبط بهذه الوظيفة" : "Select Linked Role"} />
                            </SelectTrigger>
                            <SelectContent>
                               {roles?.map(r => (
                                 <SelectItem key={r.id} value={r.id!} className="font-bold">{isRtl ? r.name : r.nameEn}</SelectItem>
                               ))}
                            </SelectContent>
                         </Select>
                      </div>
                    </div>
                    <DialogFooter className="mt-6">
                      <Button onClick={handleSaveJob} disabled={loadingAction === 'save_job'} className="w-full h-12 rounded-xl font-bold bg-primary text-white">
                        {loadingAction === 'save_job' ? <Loader2 className="animate-spin" /> : t('save')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {!selectedDept ? (
                <div className="py-20 text-center italic text-muted-foreground flex flex-col items-center gap-2">
                  <ChevronRight className={cn("h-10 w-10 opacity-10", !isRtl && "rotate-180")} />
                  {isRtl ? 'يرجى اختيار قسم لعرض الوظائف' : 'Select a department to view jobs'}
                </div>
              ) : (
                jobsLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs?.map(job => (
                      <div key={job.id} className="p-4 rounded-2xl border-2 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between group">
                        <div className="text-start">
                           <span className="text-sm font-black block">{isRtl ? job.name : job.nameEn}</span>
                           <span className="text-[9px] font-bold text-primary flex items-center gap-1 mt-1">
                              <ShieldCheck className="h-2.5 w-2.5" /> {job.roleName || (isRtl ? 'بدون دور' : 'No Role')}
                           </span>
                        </div>
                        <div className="flex gap-1 z-20">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setJobForm(job); setIsJobOpen(true); }}>
                             <Edit3 className="h-4 w-4" />
                           </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
