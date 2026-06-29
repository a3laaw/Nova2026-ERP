'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  HardHat, Plus, Search, Loader2, ArrowRight,
  Filter, LayoutGrid, UserCircle, DollarSign,
  Workflow, Building2
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
import { Client } from '@/types/client';

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
    name: '', 
    clientId: '', 
    budget: '', 
    activityTypeId: '', 
    serviceId: '', 
    subServiceId: '' 
  });

  const projectService = useMemo(() => 
    db && companyId ? new ProjectService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  // استعلامات البيانات المرجعية
  const clientsQuery = useMemo(() => companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, [db, companyId]);
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && form.activityTypeId ? query(collection(db, paths.services(companyId, form.activityTypeId)), orderBy('order')) : null, [db, companyId, form.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && form.activityTypeId && form.serviceId ? query(collection(db, paths.subServices(companyId, form.activityTypeId, form.serviceId)), orderBy('order')) : null, [db, companyId, form.activityTypeId, form.serviceId]);
  const projectsQuery = useMemo(() => companyId && db ? query(collection(db, paths.projects(companyId)), orderBy('createdAt', 'desc')) : null, [db, companyId]);

  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: activities } = useCollection(actQuery);
  const { data: services } = useCollection(srvQuery);
  const { data: subServices } = useCollection(subQuery);
  const { data: projects, loading: projectsLoading } = useCollection(projectsQuery);

  const handleCreate = async () => {
    if (!projectService || !form.name || !form.clientId || !form.subServiceId) {
      toast({ variant: "destructive", title: isRtl ? "بيانات ناقصة" : "Missing Info" });
      return;
    }
    
    setIsAdding(true);
    try {
      const selectedClient = clients?.find(c => c.id === form.clientId);
      
      const projectId = await projectService.createProject({
        name: form.name,
        clientId: form.clientId,
        clientName: selectedClient?.nameAr || '',
        budget: Number(form.budget) || 0,
        activityTypeId: form.activityTypeId,
        serviceId: form.serviceId,
        subServiceId: form.subServiceId,
        status: 'active'
      });

      toast({ title: t('saved') });
      setForm({ name: '', clientId: '', budget: '', activityTypeId: '', serviceId: '', subServiceId: '' });
      setIsAdding(false);
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error') });
      setIsAdding(false);
    }
  };

  const filteredProjects = projects?.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <HardHat className="h-10 w-10 text-primary" />
            {t('projects')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة العمليات الهندسية المرتبطة بقاعدة العملاء' : 'Managing engineering operations linked to clients'}
          </p>
        </div>

        {check('projects', 'create').can && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" className="h-12 px-8 shadow-xl shadow-primary/20">
                <Plus className="me-2 h-6 w-6" />
                {t('newProject')}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl border-0 shadow-3xl max-w-2xl p-0 overflow-hidden" dir={dir}>
              <div className="bg-primary/5 p-8 border-b">
                <DialogTitle className="text-start font-headline font-black text-2xl">{t('newProject')}</DialogTitle>
                <DialogDescription className="text-start mt-1 font-bold">{isRtl ? 'تعريف مشروع جديد وربطه بعميل ومسار فني.' : 'Define new project and link it to client.'}</DialogDescription>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-start">
                    <Label className="font-black flex items-center gap-2">
                       <UserCircle className="h-4 w-4 text-primary" /> العميل المالك
                    </Label>
                    <Select value={form.clientId} onValueChange={v => setForm({...form, clientId: v})}>
                       <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          {clients?.map(c => <SelectItem key={c.id} value={c.id!} className="font-bold">{c.nameAr}</SelectItem>)}
                       </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 text-start">
                    <Label className="font-black">{t('name')}</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-11 border-2 font-bold" placeholder="..." />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border-2">
                   <div className="space-y-1.5 text-start">
                      <Label className="text-[10px] font-black uppercase text-slate-400">النشاط</Label>
                      <Select value={form.activityTypeId} onValueChange={v => setForm({...form, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                         <SelectTrigger className="h-10 border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1.5 text-start">
                      <Label className="text-[10px] font-black uppercase text-slate-400">الخدمة</Label>
                      <Select disabled={!form.activityTypeId} value={form.serviceId} onValueChange={v => setForm({...form, serviceId: v, subServiceId: ''})}>
                         <SelectTrigger className="h-10 border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1.5 text-start">
                      <Label className="text-[10px] font-black uppercase text-slate-400">المسار</Label>
                      <Select disabled={!form.serviceId} value={form.subServiceId} onValueChange={v => setForm({...form, subServiceId: v})}>
                         <SelectTrigger className="h-10 border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent>{subServices?.map(sub => <SelectItem key={sub.id} value={sub.id!} className="font-bold">{sub.name}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                </div>

                <div className="space-y-2 text-start">
                  <Label className="font-black">{t('budget')} (KWD)</Label>
                  <Input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} className="h-11 border-2 font-black text-emerald-600 text-lg" />
                </div>
              </div>
              <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleCreate} disabled={isAdding || !form.subServiceId || !form.clientId} className="w-full h-14 rounded-xl font-black text-lg">
                  {isAdding ? <Loader2 className="animate-spin" /> : (isRtl ? 'بدء تنفيذ المشروع الآن' : 'Start Project')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Independent Search Header Card */}
      <Card className="border-0 shadow-sm rounded-xl bg-white mb-4 overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder={isRtl ? 'بحث باسم المشروع أو العميل...' : 'Search projects or clients...'} 
              className="ps-12 h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary transition-all font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 px-6 border-primary/20">
             <Filter className="h-4 w-4 me-2" /> {isRtl ? 'تصفية النتائج' : 'Filter Results'}
          </Button>
        </div>
      </Card>

      {/* Main Projects Table */}
      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#F4F6F9] border-b">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{t('project')}</TableHead>
                <TableHead className="text-start">{isRtl ? 'العميل' : 'Client'}</TableHead>
                <TableHead className="text-start">{t('status')}</TableHead>
                <TableHead className="text-end">{t('budget')}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد مشاريع جارية.' : 'No active projects.'}</TableCell></TableRow>
              ) : (
                filteredProjects.map((project: any) => (
                  <TableRow key={project.id} className="hover:bg-[#FFF9F2] transition-colors group cursor-pointer border-b-slate-100" onClick={() => router.push(`/dashboard/projects/${project.id}`)}>
                    <TableCell className="py-6 ps-8 text-start">
                       <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center">
                             <HardHat className="h-5 w-5" />
                          </div>
                          <span className="font-black text-slate-800 text-base">{project.name}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                          <UserCircle className="h-3.5 w-3.5" />
                          {project.clientName}
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                         project.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                       )}>
                          {project.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-primary text-xl pe-4">
                      {project.budget?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center pe-8">
                      <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-9 w-9">
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
