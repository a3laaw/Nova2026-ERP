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
import { usePermissions } from '@/hooks/use-permissions';
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
  const { check, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ 
    name: '', budget: '', activityTypeId: '', serviceId: '', subServiceId: '' 
  });

  const projectService = useMemo(() => 
    db && companyId ? new ProjectService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && form.activityTypeId ? query(collection(db, paths.services(companyId, form.activityTypeId)), orderBy('order')) : null, [db, companyId, form.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && form.activityTypeId && form.serviceId ? query(collection(db, paths.subServices(companyId, form.activityTypeId, form.serviceId)), orderBy('order')) : null, [db, companyId, form.activityTypeId, form.serviceId]);
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
      toast({ title: t('saved') });
      setForm({ name: '', budget: '', activityTypeId: '', serviceId: '', subServiceId: '' });
      setIsAdding(false);
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error') });
      setIsAdding(false);
    }
  };

  const filteredProjects = projects?.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <HardHat className="h-10 w-10 text-primary" />
            {t('projects')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة العمليات الهندسية والمشاريع النشطة' : 'Managing engineering operations and active projects'}
          </p>
        </div>

        {check('projects:create') && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" className="h-12 px-8 shadow-xl shadow-primary/20">
                <Plus className="me-2 h-6 w-6" />
                {t('newProject')}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl border-0 shadow-2xl max-w-2xl p-0 overflow-hidden" dir={dir}>
              <div className="bg-primary/5 p-8 border-b">
                <DialogTitle className="text-start font-headline font-black text-2xl">{t('newProject')}</DialogTitle>
                <DialogDescription className="text-start mt-1 font-bold">{isRtl ? 'تعريف مشروع جديد وربطه بمسار فني ذكي.' : 'Define new project.'}</DialogDescription>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-start">
                    <Label className="font-black">{t('name')}</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-11 border-2" />
                  </div>
                  <div className="space-y-2 text-start">
                    <Label className="font-black">{t('budget')} (KWD)</Label>
                    <Input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} className="h-11 border-2" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <Select value={form.activityTypeId} onValueChange={v => setForm({...form, activityTypeId: v})}>
                      <SelectTrigger className="h-11 border-2"><SelectValue placeholder="Activity" /></SelectTrigger>
                      <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!}>{a.name}</SelectItem>)}</SelectContent>
                   </Select>
                   <Select disabled={!form.activityTypeId} value={form.serviceId} onValueChange={v => setForm({...form, serviceId: v})}>
                      <SelectTrigger className="h-11 border-2"><SelectValue placeholder="Service" /></SelectTrigger>
                      <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>)}</SelectContent>
                   </Select>
                   <Select disabled={!form.serviceId} value={form.subServiceId} onValueChange={v => setForm({...form, subServiceId: v})}>
                      <SelectTrigger className="h-11 border-2"><SelectValue placeholder="Sub-Service" /></SelectTrigger>
                      <SelectContent>{subServices?.map(sub => <SelectItem key={sub.id} value={sub.id!}>{sub.name}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
              </div>
              <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleCreate} disabled={isAdding || !form.subServiceId} className="w-full h-12 rounded-xl">
                  {isAdding ? <Loader2 className="animate-spin" /> : t('startProject')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder={t('search')} 
              className="ps-12 h-11 bg-white border-slate-200" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-start font-black py-6 ps-8">{t('project')}</TableHead>
                <TableHead className="text-start font-black">{t('status')}</TableHead>
                <TableHead className="text-end font-black">{t('budget')}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredProjects.map((project: any) => (
                <TableRow key={project.id} className="hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => router.push(`/dashboard/projects/${project.id}`)}>
                  <TableCell className="text-start font-black text-slate-800 py-6 ps-8">{project.name}</TableCell>
                  <TableCell className="text-start">
                     <Badge className={cn("font-black px-3 py-1 rounded-lg border-0", project.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white')}>
                        {project.status.toUpperCase()}
                     </Badge>
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
