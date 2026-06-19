'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowRight, HardHat, CheckCircle2, Clock, 
  Loader2, AlertCircle, FileText, ChevronRight,
  ShieldCheck, LayoutGrid, DollarSign
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { ProjectService } from '@/services/project-service';
import { Project, StageInstance } from '@/types/project';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ProjectExecutionPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const companyId = globalUser?.companyId;
  const projectService = useMemo(() => 
    db && companyId ? new ProjectService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const projectRef = useMemo(() => companyId && db ? doc(db, paths.projects(companyId), projectId) : null, [db, companyId, projectId]);
  const instancesQuery = useMemo(() => companyId && db ? query(collection(db, paths.stageInstances(companyId, projectId)), orderBy('createdAt')) : null, [db, companyId, projectId]);

  const { data: project, loading: projectLoading } = useDoc<Project>(projectRef);
  const { data: instances, loading: instancesLoading } = useCollection<StageInstance>(instancesQuery);

  const stats = useMemo(() => {
    if (!instances) return { total: 0, completed: 0, percent: 0 };
    const total = instances.length;
    const completed = instances.filter(i => i.status === 'completed').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [instances]);

  const handleCompleteStage = (instanceId: string) => {
    if (!projectService || !user?.uid) return;
    try {
      projectService.completeStage(projectId, instanceId, user.uid);
      toast({ title: t('saved') });
    } catch (e: any) {
       toast({ 
         variant: "destructive", 
         title: t('error'), 
         description: e.message.includes('UNAUTHORIZED') ? (isRtl ? 'لا تملك صلاحية إكمال المراحل.' : 'Unauthorized to complete stages.') : t('saveFailed') 
       });
    }
  };

  if (projectLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!project) return <div className="p-20 text-center"><AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" /><h2 className="text-2xl font-black">{isRtl ? 'المشروع غير موجود' : 'Project Not Found'}</h2></div>;

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/projects')} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black font-headline">{project.name}</h1>
              <Badge className="bg-emerald-500 text-white font-black px-3 py-1 rounded-lg border-0">{t(project.status)}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1"><HardHat className="h-3 w-3" /> {isRtl ? 'مستند المشروع:' : 'Ref ID:'} <span className="font-mono">{projectId}</span></span>
              <div className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-xs font-black text-primary uppercase tracking-widest">{isRtl ? 'تنفيذ عمليات' : 'Operational Execution'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
           <Button variant="outline" className="rounded-xl font-bold h-12 gap-2 border-2"><FileText className="h-4 w-4" /> {isRtl ? 'تقارير فنية' : 'Reports'}</Button>
           <Button className="bg-primary text-white font-black rounded-xl h-12 shadow-lg shadow-primary/20">{isRtl ? 'إدارة المستندات' : 'Documents'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="p-8 pb-0">
               <div className="flex justify-between items-end mb-6">
                  <div className="text-start">
                    <CardTitle className="text-xl font-black font-headline">{isRtl ? 'مسار التنفيذ (Operational Pipeline)' : 'Execution Pipeline'}</CardTitle>
                    <CardDescription className="font-bold">{isRtl ? 'متابعة المراحل المستنسخة من المسار الفني.' : 'Tracking stages instantiated from technical path.'}</CardDescription>
                  </div>
                  <div className="text-end">
                     <span className="text-4xl font-black font-headline text-primary">{stats.percent}%</span>
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">{isRtl ? 'نسبة الإنجاز الكلية' : 'Total Progress'}</p>
                  </div>
               </div>
               <Progress value={stats.percent} className="h-3 rounded-full bg-slate-100" />
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              {instancesLoading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/20" /></div> : (
                instances?.map((instance, idx) => (
                  <div key={instance.id} className={cn(
                    "p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between group",
                    instance.status === 'completed' ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-100 hover:border-primary/20'
                  )}>
                    <div className="flex items-center gap-6">
                       <div className={cn(
                         "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm transition-colors",
                         instance.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary'
                       )}>
                         {instance.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : (idx + 1)}
                       </div>
                       <div className="text-start">
                          <h4 className="font-black text-lg text-slate-800">{isRtl ? instance.name : instance.nameEn}</h4>
                          <div className="flex gap-4 mt-1">
                             {instance.isTimed && <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Clock className="h-3 w-3" /> {instance.timeTargetDays} {isRtl ? 'يوم مستهدف' : 'Days'}</span>}
                             {instance.isNumeric && <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> {isRtl ? 'مستهدف عددي:' : 'Target:'} {instance.numericTarget}</span>}
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       {instance.status !== 'completed' && check('projects:edit') && (
                         <Button onClick={() => handleCompleteStage(instance.id!)} className="rounded-xl font-bold bg-white text-primary border-2 border-primary/10 hover:bg-primary hover:text-white transition-all shadow-sm">
                            {isRtl ? 'إكمال المرحلة' : 'Complete'}
                         </Button>
                       )}
                       {instance.status === 'completed' && (
                         <div className="text-end">
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{isRtl ? 'تم الإنجاز' : 'Completed'}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{instance.completedAt?.toDate().toLocaleDateString()}</p>
                         </div>
                       )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-0 shadow-lg rounded-[2.5rem] bg-slate-900 text-white overflow-hidden">
              <CardHeader className="bg-white/5 border-b border-white/5 p-8">
                <CardTitle className="text-lg font-black flex items-center gap-2"><DollarSign className="h-5 w-5 text-emerald-400" /> {isRtl ? 'البيان المالي' : 'Financial Status'}</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="text-start">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isRtl ? 'الميزانية الإجمالية' : 'Total Budget'}</p>
                    <p className="text-4xl font-black font-headline text-emerald-400 mt-1">{project.budget?.toLocaleString()} <span className="text-sm">KWD</span></p>
                 </div>
                 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="text-start">
                       <p className="text-[10px] font-bold text-slate-500 uppercase">{isRtl ? 'المدفوع' : 'Paid'}</p>
                       <p className="text-lg font-black text-slate-200">0.000</p>
                    </div>
                    <div className="text-start">
                       <p className="text-[10px] font-bold text-slate-500 uppercase">{isRtl ? 'المستحق' : 'Due'}</p>
                       <p className="text-lg font-black text-primary">0.000</p>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50 border-b p-6">
                <CardTitle className="text-sm font-black flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {isRtl ? 'تفاصيل الارتباط الفني' : 'Technical Link'}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                 <div className="p-4 rounded-2xl bg-muted/30 border-2 border-dashed space-y-1 text-start">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{isRtl ? 'المسار التشغيلي' : 'Operational Path'}</p>
                    <p className="text-sm font-black text-slate-800">{isRtl ? 'تم الربط آلياً مع المرجعيات' : 'Automatically linked to references'}</p>
                 </div>
                 <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-muted-foreground">{isRtl ? 'إجمالي المراحل' : 'Total Stages'}</span>
                       <span className="font-black">{stats.total}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-muted-foreground">{isRtl ? 'المراحل المكتملة' : 'Completed'}</span>
                       <span className="font-black text-emerald-600">{stats.completed}</span>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
