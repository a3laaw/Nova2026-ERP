'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Briefcase, Search, ShieldCheck,
  AlertTriangle, Clock, UserX
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
  const [jobForm, setJobForm] = useState<Partial<Job>>({ name: '', nameEn: '', roleId: '', hourlyCost: 0 });

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
        roleCode: selectedRole?.code?.toUpperCase() || '',
        name: jobForm.name || '', 
        nameEn: jobForm.nameEn || '',
        departmentName: selectedDept.name
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
    <div className="space-y-6 text-start">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Building2 className="h-6 w-6 text-primary" /> 
            {isRtl ? 'الهيكل التنظيمي والمهن' : 'Organizational Structure'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Departments & Job/Trade Definition</p>
        </div>
        
        <Dialog open={isDeptOpen} onOpenChange={setIsDeptOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDeptForm({ name: '', nameEn: '', description: '' })} variant="default" className="h-11 shadow-lg shadow-primary/20 flex items-center gap-2">
              <Plus className="h-4 w-4 me-2" /> {t('newDept')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl p-8 max-w-2xl border-0 shadow-3xl bg-white" dir={dir}>
            <DialogHeader className="text-start"><DialogTitle className="font-black text-2xl">{deptForm.id ? t('edit') : t('newDept')}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4 text-start">
              <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (Ar)</Label><Input value={deptForm.name || ''} onChange={e => setDeptForm({...deptForm, name: e.target.value})} className="h-11 border-2" /></div>
              <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (En)</Label><Input value={deptForm.nameEn || ''} onChange={e => setDeptForm({...deptForm, nameEn: e.target.value})} className="h-11 border-2 text-start" dir="ltr" /></div>
              <div className="col-span-2 space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={deptForm.description || ''} onChange={e => setDeptForm({...deptForm, description: e.target.value})} className="min-h-[100px] border-2" /></div>
            </div>
            <DialogFooter className="pt-4">
              <Button onClick={handleSaveDept} disabled={loadingAction === 'save_dept'} className="w-full h-12 rounded-xl bg-primary text-white font-black shadow-xl">
                {loadingAction === 'save_dept' ? <Loader2 className="animate-spin" /> : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <Card className="border-0 shadow-lg rounded-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-4 text-start">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input placeholder={t('search')} className="ps-10 h-10 bg-white rounded-xl border-slate-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto scrollbar-hide">
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
                    <div className="flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
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

        <div className={cn("lg:col-span-8", !selectedDept && 'opacity-60')}>
          <Card className="border-0 shadow-lg rounded-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div><CardTitle className="text-lg font-black flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> {isRtl ? 'الوظائف والمهن المعتمدة' : 'Job Titles & Trades'}</CardTitle></div>
              
              <Dialog open={isJobOpen} onOpenChange={setIsJobOpen}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={!selectedDept}
                    variant="outline"
                    className="h-11 transition-all gap-2 rounded-xl border-2"
                    onClick={() => setJobForm({ name: '', nameEn: '', roleId: '', hourlyCost: 0 })}
                  >
                    <Plus className="h-4 w-4" /> {isRtl ? 'إضافة وظيفة/مهنة' : 'Add Job'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-xl p-8 max-w-xl border-0 shadow-3xl bg-white" dir={dir}>
                  <DialogHeader className="text-start">
                    <DialogTitle className="font-black text-2xl flex items-center gap-3">
                       <Plus className="h-6 w-6 text-primary" />
                       {jobForm.id ? (isRtl ? 'تعديل بيانات الوظيفة' : 'Edit Job') : (isRtl ? 'إضافة وظيفة للقسم' : 'Add New Job')}
                    </DialogTitle>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{isRtl ? `القسم: ${selectedDept?.name}` : `Dept: ${selectedDept?.nameEn}`}</p>
                  </DialogHeader>
                  <div className="space-y-6 py-4 text-start bg-white">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (Ar)</Label><Input value={jobForm.name || ''} onChange={e => setJobForm({...jobForm, name: e.target.value})} className="h-11 border-2 font-bold" /></div>
                      <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (En)</Label><Input value={jobForm.nameEn || ''} onChange={e => setJobForm({...jobForm, nameEn: e.target.value})} className="h-11 border-2 font-bold text-start" dir="ltr" /></div>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'تعرفة الساعة المرجعية (KWD)' : 'Reference Hourly Rate'}</Label>
                       <Input type="number" step="0.001" value={jobForm.hourlyCost || ''} onChange={e => setJobForm({...jobForm, hourlyCost: Number(e.target.value)})} className="h-11 border-2 font-black text-emerald-600" />
                    </div>
                    
                    <div className="space-y-2 p-5 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
                       <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-black uppercase text-primary">{isRtl ? 'ربط صلاحيات الوصول للنظام' : 'System Access Role'}</Label>
                          {jobForm.roleId ? <Badge className="bg-primary text-white border-0 text-[8px] font-black h-5">SYSTEM USER</Badge> : <Badge variant="outline" className="text-[8px] font-black border-slate-200 text-slate-400 h-5">FIELD ONLY</Badge>}
                       </div>
                       <Select value={jobForm.roleId || 'NONE'} onValueChange={v => setJobForm({...jobForm, roleId: v === 'NONE' ? '' : v})}>
                         <SelectTrigger className="h-12 rounded-xl bg-white border-2 font-black">
                             <SelectValue placeholder="..." />
                         </SelectTrigger>
                         <SelectContent className="rounded-xl border-0 shadow-2xl">
                             <SelectItem value="NONE" className="font-bold text-xs py-3 border-b text-slate-400 italic">
                                {isRtl ? '--- بدون وصول (مهنة ميدانية فقط) ---' : '--- No Access (Field Trade Only) ---'}
                             </SelectItem>
                             {roles?.map(r => (
                               <SelectItem key={r.id} value={r.id!} className="font-bold text-xs py-3 border-b last:border-0">
                                  {isRtl ? r.name : r.nameEn}
                               </SelectItem>
                             ))}
                         </SelectContent>
                       </Select>
                    </div>
                  </div>
                  <DialogFooter className="pt-4 border-t">
                    <Button onClick={handleSaveJob} disabled={loadingAction === 'save_job'} className="w-full h-14 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">
                      {loadingAction === 'save_job' ? <Loader2 className="animate-spin" /> : (isRtl ? 'اعتماد الوظيفة' : 'Commit Job')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-6">
              {!selectedDept ? (
                <div className="py-20 text-center italic text-muted-foreground flex flex-col items-center gap-4 opacity-40">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border-2 border-slate-100 shadow-inner"><ChevronRight className={cn("h-8 w-8 text-slate-300", !isRtl && "rotate-180")} /></div>
                  <p className="font-black text-slate-400">{isRtl ? 'يرجى اختيار قسم من القائمة لإدارة المهن.' : 'Please select a department.'}</p>
                </div>
              ) : (
                jobsLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs?.map(job => (
                      <div key={job.id} className="p-5 rounded-2xl border-2 border-slate-50 bg-white hover:border-primary/20 transition-all flex items-center justify-between group shadow-sm">
                        <div className="text-start">
                           <span className="text-sm font-black text-slate-800 block leading-none">{isRtl ? job.name : job.nameEn}</span>
                           <div className="flex items-center gap-3 mt-2">
                              <Badge className="bg-emerald-50 text-emerald-600 border-0 font-black text-[9px] px-2">{(job.hourlyCost || 0).toFixed(3)} KWD/hr</Badge>
                              {job.roleId ? (
                                <Badge className="bg-primary/5 text-primary border-primary/20 font-black text-[8px] h-5 px-3 rounded-lg uppercase">
                                   {job.roleName}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-100 font-bold text-[8px] h-5 px-2 gap-1 rounded-lg">
                                   <UserX className="h-2.5 w-2.5" /> {isRtl ? 'ميدانية فقط' : 'Field Only'}
                                </Badge>
                              )}
                           </div>
                        </div>
                        <div className="flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setJobForm(job); setIsJobOpen(true); }}>
                             <Edit3 className="h-4 w-4" />
                           </Button>
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"
                            disabled={loadingAction === `delete_job_${job.id}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingId(job.id!); }}
                           >
                            <Trash2 className="h-4 w-4" />
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

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white" dir={dir}>
          <AlertDialogHeader>
            <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
               <AlertTriangle className="h-10 w-10" />
            </div>
            <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
              {isRtl ? 'هل أنت متأكد؟ سيتم حذف هذا السجل نهائياً من الهيكل التنظيمي ولا يمكن التراجع.' : 'Are you sure? This will permanently delete the record from organizational structure.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deletingId) {
                  const isDept = departments?.some(d => d.id === deletingId);
                  if (isDept) handleDeleteDept(deletingId);
                  else handleDeleteJob(deletingId);
                }
              }}
              className="flex-[2] h-16 rounded-2xl bg-rose-600 text-white font-black text-xl shadow-xl shadow-rose-200"
            >
              {isRtl ? 'نعم، احذف نهائياً' : 'Delete Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}