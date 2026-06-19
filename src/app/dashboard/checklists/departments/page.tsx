'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Briefcase, Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export default function DepartmentsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const [deptForm, setDeptForm] = useState<Partial<Department>>({
    name: '', nameEn: '', description: '', isActive: true, order: 0, activityTypes: []
  });
  const [jobForm, setJobForm] = useState<Partial<Job>>({
    name: '', nameEn: '', isActive: true, order: 0
  });

  const deptService = useMemo(() => db && companyId ? new DepartmentService(db, companyId) : null, [db, companyId]);

  const deptsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null
  , [db, companyId]);

  const jobsQuery = useMemo(() => 
    companyId && db && selectedDept?.id ? query(collection(db, paths.jobs(companyId, selectedDept.id)), orderBy('order')) : null
  , [db, companyId, selectedDept]);

  const { data: departments, loading: deptsLoading } = useCollection<Department>(deptsQuery);
  const { data: jobs, loading: jobsLoading } = useCollection<Job>(jobsQuery);

  const filteredDepts = departments?.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSaveDept = async () => {
    if (!deptService || !deptForm.name) return;
    setLoadingAction('dept');
    try {
      if (deptForm.id) {
        await deptService.updateDepartment(deptForm.id, deptForm);
      } else {
        await deptService.addDepartment({ ...deptForm, code: '' } as any);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setDeptForm({ name: '', nameEn: '', description: '', isActive: true, order: 0, activityTypes: [] });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveJob = async () => {
    if (!deptService || !selectedDept?.id || !jobForm.name) return;
    setLoadingAction('job');
    try {
      const data = { ...jobForm, departmentCode: '' } as any;
      if (jobForm.id) {
        await deptService.updateJob(selectedDept.id, jobForm.id, data);
      } else {
        await deptService.addJob(selectedDept.id, { ...data, code: '' });
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setJobForm({ name: '', nameEn: '', isActive: true, order: 0 });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!deptService || !confirm(t('confirmDelete'))) return;
    try {
      await deptService.deleteDepartment(id);
      if (selectedDept?.id === id) setSelectedDept(null);
      toast({ title: t('deleted') });
    } catch (e) {}
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!deptService || !selectedDept?.id || !confirm(t('confirmDelete'))) return;
    try {
      await deptService.deleteJob(selectedDept.id, jobId);
      toast({ title: t('deleted') });
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          {isRtl ? 'الهيكل التنظيمي' : 'Organizational Structure'}
        </h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setDeptForm({ name: '', nameEn: '', description: '', isActive: true, order: (departments?.length || 0) + 1, activityTypes: [] })} className="rounded-xl">
              <Plus className="me-2 h-4 w-4" /> {t('newDept')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl max-w-2xl" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-2xl">{deptForm.id ? (isRtl ? 'تعديل قسم' : 'Edit Dept') : t('newDept')}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={deptForm.order || ''} onChange={e => setDeptForm({...deptForm, order: Number(e.target.value)})} /></div>
              <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={deptForm.name || ''} onChange={e => setDeptForm({...deptForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={deptForm.nameEn || ''} onChange={e => setDeptForm({...deptForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
              <div className="flex items-center gap-4"><Label>{t('active')}</Label><Switch checked={deptForm.isActive || false} onCheckedChange={val => setDeptForm({...deptForm, isActive: val})} /></div>
              <div className="md:col-span-2 space-y-2"><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={deptForm.description || ''} onChange={e => setDeptForm({...deptForm, description: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveDept} disabled={loadingAction === 'dept'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'dept' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 text-start">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-4">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('search')} className="ps-10 rounded-xl h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {deptsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                filteredDepts.map(dept => (
                  <div key={dept.id} onClick={() => setSelectedDept(dept)} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all group", selectedDept?.id === dept.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                    <div className="text-start">
                      <span className="text-sm font-black">{isRtl ? dept.name : dept.nameEn}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDeptForm(dept); }} className="h-8 w-8 text-blue-600 opacity-0 group-hover:opacity-100"><Edit3 className="h-4 w-4" /></Button>
                       <ChevronRight className={cn("h-4 w-4 transition-transform", isRtl && 'rotate-180', selectedDept?.id === dept.id && 'scale-125 text-primary')} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-7 transition-opacity", !selectedDept && 'opacity-40')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white text-start">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-lg font-black flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> {isRtl ? 'الوظائف' : 'Job Titles'}</CardTitle>
                <CardDescription>{selectedDept ? (isRtl ? `قسم: ${selectedDept.name}` : `Dept: ${selectedDept.nameEn}`) : (isRtl ? 'اختر قسماً للعرض' : 'Select a dept')}</CardDescription>
              </div>
              {selectedDept && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="rounded-xl h-10 px-4"><Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة وظيفة' : 'Add Job'}</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl" dir={dir}>
                    <DialogHeader><DialogTitle className="text-start font-black">{isRtl ? 'إضافة وظيفة جديدة' : 'Add New Job'}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-1 gap-4 py-4 text-start">
                      <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={jobForm.name || ''} onChange={e => setJobForm({...jobForm, name: e.target.value})} /></div>
                      <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={jobForm.nameEn || ''} onChange={e => setJobForm({...jobForm, nameEn: e.target.value})} /></div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveJob} disabled={loadingAction === 'job'} className="w-full h-12 rounded-xl">{loadingAction === 'job' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {!selectedDept ? <div className="py-20 text-center italic text-muted-foreground">{isRtl ? 'يرجى اختيار قسم' : 'Please select a department'}</div> : (
                jobsLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs?.map(job => (
                      <div key={job.id} className="p-4 rounded-2xl border-2 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all flex items-center justify-between group text-start">
                        <div className="text-start">
                          <p className="text-sm font-black">{isRtl ? job.name : job.nameEn}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button variant="ghost" size="icon" onClick={() => setJobForm(job)} className="h-8 w-8 text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteJob(job.id!)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
