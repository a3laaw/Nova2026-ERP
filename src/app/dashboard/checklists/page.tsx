'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Database, Plus, Loader2, Trash2, 
  ChevronRight, Building2, MapPin, Workflow, 
  Settings2, Layers, Briefcase, Map, ShieldCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ReferenceHubPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState("technical");

  const [selectedTxType, setSelectedTxType] = useState<any>(null);
  const [selectedSubService, setSelectedSubService] = useState<any>(null);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [selectedGov, setSelectedGov] = useState<any>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [extraField, setExtraField] = useState<any>("");

  const companyId = globalUser?.companyId;

  const txTypesQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactionTypes(companyId)), orderBy('name')) : null, [db, companyId]);
  const subServicesQuery = useMemo(() => companyId && db && selectedTxType ? query(collection(db, paths.subServices(companyId, selectedTxType.id)), orderBy('name')) : null, [db, companyId, selectedTxType]);
  const stagesQuery = useMemo(() => companyId && db && selectedTxType && selectedSubService ? query(collection(db, paths.technicalStages(companyId, selectedTxType.id, selectedSubService.id)), orderBy('order')) : null, [db, companyId, selectedTxType, selectedSubService]);
  const deptsQuery = useMemo(() => companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('name')) : null, [db, companyId]);
  const jobsQuery = useMemo(() => companyId && db && selectedDept ? query(collection(db, paths.jobs(companyId, selectedDept.id)), orderBy('name')) : null, [db, companyId, selectedDept]);
  const govsQuery = useMemo(() => companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('name')) : null, [db, companyId]);
  const areasQuery = useMemo(() => companyId && db && selectedGov ? query(collection(db, paths.areas(companyId, selectedGov.id)), orderBy('name')) : null, [db, companyId, selectedGov]);

  const { data: txTypes, loading: txLoading } = useCollection(txTypesQuery);
  const { data: subServices, loading: subLoading } = useCollection(subServicesQuery);
  const { data: stages, loading: stageLoading } = useCollection(stagesQuery);
  const { data: depts, loading: deptsLoading } = useCollection(deptsQuery);
  const { data: jobs, loading: jobsLoading } = useCollection(jobsQuery);
  const { data: govs, loading: govsLoading } = useCollection(govsQuery);
  const { data: areas, loading: areasLoading } = useCollection(areasQuery);

  const handleAdd = async (type: string) => {
    if (!newItemName.trim() || !companyId || !db) return;
    setIsAdding(true);
    try {
      let ref;
      let data: any = { name: newItemName, createdAt: serverTimestamp() };

      switch (type) {
        case 'tx': ref = collection(db, paths.transactionTypes(companyId)); break;
        case 'sub': ref = collection(db, paths.subServices(companyId, selectedTxType.id)); data.parentId = selectedTxType.id; break;
        case 'stage': 
          ref = collection(db, paths.technicalStages(companyId, selectedTxType.id, selectedSubService.id)); 
          data.order = (stages?.length || 0) + 1;
          data.controlType = extraField || 'TimeBased';
          break;
        case 'dept': ref = collection(db, paths.departments(companyId)); break;
        case 'job': ref = collection(db, paths.jobs(companyId, selectedDept.id)); data.departmentId = selectedDept.id; break;
        case 'gov': ref = collection(db, paths.governorates(companyId)); break;
        case 'area': ref = collection(db, paths.areas(companyId, selectedGov.id)); data.governorateId = selectedGov.id; break;
      }

      if (ref) {
        await addDoc(ref, data);
        toast({ title: t('saved'), description: t('entryAdded') });
        setNewItemName("");
        setExtraField("");
      }
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!companyId || !db || !confirm(t('confirmDelete'))) return;
    try {
      let path = "";
      switch (type) {
        case 'tx': path = paths.transactionTypes(companyId); break;
        case 'sub': path = paths.subServices(companyId, selectedTxType.id); break;
        case 'stage': path = paths.technicalStages(companyId, selectedTxType.id, selectedSubService.id); break;
        case 'dept': path = paths.departments(companyId); break;
        case 'job': path = paths.jobs(companyId, selectedDept.id); break;
        case 'gov': path = paths.governorates(companyId); break;
        case 'area': path = paths.areas(companyId, selectedGov.id); break;
      }
      await deleteDoc(doc(db, path, id));
      toast({ title: t('deleted'), description: t('entryRemoved') });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('deleteFailed') });
    }
  };

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Database className="h-10 w-10 text-primary" />
            {t('checklists')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">إدارة الدستور التشغيلي والقواعد المرجعية للنظام</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-3xl mx-auto h-16 bg-muted/30 rounded-3xl p-2 shadow-inner">
          <TabsTrigger value="technical" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center"><Workflow className="h-5 w-5" /> {t('techRef')}</TabsTrigger>
          <TabsTrigger value="org" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center"><Building2 className="h-5 w-5" /> {t('orgRef')}</TabsTrigger>
          <TabsTrigger value="geo" className="rounded-2xl font-black gap-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg flex items-center justify-center"><MapPin className="h-5 w-5" /> {t('geoRef')}</TabsTrigger>
        </TabsList>

        <TabsContent value="technical" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> {t('txTypes')}</CardTitle>
                <Dialog>
                  <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-primary bg-primary/5 hover:bg-primary/10"><Plus className="h-5 w-5" /></Button></DialogTrigger>
                  <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                    <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{t('newPath')}</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-4">
                      <Label className="text-start block">{t('txTypes')}</Label>
                      <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={t('search')} className="h-14 rounded-2xl border-2 focus:border-primary/50 text-start" />
                    </div>
                    <DialogFooter><Button onClick={() => handleAdd('tx')} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">{isAdding ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                {txLoading ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary/50" /></div> : (
                  txTypes?.map(tx => (
                    <div 
                      key={tx.id} 
                      onClick={() => { setSelectedTxType(tx); setSelectedSubService(null); }}
                      className={cn(
                        "p-5 border-b flex items-center justify-between cursor-pointer transition-all group",
                        selectedTxType?.id === tx.id ? 'bg-primary/5 border-s-8 border-s-primary' : 'hover:bg-muted/30'
                      )}
                    >
                      <div className="flex flex-col text-start">
                        <span className="text-sm font-black text-slate-800">{tx.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">ID: {tx.id.substring(0,8)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete('tx', tx.id); }} className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        <ChevronRight className={cn("h-5 w-5 transition-transform", selectedTxType?.id === tx.id ? (dir === 'rtl' ? 'rotate-180 text-primary' : 'text-primary') : 'text-muted-foreground', dir === 'rtl' && !selectedTxType?.id === tx.id && 'rotate-180')} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className={cn("border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 transition-opacity", !selectedTxType && 'opacity-30 pointer-events-none')}>
              <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> {t('subSrvs')}</CardTitle>
                <Dialog>
                  <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-primary bg-primary/5 hover:bg-primary/10"><Plus className="h-5 w-5" /></Button></DialogTrigger>
                  <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                    <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{t('addEntry')}</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-4">
                      <Label className="text-start block">{t('subSrvs')}</Label>
                      <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={t('search')} className="h-14 rounded-2xl border-2 focus:border-primary/50 text-start" />
                    </div>
                    <DialogFooter><Button onClick={() => handleAdd('sub')} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">{isAdding ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                {!selectedTxType ? <div className="p-20 text-center text-xs text-muted-foreground font-bold italic">اختر مساراً فنياً</div> : (
                  subLoading ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary/50" /></div> : (
                    subServices?.map(sub => (
                      <div 
                        key={sub.id} 
                        onClick={() => setSelectedSubService(sub)}
                        className={cn(
                          "p-5 border-b flex items-center justify-between cursor-pointer transition-all group",
                          selectedSubService?.id === sub.id ? 'bg-primary/5 border-s-8 border-s-primary' : 'hover:bg-muted/30'
                        )}
                      >
                        <span className="text-sm font-black text-slate-800 text-start">{sub.name}</span>
                        <div className="flex items-center gap-2">
                           <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete('sub', sub.id); }} className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                           <ChevronRight className={cn("h-5 w-5 transition-transform", selectedSubService?.id === sub.id ? (dir === 'rtl' ? 'rotate-180 text-primary' : 'text-primary') : 'text-muted-foreground', dir === 'rtl' && !selectedSubService?.id === sub.id && 'rotate-180')} />
                        </div>
                      </div>
                    ))
                  )
                )}
              </CardContent>
            </Card>

            <Card className={cn("border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 transition-opacity", !selectedSubService && 'opacity-30 pointer-events-none')}>
              <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {t('stages')}</CardTitle>
                <Dialog>
                  <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-primary bg-primary/5 hover:bg-primary/10"><Plus className="h-5 w-5" /></Button></DialogTrigger>
                  <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                    <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{t('addEntry')}</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-4 text-start">
                      <div className="space-y-2">
                        <Label>{t('stages')}</Label>
                        <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={t('search')} className="h-14 rounded-2xl border-2 focus:border-primary/50" />
                      </div>
                    </div>
                    <DialogFooter><Button onClick={() => handleAdd('stage')} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">{isAdding ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                {!selectedSubService ? <div className="p-20 text-center text-xs text-muted-foreground font-bold italic">اختر خدمة فرعية</div> : (
                  stageLoading ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary/50" /></div> : (
                    stages?.map((stage, idx) => (
                      <div key={stage.id} className="p-4 bg-muted/30 rounded-[1.5rem] border-2 border-transparent hover:border-primary/20 transition-all flex items-center gap-4 group">
                        <span className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-lg shrink-0">{idx + 1}</span>
                        <div className="flex-1 text-start">
                          <p className="text-sm font-black text-slate-800">{stage.name}</p>
                          <Badge variant="secondary" className="text-[9px] px-2 py-0.5 rounded-lg font-bold bg-white text-primary border-primary/20 mt-1">{stage.controlType}</Badge>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete('stage', stage.id)} className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="org" className="mt-8 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
             <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-black flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> {t('depts')}</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-primary bg-primary/5 hover:bg-primary/10"><Plus className="h-5 w-5" /></Button></DialogTrigger>
                    <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                      <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{t('newDept')}</DialogTitle></DialogHeader>
                      <div className="py-6 space-y-4">
                        <Label className="text-start block">{t('depts')}</Label>
                        <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={t('search')} className="h-14 rounded-2xl border-2 focus:border-primary/50 text-start" />
                      </div>
                      <DialogFooter><Button onClick={() => handleAdd('dept')} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">{isAdding ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="p-0">
                  {deptsLoading ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary/50" /></div> : (
                    depts?.map(dept => (
                      <div 
                        key={dept.id} 
                        onClick={() => setSelectedDept(dept)}
                        className={cn(
                          "p-5 border-b flex items-center justify-between cursor-pointer transition-all",
                          selectedDept?.id === dept.id ? 'bg-primary/5 border-s-8 border-s-primary' : 'hover:bg-muted/30'
                        )}
                      >
                        <span className="text-sm font-black text-start">{dept.name}</span>
                        <ChevronRight className={cn("h-5 w-5", selectedDept?.id === dept.id ? 'text-primary' : 'text-muted-foreground', dir === 'rtl' && 'rotate-180')} />
                      </div>
                    ))
                  )}
                </CardContent>
             </Card>

             <Card className={cn("border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 transition-opacity", !selectedDept && 'opacity-30 pointer-events-none')}>
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-black flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> {t('jobs')}</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-primary bg-primary/5 hover:bg-primary/10"><Plus className="h-5 w-5" /></Button></DialogTrigger>
                    <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                      <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{t('addEntry')}</DialogTitle></DialogHeader>
                      <div className="py-6 space-y-4">
                        <Label className="text-start block">{t('jobs')}</Label>
                        <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={t('search')} className="h-14 rounded-2xl border-2 focus:border-primary/50 text-start" />
                      </div>
                      <DialogFooter><Button onClick={() => handleAdd('job')} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">{isAdding ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="p-0">
                  {!selectedDept ? <div className="p-20 text-center text-xs text-muted-foreground font-bold">{t('orgRef')}</div> : (
                    jobsLoading ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary/50" /></div> : (
                      jobs?.map(job => (
                        <div key={job.id} className="p-5 border-b flex items-center justify-between group hover:bg-muted/30 transition-all">
                          <span className="text-sm font-bold text-slate-700 text-start">{job.name}</span>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete('job', job.id)} className="opacity-0 group-hover:opacity-100 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))
                    )
                  )}
                </CardContent>
             </Card>
           </div>
        </TabsContent>

        <TabsContent value="geo" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
             <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-black flex items-center gap-2"><Map className="h-4 w-4 text-primary" /> {t('govs')}</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-primary bg-primary/5 hover:bg-primary/10"><Plus className="h-5 w-5" /></Button></DialogTrigger>
                    <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                      <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{t('newGov')}</DialogTitle></DialogHeader>
                      <div className="py-6 space-y-4">
                        <Label className="text-start block">{t('govs')}</Label>
                        <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={t('search')} className="h-14 rounded-2xl border-2 focus:border-primary/50 text-start" />
                      </div>
                      <DialogFooter><Button onClick={() => handleAdd('gov')} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">{isAdding ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="p-0">
                  {govsLoading ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary/50" /></div> : (
                    govs?.map(gov => (
                      <div 
                        key={gov.id} 
                        onClick={() => setSelectedGov(gov)}
                        className={cn(
                          "p-5 border-b flex items-center justify-between cursor-pointer transition-all",
                          selectedGov?.id === gov.id ? 'bg-primary/5 border-s-8 border-s-primary' : 'hover:bg-muted/30'
                        )}
                      >
                        <span className="text-sm font-black text-start">{gov.name}</span>
                        <ChevronRight className={cn("h-5 w-5", selectedGov?.id === gov.id ? 'text-primary' : 'text-muted-foreground', dir === 'rtl' && 'rotate-180')} />
                      </div>
                    ))
                  )}
                </CardContent>
             </Card>

             <Card className={cn("border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 transition-opacity", !selectedGov && 'opacity-30 pointer-events-none')}>
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-black flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {t('areas')}</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-primary bg-primary/5 hover:bg-primary/10"><Plus className="h-5 w-5" /></Button></DialogTrigger>
                    <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                      <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{t('addEntry')}</DialogTitle></DialogHeader>
                      <div className="py-6 space-y-4">
                        <Label className="text-start block">{t('areas')}</Label>
                        <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={t('search')} className="h-14 rounded-2xl border-2 focus:border-primary/50 text-start" />
                      </div>
                      <DialogFooter><Button onClick={() => handleAdd('area')} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">{isAdding ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="p-0">
                  {!selectedGov ? <div className="p-20 text-center text-xs text-muted-foreground font-bold italic">{t('geoRef')}</div> : (
                    areasLoading ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary/50" /></div> : (
                      areas?.map(area => (
                        <div key={area.id} className="p-5 border-b flex items-center justify-between group hover:bg-muted/30 transition-all">
                          <span className="text-sm font-bold text-slate-700 text-start">{area.name}</span>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete('area', area.id)} className="opacity-0 group-hover:opacity-100 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))
                    )
                  )}
                </CardContent>
             </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
