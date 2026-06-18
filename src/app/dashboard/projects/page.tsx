'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  HardHat, Sparkles, TrendingUp, DollarSign, 
  Calendar, RefreshCw, Plus, Search, 
  FolderKanban, Loader2, ArrowRight
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ProjectsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newProject, setNewProject] = useState({ 
    name: '', 
    transactionTypeId: '', 
    subServiceId: '', 
    budget: '', 
    status: 'active' 
  });

  const projectsQuery = useMemo(() => companyId && db ? query(collection(db, paths.projects(companyId)), orderBy('createdAt', 'desc')) : null, [db, companyId]);
  const txTypesQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactionTypes(companyId)), orderBy('name')) : null, [db, companyId]);
  const subServicesQuery = useMemo(() => companyId && db && newProject.transactionTypeId ? query(collection(db, paths.subServices(companyId, newProject.transactionTypeId)), orderBy('name')) : null, [db, companyId, newProject.transactionTypeId]);

  const { data: projects, loading: projectsLoading } = useCollection(projectsQuery);
  const { data: txTypes } = useCollection(txTypesQuery);
  const { data: subServices } = useCollection(subServicesQuery);

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.transactionTypeId || !companyId || !db) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, paths.projects(companyId)), {
        ...newProject,
        budget: Number(newProject.budget) || 0,
        createdAt: serverTimestamp(),
      });
      toast({ title: t('saved'), description: lang === 'ar' ? 'تم إنشاء المشروع وربطه بالمسار الفني.' : 'Project created and linked to technical path.' });
      setNewProject({ name: '', transactionTypeId: '', subServiceId: '', budget: '', status: 'active' });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setIsAdding(false);
    }
  };

  const filteredProjects = projects?.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  return (
    <div className="space-y-12" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-5xl font-black font-headline flex items-center gap-4">
            <div className="p-3 bg-solaris-gradient rounded-2xl text-white shadow-lg">
              <HardHat className="h-10 w-10" />
            </div>
            {t('projects')}
          </h1>
          <p className="text-black/40 mt-3 text-lg font-bold tracking-tight">
            {lang === 'ar' ? 'إدارة المسارات الهندسية في Solaris' : 'Managing Engineering Paths in Solaris'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-solaris-gradient text-white font-black rounded-3xl px-10 py-8 text-xl shadow-xl hover:scale-[1.02] transition-all">
              <Plus className="me-3 h-7 w-7" />
              {lang === 'ar' ? 'مشروع جديد' : 'New Project'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl max-w-2xl bg-white/95 backdrop-blur-xl" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-start font-headline font-black text-3xl mb-2">{lang === 'ar' ? 'فتح مشروع جديد' : 'Open New Project'}</DialogTitle>
              <DialogDescription className="text-start text-lg">{lang === 'ar' ? 'قم بتعريف المشروع وربطه بمسار فني.' : 'Define project and link it to a technical path.'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8">
              <div className="space-y-3 text-start">
                <Label className="text-black font-black">{lang === 'ar' ? 'اسم المشروع' : 'Project Name'}</Label>
                <Input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder={lang === 'ar' ? 'فيلا الجابرية' : 'Jabriya Villa'} className="h-14 rounded-2xl border-2 focus:border-primary/50" />
              </div>
              <div className="space-y-3 text-start">
                <Label className="text-black font-black">{lang === 'ar' ? 'الميزانية (د.ك)' : 'Budget (KWD)'}</Label>
                <Input type="number" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: e.target.value})} placeholder="5000" className="h-14 rounded-2xl border-2 focus:border-primary/50" />
              </div>
              <div className="space-y-3 text-start">
                <Label className="text-black font-black">{t('txTypes')}</Label>
                <Select value={newProject.transactionTypeId} onValueChange={val => setNewProject({...newProject, transactionTypeId: val, subServiceId: ''})}>
                  <SelectTrigger className="h-14 rounded-2xl border-2"><SelectValue placeholder={t('search')} /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {txTypes?.map(tx => <SelectItem key={tx.id} value={tx.id}>{tx.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 text-start">
                <Label className="text-black font-black">{t('subSrvs')}</Label>
                <Select value={newProject.subServiceId} onValueChange={val => setNewProject({...newProject, subServiceId: val})} disabled={!newProject.transactionTypeId}>
                  <SelectTrigger className="h-14 rounded-2xl border-2"><SelectValue placeholder={t('search')} /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {subServices?.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateProject} disabled={isAdding || !newProject.name} className="w-full h-16 rounded-3xl font-black text-xl bg-solaris-gradient text-white shadow-xl">
                {isAdding ? <Loader2 className="animate-spin" /> : <Sparkles className="me-2 h-6 w-6" />}
                {lang === 'ar' ? 'بدء المشروع' : 'Start Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-10 rounded-[2.5rem] flex items-center justify-between group hover:scale-[1.02] transition-all">
          <div className="text-start">
            <p className="text-xs font-black text-black/40 uppercase tracking-[0.3em] mb-3">{lang === 'ar' ? 'إجمالي المشاريع' : 'Total Projects'}</p>
            <h3 className="text-6xl font-black font-headline text-black">{projects?.length || 0}</h3>
          </div>
          <div className="p-6 bg-primary/10 rounded-3xl text-primary group-hover:bg-solaris-gradient group-hover:text-white transition-all shadow-inner">
            <FolderKanban className="h-12 w-12" />
          </div>
        </div>
        <div className="glass-card p-10 rounded-[2.5rem] flex items-center justify-between group hover:scale-[1.02] transition-all">
          <div className="text-start">
            <p className="text-xs font-black text-black/40 uppercase tracking-[0.3em] mb-3">{lang === 'ar' ? 'السيولة المستهدفة' : 'Target Liquidity'}</p>
            <h3 className="text-4xl font-black font-headline text-black">
              {filteredProjects.reduce((acc, p) => acc + (p.budget || 0), 0).toLocaleString()} <span className="text-2xl text-black/30">د.ك</span>
            </h3>
          </div>
          <div className="p-6 bg-emerald-500/10 rounded-3xl text-emerald-600 shadow-inner">
            <DollarSign className="h-12 w-12" />
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="mb-8 flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-black/30" />
            <Input 
              placeholder={t('search')} 
              className="ps-14 h-16 rounded-3xl border-0 bg-white/50 backdrop-blur-md shadow-inner text-lg font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-[2.5rem] bg-transparent">
          <Table className="border-separate border-spacing-y-4">
            <TableHeader>
              <TableRow className="bg-solaris-gradient hover:bg-solaris-gradient rounded-2xl overflow-hidden border-0 shadow-lg">
                <TableHead className="text-start font-black text-white h-16 ps-8 rounded-s-2xl uppercase tracking-widest text-xs">{lang === 'ar' ? 'المشروع' : 'Project'}</TableHead>
                <TableHead className="text-start font-black text-white h-16 uppercase tracking-widest text-xs">{t('txTypes')}</TableHead>
                <TableHead className="text-start font-black text-white h-16 uppercase tracking-widest text-xs">{lang === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-end font-black text-white h-16 uppercase tracking-widest text-xs">{lang === 'ar' ? 'الميزانية' : 'Budget'}</TableHead>
                <TableHead className="text-center font-black text-white h-16 rounded-e-2xl uppercase tracking-widest text-xs pe-8">{lang === 'ar' ? 'المسار' : 'Path'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-14 w-14 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 glass-card rounded-[2.5rem] text-black/30 font-black text-2xl italic">{lang === 'ar' ? 'لا توجد مشاريع نشطة' : 'No active projects'}</TableCell></TableRow>
              ) : (
                filteredProjects.map((project: any) => (
                  <TableRow key={project.id} className="floating-row group cursor-pointer border-0">
                    <TableCell className="text-start py-8 ps-8">
                      <div className="flex flex-col">
                        <span className="font-black text-2xl text-black group-hover:text-primary transition-colors">{project.name}</span>
                        <span className="text-[10px] text-black/30 font-mono tracking-tighter">REF: {project.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge variant="secondary" className="bg-black/5 text-black font-black px-4 py-1.5 rounded-xl border-0">{txTypes?.find(t => t.id === project.transactionTypeId)?.name || '...'}</Badge>
                    </TableCell>
                    <TableCell className="text-start">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-3 w-3 rounded-full", project.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-black/20')} />
                        <span className="font-black text-sm">{project.status === 'active' ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'مكتمل' : 'Completed')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-2xl text-black">
                      {project.budget?.toLocaleString()} <span className="text-sm text-black/30">د.ك</span>
                    </TableCell>
                    <TableCell className="text-center pe-8">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 text-black group-hover:bg-solaris-gradient group-hover:text-white transition-all shadow-sm">
                        <ArrowRight className={cn("h-6 w-6", dir === 'rtl' && "rotate-180")} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}