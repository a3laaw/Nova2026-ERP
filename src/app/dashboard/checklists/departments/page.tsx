'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Briefcase, Search, CheckCircle2, XCircle
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  
  // Forms states
  const [deptForm, setDeptForm] = useState<Partial<Department>>({
    code: '', name: '', nameEn: '', description: '', isActive: true, order: 0, activityTypes: []
  });
  const [jobForm, setJobForm] = useState<Partial<Job>>({
    code: '', name: '', nameEn: '', isActive: true, order: 0
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
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSaveDept = async () => {
    if (!deptService || !deptForm.name || !deptForm.code) return;
    setLoadingAction('dept');
    try {
      if (deptForm.id) {
        await deptService.updateDepartment(deptForm.id, deptForm);
      } else {
        await deptService.addDepartment(deptForm as any);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setDeptForm({ code: '', name: '', nameEn: '', description: '', isActive: true, order: 0, activityTypes: [] });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveJob = async () => {
    if (!deptService || !selectedDept?.id || !jobForm.name || !jobForm.code) return;
    setLoadingAction('job');
    try {
      const data = { ...jobForm, departmentCode: selectedDept.code } as any;
      if (jobForm.id) {
        await deptService.updateJob(selectedDept.id, jobForm.id, data);
      } else {
        await deptService.addJob(selectedDept.id, data);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setJobForm({ code: '', name: '', nameEn: '', isActive: true, order: 0 });
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
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Building2 className="h-10 w-10 text-primary" />
            {isRtl ? 'الهيكل التنظيمي' : 'Organizational Structure'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة الأقسام والوظائف وتوزيع الصلاحيات الإدارية' : 'Manage departments, jobs, and administrative roles'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setDeptForm({ code: '', name: '', nameEn: '', description: '', isActive: true, order: (departments?.length || 0) + 1, activityTypes: [] })} className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <Plus className="me-2 h-6 w-6" />
              {t('newDept')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-2xl" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-start font-headline font-black text-2xl">{deptForm.id ? (isRtl ? 'تعديل قسم' : 'Edit Dept') : t('newDept')}</DialogTitle>
              <DialogDescription className="text-start">{isRtl ? 'أدخل بيانات القسم الأساسية لتعريف الهيكل التنظيمي.' : 'Enter basic department details.'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2">
                <Label>{isRtl ? 'كود القسم' : 'Dept Code'}</Label>
                <Input value={deptForm.code} onChange={e => setDeptForm({...deptForm, code: e.target.value})} placeholder="ARCH" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? 'الترتيب' : 'Order'}</Label>
                <Input type="number" value={deptForm.order} onChange={e => setDeptForm({...deptForm, order: Number(e.target.value)})} placeholder="1" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{t('name')} (Ar)</Label>
                <Input value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} placeholder="القسم المعماري" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{t('name')} (En)</Label>
                <Input value={deptForm.nameEn} onChange={e => setDeptForm({...deptForm, nameEn: e.target.value})} placeholder="Architectural Dept" className="h-14 rounded-2xl border-2 text-start" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>{isRtl ? 'الوصف' : 'Description'}</Label>
                <Textarea value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} placeholder="..." className="rounded-2xl border-2 min-h-[100px]" />
              </div>
              <div className="flex items-center space-x-4 gap-4">
                <Label>{t('active')}</Label>
                <Switch checked={deptForm.isActive} onCheckedChange={val => setDeptForm({...deptForm, isActive: val})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveDept} disabled={loadingAction === 'dept' || !deptForm.name} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">
                {loadingAction === 'dept' ? <Loader2 className="animate-spin" /> : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Departments Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-6">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t('search')} 
                  className="ps-10 rounded-xl h-12 bg-white text-start" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[700px] overflow-y-auto">
              {deptsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto h-10 w-10 text-primary/30" /></div> : (
                filteredDepts.length === 0 ? <div className="p-20 text-center text-muted-foreground italic font-bold">{t('search')}</div> : (
                  filteredDepts.map(dept => (
                    <div 
                      key={dept.id} 
                      onClick={() => setSelectedDept(dept)}
                      className={cn(
                        "p-6 border-b flex items-center justify-between cursor-pointer transition-all group",
                        selectedDept?.id === dept.id ? 'bg-primary/5 border-s-8 border-s-primary' : 'hover:bg-muted/30'
                      )}
                    >
                      <div className="flex flex-col text-start space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] bg-white">{dept.code}</Badge>
                          <span className="text-base font-black text-slate-800">{isRtl ? dept.name : dept.nameEn}</span>
                        </div>
                        <span className="text-xs text-muted-foreground line-clamp-1">{dept.description || '...'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeptForm(dept); }} className="h-9 w-9 text-blue-600 bg-blue-50 rounded-xl"><Edit3 className="h-4 w-4" /></Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-2xl" dir={dir}>
                               {/* Reusing the same Add dialog content for Edit */}
                               <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{isRtl ? 'تعديل قسم' : 'Edit Dept'}</DialogTitle></DialogHeader>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                                  <div className="space-y-2"><Label>{isRtl ? 'كود القسم' : 'Dept Code'}</Label><Input value={deptForm.code} onChange={e => setDeptForm({...deptForm, code: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                  <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={deptForm.order} onChange={e => setDeptForm({...deptForm, order: Number(e.target.value)})} className="h-14 rounded-2xl border-2" /></div>
                                  <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                  <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={deptForm.nameEn} onChange={e => setDeptForm({...deptForm, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 text-start" /></div>
                                  <div className="md:col-span-2 space-y-2"><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} className="rounded-2xl border-2 min-h-[100px]" /></div>
                                  <div className="flex items-center gap-4"><Label>{t('active')}</Label><Switch checked={deptForm.isActive} onCheckedChange={val => setDeptForm({...deptForm, isActive: val})} /></div>
                               </div>
                               <DialogFooter><Button onClick={handleSaveDept} disabled={loadingAction === 'dept'} className="w-full h-14 rounded-2xl font-black bg-primary">{loadingAction === 'dept' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteDept(dept.id!); }} className="h-9 w-9 text-destructive bg-destructive/5 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <ChevronRight className={cn("h-5 w-5 transition-transform", selectedDept?.id === dept.id ? 'text-primary scale-125' : 'text-muted-foreground', isRtl && selectedDept?.id !== dept.id && 'rotate-180')} />
                      </div>
                    </div>
                  ))
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Jobs Column */}
        <div className={cn("lg:col-span-7 transition-opacity", !selectedDept && 'opacity-30 pointer-events-none')}>
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-xl font-black flex items-center gap-3">
                  <Briefcase className="h-6 w-6 text-primary" />
                  {isRtl ? 'الوظائف المتاحة' : 'Available Jobs'}
                  {selectedDept && <Badge variant="secondary" className="ms-3 bg-primary/10 text-primary font-black">{isRtl ? selectedDept.name : selectedDept.nameEn}</Badge>}
                </CardTitle>
                <CardDescription className="mt-1">{isRtl ? 'قائمة المسميات الوظيفية التابعة لهذا القسم' : 'List of job titles under this department'}</CardDescription>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button disabled={!selectedDept} className="bg-secondary text-primary font-black rounded-xl h-12">
                    <Plus className="me-2 h-5 w-5" />
                    {isRtl ? 'إضافة وظيفة' : 'Add Job'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                  <DialogHeader>
                    <DialogTitle className="text-start font-headline font-black text-2xl">{jobForm.id ? (isRtl ? 'تعديل وظيفة' : 'Edit Job') : (isRtl ? 'إضافة وظيفة جديدة' : 'Add New Job')}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                    <div className="space-y-2">
                      <Label>{isRtl ? 'كود الوظيفة' : 'Job Code'}</Label>
                      <Input value={jobForm.code} onChange={e => setJobForm({...jobForm, code: e.target.value})} placeholder="S-ARCH" className="h-14 rounded-2xl border-2" />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRtl ? 'الترتيب' : 'Order'}</Label>
                      <Input type="number" value={jobForm.order} onChange={e => setJobForm({...jobForm, order: Number(e.target.value)})} placeholder="1" className="h-14 rounded-2xl border-2" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('name')} (Ar)</Label>
                      <Input value={jobForm.name} onChange={e => setJobForm({...jobForm, name: e.target.value})} placeholder="مهندس معماري أول" className="h-14 rounded-2xl border-2" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('name')} (En)</Label>
                      <Input value={jobForm.nameEn} onChange={e => setJobForm({...jobForm, nameEn: e.target.value})} placeholder="Senior Architect" className="h-14 rounded-2xl border-2 text-start" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Label>{t('active')}</Label>
                      <Switch checked={jobForm.isActive} onCheckedChange={val => setJobForm({...jobForm, isActive: val})} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSaveJob} disabled={loadingAction === 'job' || !jobForm.name} className="w-full h-14 rounded-2xl font-black bg-primary">
                      {loadingAction === 'job' ? <Loader2 className="animate-spin" /> : t('save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-8">
              {!selectedDept ? (
                <div className="py-40 text-center space-y-4">
                  <div className="h-20 w-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto">
                    <Building2 className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground font-bold italic">{isRtl ? 'يرجى اختيار قسم لعرض وظائفه' : 'Please select a department to view jobs'}</p>
                </div>
              ) : (
                jobsLoading ? <div className="py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div> : (
                  jobs?.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground font-bold italic">{isRtl ? 'لا توجد وظائف معرّفة لهذا القسم' : 'No jobs defined for this department'}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {jobs?.map(job => (
                        <div key={job.id} className="p-5 rounded-3xl border-2 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:border-primary/20 transition-all group flex items-center justify-between">
                          <div className="flex items-center gap-4 text-start">
                            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm border font-black text-xs text-primary">{job.order}</div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-800">{isRtl ? job.name : job.nameEn}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0">{job.code}</Badge>
                                {job.isActive ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-destructive" />}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setJobForm(job)} className="h-8 w-8 text-blue-600 hover:bg-blue-50"><Edit3 className="h-4 w-4" /></Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                                  <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{isRtl ? 'تعديل وظيفة' : 'Edit Job'}</DialogTitle></DialogHeader>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                                    <div className="space-y-2"><Label>{isRtl ? 'كود الوظيفة' : 'Job Code'}</Label><Input value={jobForm.code} onChange={e => setJobForm({...jobForm, code: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                    <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={jobForm.order} onChange={e => setJobForm({...jobForm, order: Number(e.target.value)})} className="h-14 rounded-2xl border-2" /></div>
                                    <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={jobForm.name} onChange={e => setJobForm({...jobForm, name: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                    <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={jobForm.nameEn} onChange={e => setJobForm({...jobForm, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 text-start" /></div>
                                    <div className="flex items-center gap-4"><Label>{t('active')}</Label><Switch checked={jobForm.isActive} onCheckedChange={val => setJobForm({...jobForm, isActive: val})} /></div>
                                  </div>
                                  <DialogFooter><Button onClick={handleSaveJob} disabled={loadingAction === 'job'} className="w-full h-14 rounded-2xl font-black bg-primary">{loadingAction === 'job' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                                </DialogContent>
                             </Dialog>
                             <Button variant="ghost" size="icon" onClick={() => handleDeleteJob(job.id!)} className="h-8 w-8 text-destructive hover:bg-destructive/5"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
