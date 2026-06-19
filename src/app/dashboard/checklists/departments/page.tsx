'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Briefcase, Search, Zap
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { DepartmentService } from '@/services/department-service';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Department, Job } from '@/types/reference';
import { translateText } from '@/ai/flows/translate-flow';

export default function DepartmentsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const [deptForm, setDeptForm] = useState<Partial<Department>>({ name: '', nameEn: '', description: '' });
  const [jobForm, setJobForm] = useState<Partial<Job>>({ name: '', nameEn: '' });

  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const lastEditedField = useRef<'name' | 'nameEn' | null>(null);

  const deptService = useMemo(() => db && companyId ? new DepartmentService(db, companyId) : null, [db, companyId]);
  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId))) : null, [db, companyId]);
  const jobsQuery = useMemo(() => companyId && db && selectedDept?.id ? query(collection(db, paths.jobs(companyId, selectedDept.id))) : null, [db, companyId, selectedDept]);

  const { data: departments, loading: deptsLoading } = useCollection<Department>(deptsQuery);
  const { data: jobs, loading: jobsLoading } = useCollection<Job>(jobsQuery);

  // منطق الترجمة الموحد والمستقر
  useEffect(() => {
    const field = lastEditedField.current;
    if (!autoTranslate || !field || deptForm.id) return;
    
    const value = field === 'name' ? deptForm.name : deptForm.nameEn;
    if (!value || value.length < 3) return;

    const timer = setTimeout(async () => {
      setIsTranslating(true);
      const targetLang = field === 'name' ? 'en' : 'ar';
      const targetField = field === 'name' ? 'nameEn' : 'name';
      
      const res = await translateText({ text: value, targetLang });
      if (res.translatedText) {
        setDeptForm(prev => ({ ...prev, [targetField]: res.translatedText }));
      }
      setIsTranslating(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [deptForm.name, deptForm.nameEn, autoTranslate]);

  useEffect(() => {
    const field = lastEditedField.current;
    if (!autoTranslate || !field || jobForm.id) return;
    
    const value = field === 'name' ? jobForm.name : jobForm.nameEn;
    if (!value || value.length < 3) return;

    const timer = setTimeout(async () => {
      setIsTranslating(true);
      const targetLang = field === 'name' ? 'en' : 'ar';
      const targetField = field === 'name' ? 'nameEn' : 'name';
      
      const res = await translateText({ text: value, targetLang });
      if (res.translatedText) {
        setJobForm(prev => ({ ...prev, [targetField]: res.translatedText }));
      }
      setIsTranslating(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [jobForm.name, jobForm.nameEn, autoTranslate]);

  const handleSaveDept = () => {
    if (!deptService || !deptForm.name) return;
    setLoadingAction('dept');
    const data = { ...deptForm, order: 0, isActive: true, name: deptForm.name || '', nameEn: deptForm.nameEn || '' };
    if (deptForm.id) deptService.updateDepartment(deptForm.id, data);
    else deptService.addDepartment(data as any);
    toast({ title: t('saved') });
    setDeptForm({ name: '', nameEn: '', description: '' });
    setLoadingAction(null);
  };

  const handleSaveJob = () => {
    if (!deptService || !selectedDept?.id || !jobForm.name) return;
    setLoadingAction('job');
    const data = { ...jobForm, order: 0, isActive: true, name: jobForm.name || '', nameEn: jobForm.nameEn || '' };
    deptService.addJob(selectedDept.id, data as any);
    toast({ title: t('saved') });
    setJobForm({ name: '', nameEn: '' });
    setLoadingAction(null);
  };

  const RenderAutoTranslateToggle = () => (
    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full ring-1 ring-black/5">
      <Zap className={cn("h-3 w-3", autoTranslate ? "text-primary" : "text-slate-400")} />
      <span className="text-[10px] font-black text-slate-600">{isRtl ? 'ترجمة تلقائية' : 'Auto-Translate'}</span>
      <Switch checked={autoTranslate} onCheckedChange={setAutoTranslate} className="scale-75" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-start"><Building2 className="h-6 w-6 text-primary" /> {isRtl ? 'الهيكل التنظيمي' : 'Organizational Structure'}</h2>
        <Dialog><DialogTrigger asChild><Button onClick={() => setDeptForm({ name: '', nameEn: '', description: '' })} className="rounded-xl"><Plus className="me-2 h-4 w-4" /> {t('newDept')}</Button></DialogTrigger>
          <DialogContent className="rounded-[2.5rem] max-w-2xl p-8" dir={dir}>
            <DialogHeader className="flex flex-row items-center justify-between mb-4"><DialogTitle className="text-start font-black text-2xl">{deptForm.id ? t('edit') : t('newDept')}</DialogTitle>{!deptForm.id && <RenderAutoTranslateToggle />}</DialogHeader>
            <div className="grid grid-cols-2 gap-6 py-4 text-start">
              <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={deptForm.name || ''} onChange={e => { lastEditedField.current='name'; setDeptForm(prev => ({...prev, name: e.target.value})); }} /></div>
              <div className="space-y-2 relative"><Label>{t('name')} (En)</Label><Input value={deptForm.nameEn || ''} onChange={e => { lastEditedField.current='nameEn'; setDeptForm(prev => ({...prev, nameEn: e.target.value})); }} className="text-start" dir="ltr" />{isTranslating && <div className="absolute right-3 top-9"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>}</div>
              <div className="col-span-2 space-y-2"><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={deptForm.description || ''} onChange={e => setDeptForm({...deptForm, description: e.target.value})} /></div>
            </div>
            <DialogFooter className="mt-6"><Button onClick={handleSaveDept} disabled={loadingAction === 'dept'} className="w-full h-12 rounded-xl font-bold bg-primary text-white">{loadingAction === 'dept' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 text-start">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-4"><div className="relative"><Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder={t('search')} className="ps-10 rounded-xl bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {deptsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                departments?.filter(d => d.name.includes(searchTerm)).map(dept => (
                  <div key={dept.id} onClick={() => setSelectedDept(dept)} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all group", selectedDept?.id === dept.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                    <span className="text-sm font-black">{isRtl ? dept.name : dept.nameEn}</span>
                    <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDeptForm(dept); }} className="h-8 w-8 text-blue-600 opacity-0 group-hover:opacity-100"><Edit3 className="h-4 w-4" /></Button><ChevronRight className={cn("h-4 w-4", isRtl && 'rotate-180', selectedDept?.id === dept.id && 'text-primary')} /></div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-7", !selectedDept && 'opacity-40')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white text-start">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between"><div><CardTitle className="text-lg font-black flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> {isRtl ? 'الوظائف' : 'Job Titles'}</CardTitle></div>{selectedDept && (
              <Dialog><DialogTrigger asChild><Button variant="secondary" size="sm" className="rounded-xl h-10 px-4"><Plus className="me-2 h-4 w-4" /> {isRtl ? 'وظيفة' : 'Add Job'}</Button></DialogTrigger>
                <DialogContent className="rounded-[2.5rem] p-8" dir={dir}>
                  <DialogHeader className="flex flex-row items-center justify-between mb-4"><DialogTitle className="text-start font-black">{isRtl ? 'إضافة وظيفة' : 'Add Job'}</DialogTitle><RenderAutoTranslateToggle /></DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4 text-start">
                    <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={jobForm.name || ''} onChange={e => { lastEditedField.current='name'; setJobForm(prev => ({...prev, name: e.target.value})); }} /></div>
                    <div className="space-y-2 relative"><Label>{t('name')} (En)</Label><Input value={jobForm.nameEn || ''} onChange={e => { lastEditedField.current='nameEn'; setJobForm(prev => ({...prev, nameEn: e.target.value})); }} className="text-start" dir="ltr" />{isTranslating && <div className="absolute right-3 top-9"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>}</div>
                  </div>
                  <DialogFooter className="mt-6"><Button onClick={handleSaveJob} disabled={loadingAction === 'job'} className="w-full h-12 rounded-xl font-bold bg-primary text-white">{t('save')}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}</CardHeader>
            <CardContent className="p-6">
              {!selectedDept ? <div className="py-20 text-center italic text-muted-foreground">اختر قسماً</div> : (
                jobsLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs?.map(job => (
                      <div key={job.id} className="p-4 rounded-2xl border-2 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between group">
                        <span className="text-sm font-black">{isRtl ? job.name : job.nameEn}</span>
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