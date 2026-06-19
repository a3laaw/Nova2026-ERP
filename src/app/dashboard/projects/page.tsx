'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  HardHat, Plus, Search, Loader2, ArrowRight,
  Filter, LayoutGrid, Boxes, Layers, DollarSign
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { ProjectService } from '@/services/project-service';
import { cn } from '@/lib/utils';

export default function ProjectsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ 
    name: '', budget: '', activityTypeId: '', serviceId: '', subServiceId: '' 
  });

  const projectService = useMemo(() => db && companyId ? new ProjectService(db, companyId) : null, [db, companyId]);

  // استعلامات المرجعيات
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('name')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && form.activityTypeId ? query(collection(db, paths.services(companyId, form.activityTypeId)), orderBy('name')) : null, [db, companyId, form.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && form.activityTypeId && form.serviceId ? query(collection(db, paths.subServices(companyId, form.activityTypeId, form.serviceId)), orderBy('name')) : null, [db, companyId, form.activityTypeId, form.serviceId]);
  
  // استعلام المشاريع
  const projectsQuery = useMemo(() => companyId && db ? query(collection(db, paths.projects(companyId)), orderBy('createdAt', 'desc')) : null, [db, companyId]);

  const { data: activities } = useCollection(actQuery);
  const { data: services } = useCollection(srvQuery);
  const { data: subServices } = useCollection(subQuery);
  const { data: projects, loading: projectsLoading } = useCollection(projectsQuery);

  const handleCreate = async () => {
    if (!projectService || !form.name || !form.subServiceId) return;
    setIsAdding(true);
    try {
      const projectId = await projectService.createProject({
        name: form.name,
        budget: Number(form.budget) || 0,
        activityTypeId: form.activityTypeId,
        serviceId: form.serviceId,
        subServiceId: form.subServiceId,
        status: 'active'
      });
      toast({ title: t('saved'), description: isRtl ? 'تم إنشاء المشروع وتجهيز مراحل العمل.' : 'Project created and stages instantiated.' });
      setForm({ name: '', budget: '', activityTypeId: '', serviceId: '', subServiceId: '' });
      setIsAdding(false);
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
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
            {isRtl ? 'إدارة العمليات الهندسية والمشاريع النشطة' : 'Managing engineering operations and active projects'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <Plus className="me-2 h-6 w-6" />
              {t('newProject')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl max-w-2xl p-0 overflow-hidden" dir={dir}>
            <div className="bg-primary/5 p-8 border-b">
              <DialogTitle className="text-start font-headline font-black text-2xl">{t('newProject')}</DialogTitle>
              <DialogDescription className="text-start mt-1 font-bold">{isRtl ? 'تعريف مشروع جديد وربطه بمسار فني ذكي.' : 'Define new project and link it to a smart technical path.'}</DialogDescription>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('name')}</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder={isRtl ? 'اسم المشروع...' : 'Project Name'} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('budget')} (KWD)</Label>
                  <Input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} placeholder="0.000" className="h-12 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 text-start">
                  <Label className="text-xs font-black opacity-50 flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> {isRtl ? 'النشاط' : 'Activity'}</Label>
                  <Select value={form.activityTypeId} onValueChange={val => setForm({...form, activityTypeId: val, serviceId: '', subServiceId: ''})}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!}>{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-start">
                  <Label className="text-xs font-black opacity-50 flex items-center gap-1"><Boxes className="h-3 w-3" /> {isRtl ? 'الخدمة' : 'Service'}</Label>
                  <Select value={form.serviceId} onValueChange={val => setForm({...form, serviceId: val, subServiceId: ''})} disabled={!form.activityTypeId}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-start">
                  <Label className="text-xs font-black opacity-50 flex items-center gap-1"><Layers className="h-3 w-3" /> {isRtl ? 'المسار' : 'Sub-Service'}</Label>
                  <Select value={form.subServiceId} onValueChange={val => setForm({...form, subServiceId: val})} disabled={!form.serviceId}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>{subServices?.map(sub => <SelectItem key={sub.id} value={sub.id!}>{isRtl ? sub.name : sub.nameEn}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t">
              <Button onClick={handleCreate} disabled={isAdding || !form.subServiceId} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">
                {isAdding ? <Loader2 className="animate-spin" /> : t('startProject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-white border-0 shadow-lg rounded-[2.5rem] p-8 flex items-center justify-between group hover:shadow-xl transition-all">
          <div className="text-start">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">{isRtl ? 'إجمالي المشاريع النشطة' : 'Total Active Projects'}</p>
            <h3 className="text-5xl font-black font-headline">{projects?.filter(p => p.status === 'active').length || 0}</h3>
          </div>
          <div className="p-6 bg-primary/10 rounded-[2rem] text-primary group-hover:scale-110 transition-transform">
            <HardHat className="h-12 w-12" />
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-lg rounded-[2.5rem] p-8 flex items-center justify-between group hover:shadow-xl transition-all">
          <div className="text-start">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">{isRtl ? 'إجمالي ميزانية العمليات' : 'Total Operational Budget'}</p>
            <h3 className="text-3xl font-black font-headline text-emerald-600">
              {filteredProjects.reduce((acc, p) => acc + (p.budget || 0), 0).toLocaleString()} <span className="text-sm font-black">{isRtl ? 'د.ك' : 'KWD'}</span>
            </h3>
          </div>
          <div className="p-6 bg-emerald-50 rounded-[2rem] text-emerald-600 group-hover:scale-110 transition-transform">
            <DollarSign className="h-12 w-12" />
          </div>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder={t('search')} 
              className="ps-12 rounded-2xl h-14 bg-white text-start border-2 border-slate-100" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="ghost" className="rounded-xl font-bold gap-2"><Filter className="h-4 w-4" /> {isRtl ? 'فلترة' : 'Filter'}</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-start font-black py-6 ps-8">{t('project')}</TableHead>
                <TableHead className="text-start font-black">{isRtl ? 'المسار الفني' : 'Technical Path'}</TableHead>
                <TableHead className="text-start font-black">{t('status')}</TableHead>
                <TableHead className="text-end font-black">{t('budget')}</TableHead>
                <TableHead className="text-center font-black pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-muted-foreground font-bold italic">{isRtl ? 'لا توجد مشاريع مطابقة للبحث.' : 'No matching projects found.'}</TableCell></TableRow>
              ) : (
                filteredProjects.map((project: any) => (
                  <TableRow key={project.id} className="hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => router.push(`/dashboard/projects/${project.id}`)}>
                    <TableCell className="text-start font-black text-slate-800 py-6 ps-8">
                      <p className="text-lg">{project.name}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{project.clientName || '---'}</p>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-lg border-0 shadow-sm">
                         {activities?.find(a => a.id === project.activityTypeId)?.name || '...'}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full shadow-sm", project.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300')} />
                        <span className="text-xs font-black">{t(project.status) || project.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-primary text-xl">
                      {project.budget?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center pe-8">
                      <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                        <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
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
