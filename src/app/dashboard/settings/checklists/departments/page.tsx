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
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!deptService) return;
    setLoadingAction(`delete_dept_${id}`);
    try {
      await deptService.deleteDepartment(id);
      if (selectedDept?.id === id) setSelectedDept(null);
      toast({ title: t('deleted') });
    } finally {
      setLoadingAction(null);
      setDeletingId(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!deptService || !selectedDept?.id) return;
    setLoadingAction(`delete_job_${jobId}`);
    try {
      await deptService.deleteJob(selectedDept.id, jobId);
      toast({ title: t('deleted') });
    } finally {
      setLoadingAction(null);
      setDeletingId(null);
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        disabled={loadingAction === `delete_dept_${dept.id}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingId(dept.id!); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className={cn("h-4 w-4 ms-2", isRtl && 'rotate-180', selectedDept?.id === dept.id && 'text-primary')} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-7", !selectedDept && 'opacity-60')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white text-start">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div><CardTitle className="text-lg font-black flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> {isRtl ? 'الوظائف' : 'Job Titles'}</CardTitle></div>
              
              <Dialog open={isJobOpen} onOpenChange={setIsJobOpen}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={!selectedDept}
                    className="rounded-xl h-12 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-lg shadow-blue-500/20 hover:scale-105 transition-all gap-2"
                    onClick={() => setJobForm({ name: '', nameEn: '', roleId: '' })}
                  >
                    <Plus className="h-5 w-5" /> {isRtl ? 'إضافة وظيفة جديدة' : 'Add Sub-Job'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] p-8 max-w-xl border-0 shadow-3xl" dir={dir}>
                  <DialogHeader className="text-start">
                    <DialogTitle className="font-black text-2xl flex items-center gap-3">
                       <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Plus className="h-6 w-6" /></div>
                       {jobForm.id ? (isRtl ? 'تعديل بيانات الوظيفة' : 'Edit Job') : (isRtl ? 'إضافة وظيفة للقسم' : 'Add New Job')}
                    </DialogTitle>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{isRtl ? `القسم: ${selectedDept?.name}` : `Dept: ${selectedDept?.nameEn}`}</p>
                  </DialogHeader>
                  <div className="space-y-6 py-4 text-start">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (Ar)</Label><Input value={jobForm.name || ''} onChange={e => setJobForm({...jobForm, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" /></div>
                      <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (En)</Label><Input value={jobForm.nameEn || ''} onChange={e => setJobForm({...jobForm, nameEn: e.target.value})} className="h-12 rounded-xl border-2 font-bold text-start" dir="ltr" /></div>
                    </div>
                    
                    <div className="p-6 bg-primary/5 rounded-2xl border-2 border-primary/10 space-y-4">
                        <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                          <ShieldCheck className="h-4 w-4" /> {isRtl ? 'ربط الصلاحيات (الدور الأمني)' : 'Security Permissions Link'}
                        </div>
                        <Select value={jobForm.roleId} onValueChange={v => setJobForm({...jobForm, roleId: v})}>
                          <SelectTrigger className="h-12 rounded-xl bg-white border-2 font-black">
                              <SelectValue placeholder={isRtl ? "اختر قالب الصلاحيات لهذا المسمى" : "Select Permission Template"} />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                              {roles?.map(r => (
                                <SelectItem key={r.id} value={r.id!} className="font-bold">{isRtl ? r.name : r.nameEn}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button onClick={handleSaveJob} disabled={loadingAction === 'save_job'} className="w-full h-16 rounded-2xl font-black text-xl bg-blue-600 text-white shadow-xl shadow-blue-500/20">
                      {loadingAction === 'save_job' ? <Loader2 className="animate-spin" /> : t('save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-6">
              {!selectedDept ? (
                <div className="py-20 text-center italic text-muted-foreground flex flex-col items-center gap-4 opacity-40">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center"><ChevronRight className={cn("h-8 w-8", !isRtl && "rotate-180")} /></div>
                  <p className="font-black">{isRtl ? 'يرجى اختيار قسم من القائمة اليمنى لإدارة الوظائف التابعة له.' : 'Please select a department to manage its sub-jobs.'}</p>
                </div>
              ) : (
                jobsLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs?.map(job => (
                      <div key={job.id} className="p-5 rounded-2xl border-2 border-slate-50 bg-white hover:border-blue-200 transition-all flex items-center justify-between group shadow-sm">
                        <div className="text-start">
                           <span className="text-sm font-black text-slate-800 block">{isRtl ? job.name : job.nameEn}</span>
                           <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1 mt-1">
                              <ShieldCheck className="h-2.5 w-2.5" /> {job.roleName || (isRtl ? 'بدون دور محدد' : 'No Role Assigned')}
                           </span>
                        </div>
                        <div className="flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setJobForm(job); setIsJobOpen(true); }}>
                             <Edit3 className="h-4 w-4" />
                           </Button>
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-rose-50"
                            disabled={loadingAction === `delete_job_${job.id}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingId(job.id!); }}
                           >
                            <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      </div>
                    ))}
                    {jobs?.length === 0 && (
                      <div className="col-span-full py-16 text-center text-slate-300 font-bold border-2 border-dashed rounded-3xl">
                         {isRtl ? 'لا توجد وظائف مضافة لهذا القسم.' : 'No sub-jobs in this department.'}
                      </div>
                    )}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2rem] p-8" dir={dir}>
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
               <AlertTriangle className="h-8 w-8" />
            </div>
            <AlertDialogTitle className="text-start font-black text-2xl">{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start font-bold">
              {isRtl ? 'هل أنت متأكد من الحذف؟ سيتم إزالة السجل نهائياً من النظام.' : 'Are you sure? This will permanently remove the record.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="rounded-xl h-12 font-bold border-2">{isRtl ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deletingId) {
                  const isDept = departments?.some(d => d.id === deletingId);
                  if (isDept) handleDeleteDept(deletingId);
                  else handleDeleteJob(deletingId);
                }
              }}
              className="rounded-xl h-12 font-black bg-rose-600 hover:bg-rose-700 text-white px-8"
            >
              {isRtl ? 'نعم، احذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
