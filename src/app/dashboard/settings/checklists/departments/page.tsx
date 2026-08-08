'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Briefcase, Search
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
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Department, Job } from '@/types/reference';
import { Role } from '@/types/roles';

export default function DepartmentsPage() {
  const { globalUser } = useAuthContext();
  const { t, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [isJobOpen, setIsJobOpen] = useState(false);
  const [deptForm, setDeptForm] = useState<Partial<Department>>({ name: '', nameEn: '', description: '' });
  const [jobForm, setJobForm] = useState<Partial<Job>>({ name: '', nameEn: '', roleId: '', hourlyCost: 0 });

  const deptService = useMemo(() => db && companyId ? new DepartmentService(db, companyId) : null, [db, companyId]);
  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null, [db, companyId]);
  const jobsQuery = useMemo(() => companyId && db && selectedDept?.id ? query(collection(db, paths.jobs(companyId, selectedDept.id)), orderBy('order')) : null, [db, companyId, selectedDept]);
  const rolesQuery = useMemo(() => companyId && db ? query(collection(db, paths.roles(companyId)), orderBy('order')) : null, [db, companyId]);

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
      toast({ title: t('common.saved') });
      setIsDeptOpen(false);
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
        roleCode: selectedRole?.code?.toUpperCase() || '',
        name: jobForm.name || '', 
        nameEn: jobForm.nameEn || '',
        departmentName: selectedDept.name
      };
      if (jobForm.id) await deptService.updateJob(selectedDept.id, jobForm.id, data);
      else await deptService.addJob(selectedDept.id, data as any);
      toast({ title: t('common.saved') });
      setIsJobOpen(false);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 text-start">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
           <Building2 className="h-6 w-6 text-primary" /> {t('orgRef')}
        </h2>
        <Dialog open={isDeptOpen} onOpenChange={setIsDeptOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDeptForm({ name: '', nameEn: '', description: '' })} className="rounded-xl h-11 shadow-lg">
              <Plus className="me-2 h-4 w-4" /> {t('newDept')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl p-8 max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
            <DialogHeader className="text-start"><DialogTitle className="font-black text-2xl">{deptForm.id ? t('common.edit') : t('newDept')}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('common.nameAr')}</Label><Input value={deptForm.name || ''} onChange={e => setDeptForm({...deptForm, name: e.target.value})} className="h-11 border-2 font-black" /></div>
              <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('common.nameEn')}</Label><Input value={deptForm.nameEn || ''} onChange={e => setDeptForm({...deptForm, nameEn: e.target.value})} className="h-11 border-2 text-start font-bold" dir="ltr" /></div>
              <div className="col-span-2 space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('common.notes')}</Label><Textarea value={deptForm.description || ''} onChange={e => setDeptForm({...deptForm, description: e.target.value})} className="min-h-[100px] border-2" /></div>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button onClick={handleSaveDept} disabled={loadingAction === 'save_dept'} className="w-full h-14 rounded-2xl font-black text-xl">
                {loadingAction === 'save_dept' ? <Loader2 className="animate-spin" /> : t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <Card className="border-0 shadow-xl rounded-xl overflow-hidden bg-white ring-1 ring-black/5 text-start">
            <CardHeader className="bg-slate-50/50 border-b p-4">
              <div className="relative">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                <Input placeholder={t('common.search')} className="ps-12 h-11 bg-white rounded-xl border-2" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto scrollbar-hide">
              {deptsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                departments?.filter(d => d.name.includes(searchTerm)).map(dept => (
                  <div key={dept.id} onClick={() => setSelectedDept(dept)} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all group", selectedDept?.id === dept.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                    <span className="text-sm font-black">{isRtl ? dept.name : dept.nameEn}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeptForm(dept); setIsDeptOpen(true); }} className="h-8 w-8 text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                      <ChevronRight className={cn("h-4 w-4 ms-2", isRtl && 'rotate-180', selectedDept?.id === dept.id && 'text-primary')} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-7", !selectedDept && 'opacity-60')}>
          <Card className="border-0 shadow-xl rounded-xl overflow-hidden bg-white ring-1 ring-black/5 text-start">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div><CardTitle className="text-lg font-black flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> {isRtl ? 'الوظائف' : 'Jobs'}</CardTitle></div>
              {selectedDept && (
                <Button variant="outline" size="sm" className="rounded-xl h-10 px-6 font-black border-2" onClick={() => setIsJobOpen(true)}>
                  <Plus className="me-2 h-4 w-4" /> {t('common.add')}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {!selectedDept ? (
                <div className="py-32 text-center italic text-slate-300 font-black flex flex-col items-center gap-4">
                   <Building2 className="h-16 w-16 opacity-10" />
                   {isRtl ? 'اختر قسماً من القائمة' : 'Select a department'}
                </div>
              ) : (
                jobsLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs?.map(job => (
                      <div key={job.id} className="p-5 rounded-2xl border-2 border-slate-50 bg-white hover:border-primary/20 transition-all flex items-center justify-between group shadow-sm">
                        <span className="text-sm font-black text-slate-800">{isRtl ? job.name : job.nameEn}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isJobOpen} onOpenChange={setIsJobOpen}>
         <DialogContent className="rounded-xl p-8 max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
            <DialogHeader className="text-start"><DialogTitle className="font-black text-2xl">{isRtl ? 'إضافة وظيفة جديدة' : 'Add New Job'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-6 py-6 text-start">
               <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('common.nameAr')}</Label><Input value={jobForm.name} onChange={e => setJobForm({...jobForm, name: e.target.value})} className="h-11 border-2 font-black" /></div>
               <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('common.nameEn')}</Label><Input value={jobForm.nameEn} onChange={e => setJobForm({...jobForm, nameEn: e.target.value})} className="h-11 border-2 text-start font-bold" dir="ltr" /></div>
            </div>
            <DialogFooter>
               <Button onClick={handleSaveJob} disabled={loadingAction === 'save_job'} className="w-full h-14 rounded-2xl font-black text-xl">
                  {loadingAction === 'save_job' ? <Loader2 className="animate-spin" /> : t('common.save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}