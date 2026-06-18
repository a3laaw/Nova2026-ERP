
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

  // Queries for Reference Data
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
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <HardHat className="h-10 w-10 text-primary" />
            {t('projects')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {lang === 'ar' ? 'إدارة المشاريع الهندسية وربطها بالدستور الفني للشركة' : 'Manage engineering projects and link them to the technical constitution'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <Plus className="me-2 h-6 w-6" />
              {lang === 'ar' ? 'مشروع جديد' : 'New Project'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-2xl" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-start font-headline font-black text-2xl">{lang === 'ar' ? 'فتح مشروع جديد' : 'Open New Project'}</DialogTitle>
              <DialogDescription className="text-start">{lang === 'ar' ? 'قم بتعريف المشروع وربطه بمسار فني من القوائم المرجعية.' : 'Define project and link it to a technical path from reference data.'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
              <div className="space-y-2 text-start">
                <Label>{lang === 'ar' ? 'اسم المشروع' : 'Project Name'}</Label>
                <Input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder={lang === 'ar' ? 'فيلا الجابرية - ق4' : 'Jabriya Villa - B4'} className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2 text-start">
                <Label>{lang === 'ar' ? 'الميزانية (د.ك)' : 'Budget (KWD)'}</Label>
                <Input type="number" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: e.target.value})} placeholder="5000" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2 text-start">
                <Label>{t('txTypes')}</Label>
                <Select value={newProject.transactionTypeId} onValueChange={val => setNewProject({...newProject, transactionTypeId: val, subServiceId: ''})}>
                  <SelectTrigger className="h-14 rounded-2xl border-2"><SelectValue placeholder={t('search')} /></SelectTrigger>
                  <SelectContent>
                    {txTypes?.map(tx => <SelectItem key={tx.id} value={tx.id}>{tx.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-start">
                <Label>{t('subSrvs')}</Label>
                <Select value={newProject.subServiceId} onValueChange={val => setNewProject({...newProject, subServiceId: val})} disabled={!newProject.transactionTypeId}>
                  <SelectTrigger className="h-14 rounded-2xl border-2"><SelectValue placeholder={t('search')} /></SelectTrigger>
                  <SelectContent>
                    {subServices?.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateProject} disabled={isAdding || !newProject.name} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">
                {isAdding ? <Loader2 className="animate-spin" /> : <Sparkles className="me-2 h-5 w-5" />}
                {lang === 'ar' ? 'بدء المشروع' : 'Start Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 text-start">{lang === 'ar' ? 'إجمالي المشاريع' : 'Total Projects'}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-4xl font-black font-headline">{projects?.length || 0}</h3>
            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><FolderKanban className="h-6 w-6" /></div>
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-lg rounded-3xl p-6">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 text-start">{lang === 'ar' ? 'السيولة المستهدفة' : 'Target Liquidity'}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black font-headline text-emerald-600">{filteredProjects.reduce((acc, p) => acc + (p.budget || 0), 0).toLocaleString()} د.ك</h3>
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><DollarSign className="h-6 w-6" /></div>
          </div>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('search')} 
              className="ps-10 rounded-xl h-12 bg-white text-start" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-start font-black">{lang === 'ar' ? 'المشروع' : 'Project'}</TableHead>
                <TableHead className="text-start font-black">{t('txTypes')}</TableHead>
                <TableHead className="text-start font-black">{lang === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-end font-black">{lang === 'ar' ? 'الميزانية' : 'Budget'}</TableHead>
                <TableHead className="text-center font-black">{lang === 'ar' ? 'المسار' : 'Path'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic">{lang === 'ar' ? 'لا توجد مشاريع نشطة حالياً' : 'No active projects found'}</TableCell></TableRow>
              ) : (
                filteredProjects.map((project: any) => (
                  <TableRow key={project.id} className="hover:bg-muted/10 transition-colors group">
                    <TableCell className="text-start">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800">{project.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{project.id.substring(0,8)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge variant="outline" className="bg-white font-bold">{txTypes?.find(t => t.id === project.transactionTypeId)?.name || '...'}</Badge>
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge className={cn(
                        "font-black px-3",
                        project.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-600'
                      )}>
                        {project.status === 'active' ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'مكتمل' : 'Completed')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-primary">
                      {project.budget?.toLocaleString()} د.ك
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                        <ArrowRight className={cn("h-5 w-5", dir === 'rtl' && "rotate-180")} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
