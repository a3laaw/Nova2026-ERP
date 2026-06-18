'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Workflow, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Search, CheckCircle2, XCircle, 
  Settings2, LayoutGrid, Layers, Eye, Ban, DollarSign
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { TechnicalPathService } from '@/services/technical-path-service';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TransactionType, SubService, ServiceType, Department } from '@/types/reference';

export default function TechnicalPathsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedTx, setSelectedTx] = useState<TransactionType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  // Forms states
  const [txForm, setTxForm] = useState<Partial<TransactionType>>({
    code: '', name: '', nameEn: '', serviceTypeId: '', departmentIds: [], isActive: true, order: 0
  });
  const [subForm, setSubForm] = useState<Partial<SubService>>({
    code: '', name: '', nameEn: '', description: '', isCore: true, isBillable: true, 
    requiresTechnicalStages: true, allowParallelExecution: false, clientVisible: true, order: 0, isActive: true
  });

  const pathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);

  // Queries
  const txQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionTypes(companyId)), orderBy('order')) : null
  , [db, companyId]);

  const subQuery = useMemo(() => 
    companyId && db && selectedTx?.id ? query(collection(db, paths.subServices(companyId, selectedTx.id)), orderBy('order')) : null
  , [db, companyId, selectedTx]);

  const serviceTypesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.serviceTypes(companyId)), orderBy('order')) : null
  , [db, companyId]);

  const departmentsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.departments(companyId)), orderBy('order')) : null
  , [db, companyId]);

  const { data: transactionTypes, loading: txLoading } = useCollection<TransactionType>(txQuery);
  const { data: subServices, loading: subLoading } = useCollection<SubService>(subQuery);
  const { data: serviceTypes } = useCollection<ServiceType>(serviceTypesQuery);
  const { data: departments } = useCollection<Department>(departmentsQuery);

  const filteredTx = transactionTypes?.filter(tx => 
    tx.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tx.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSaveTx = async () => {
    if (!pathService || !txForm.name || !txForm.code) return;
    setLoadingAction('tx');
    try {
      if (txForm.id) {
        await pathService.updateTransactionType(txForm.id, txForm);
      } else {
        await pathService.addTransactionType(txForm as any);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setTxForm({ code: '', name: '', nameEn: '', serviceTypeId: '', departmentIds: [], isActive: true, order: 0 });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveSub = async () => {
    if (!pathService || !selectedTx?.id || !subForm.name || !subForm.code) return;
    setLoadingAction('sub');
    try {
      const data = { 
        ...subForm, 
        transactionTypeId: selectedTx.id, 
        transactionTypeCode: selectedTx.code 
      } as any;
      if (subForm.id) {
        await pathService.updateSubService(selectedTx.id, subForm.id, data);
      } else {
        await pathService.addSubService(selectedTx.id, data);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setSubForm({ code: '', name: '', nameEn: '', description: '', isCore: true, isBillable: true, requiresTechnicalStages: true, order: 0, isActive: true });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteTx = async (id: string) => {
    if (!pathService || !confirm(t('confirmDelete'))) return;
    try {
      await pathService.deleteTransactionType(id);
      if (selectedTx?.id === id) setSelectedTx(null);
      toast({ title: t('deleted') });
    } catch (e) {}
  };

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-start">
        <div>
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Workflow className="h-10 w-10 text-primary" />
            {isRtl ? 'المسارات الفنية' : 'Technical Paths'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'هندسة أنواع المعاملات والخدمات الفرعية للمنشأة' : 'Engineering transaction types and sub-services for the entity'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setTxForm({ code: '', name: '', nameEn: '', isActive: true, order: (transactionTypes?.length || 0) + 1 })} className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <Plus className="me-2 h-6 w-6" />
              {isRtl ? 'إضافة معاملة' : 'New Transaction'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-2xl" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-start font-headline font-black text-2xl">{isRtl ? 'تعريف نوع معاملة' : 'New Transaction Type'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2">
                <Label>{isRtl ? 'كود المعاملة' : 'TX Code'}</Label>
                <Input value={txForm.code} onChange={e => setTxForm({...txForm, code: e.target.value})} placeholder="MUN-DESIGN" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? 'الترتيب' : 'Order'}</Label>
                <Input type="number" value={txForm.order || ''} onChange={e => setTxForm({...txForm, order: Number(e.target.value)})} placeholder="1" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{t('name')} (Ar)</Label>
                <Input value={txForm.name} onChange={e => setTxForm({...txForm, name: e.target.value})} placeholder="تصميم بلدية" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{t('name')} (En)</Label>
                <Input value={txForm.nameEn} onChange={e => setTxForm({...txForm, nameEn: e.target.value})} placeholder="Municipality Design" className="h-14 rounded-2xl border-2 text-start" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? 'نوع النشاط' : 'Service Type'}</Label>
                <Select value={txForm.serviceTypeId} onValueChange={val => setTxForm({...txForm, serviceTypeId: val})}>
                  <SelectTrigger className="h-14 rounded-2xl border-2"><SelectValue placeholder={t('search')} /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes?.map(st => <SelectItem key={item.id} value={st.id!}>{isRtl ? st.name : st.nameEn}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <Label>{t('active')}</Label>
                <Switch checked={txForm.isActive} onCheckedChange={val => setTxForm({...txForm, isActive: val})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveTx} disabled={loadingAction === 'tx'} className="w-full h-14 rounded-2xl font-black bg-primary">
                {loadingAction === 'tx' ? <Loader2 className="animate-spin" /> : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Transaction Types Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-6">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t('search')} 
                  className="ps-10 rounded-xl h-12 bg-white text-start" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[700px] overflow-y-auto">
              {txLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto h-10 w-10 text-primary/30" /></div> : (
                filteredTx.length === 0 ? <div className="p-20 text-center text-muted-foreground italic font-bold">{t('search')}</div> : (
                  filteredTx.map(tx => (
                    <div 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className={cn(
                        "p-6 border-b flex items-center justify-between cursor-pointer transition-all group text-start",
                        selectedTx?.id === tx.id ? 'bg-primary/5 border-s-8 border-s-primary' : 'hover:bg-muted/30'
                      )}
                    >
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="font-mono text-[10px] bg-white">{tx.code}</Badge>
                           <span className="text-base font-black text-slate-800">{isRtl ? tx.name : tx.nameEn}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                          {serviceTypes?.find(st => st.id === tx.serviceTypeId)?.name || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setTxForm(tx); }} className="h-9 w-9 text-blue-600 bg-blue-50 rounded-xl"><Edit3 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteTx(tx.id!); }} className="h-9 w-9 text-destructive bg-destructive/5 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <ChevronRight className={cn("h-5 w-5 transition-transform", selectedTx?.id === tx.id ? 'text-primary scale-125' : 'text-muted-foreground', isRtl && selectedTx?.id !== tx.id && 'rotate-180')} />
                      </div>
                    </div>
                  ))
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sub-Services Column */}
        <div className={cn("lg:col-span-7 transition-opacity", !selectedTx && 'opacity-30 pointer-events-none')}>
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-xl font-black flex items-center gap-3">
                  <Layers className="h-6 w-6 text-primary" />
                  {isRtl ? 'الخدمات الفرعية' : 'Sub-Services'}
                  {selectedTx && <Badge variant="secondary" className="ms-3 bg-primary/10 text-primary font-black">{isRtl ? selectedTx.name : selectedTx.nameEn}</Badge>}
                </CardTitle>
                <CardDescription className="mt-1">{isRtl ? 'تفاصيل مراحل العمل والخدمات التفصيلية' : 'Work stages and detailed service breakdowns'}</CardDescription>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button disabled={!selectedTx} onClick={() => setSubForm({ code: '', name: '', nameEn: '', isCore: true, isBillable: true, requiresTechnicalStages: true, clientVisible: true, order: (subServices?.length || 0) + 1, isActive: true })} className="bg-secondary text-primary font-black rounded-xl h-12">
                    <Plus className="me-2 h-5 w-5" />
                    {isRtl ? 'إضافة خدمة' : 'Add Sub-Service'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-4xl" dir={dir}>
                  <DialogHeader>
                    <DialogTitle className="text-start font-headline font-black text-2xl">{isRtl ? 'إضافة خدمة فرعية' : 'New Sub-Service'}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 text-start">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{isRtl ? 'كود الخدمة' : 'Sub-Service Code'}</Label>
                        <Input value={subForm.code} onChange={e => setSubForm({...subForm, code: e.target.value})} placeholder="ARCH-DWG" className="h-14 rounded-2xl border-2" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('name')} (Ar)</Label>
                        <Input value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} placeholder="مخططات معمارية" className="h-14 rounded-2xl border-2" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('name')} (En)</Label>
                        <Input value={subForm.nameEn} onChange={e => setSubForm({...subForm, nameEn: e.target.value})} placeholder="Architectural Plans" className="h-14 rounded-2xl border-2 text-start" />
                      </div>
                      <div className="space-y-2">
                        <Label>{isRtl ? 'الوصف' : 'Description'}</Label>
                        <Textarea value={subForm.description} onChange={e => setSubForm({...subForm, description: e.target.value})} className="rounded-2xl border-2 min-h-[100px]" />
                      </div>
                    </div>

                    <div className="space-y-6 bg-slate-50 p-6 rounded-[2rem] border-2 border-dashed">
                      <h4 className="font-black text-sm uppercase tracking-widest text-slate-400">{isRtl ? 'خصائص المسار' : 'Operational Logic'}</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border">
                          <Label className="text-xs font-bold">{isRtl ? 'خدمة أساسية' : 'Core Service'}</Label>
                          <Switch checked={subForm.isCore} onCheckedChange={val => setSubForm({...subForm, isCore: val})} />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border">
                          <Label className="text-xs font-bold">{isRtl ? 'قابلة للفوترة' : 'Billable'}</Label>
                          <Switch checked={subForm.isBillable} onCheckedChange={val => setSubForm({...subForm, isBillable: val})} />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border">
                          <Label className="text-xs font-bold">{isRtl ? 'تتطلب مراحل فنية' : 'Req. Stages'}</Label>
                          <Switch checked={subForm.requiresTechnicalStages} onCheckedChange={val => setSubForm({...subForm, requiresTechnicalStages: val})} />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border">
                          <Label className="text-xs font-bold">{isRtl ? 'تنفيذ متوازي' : 'Parallel'}</Label>
                          <Switch checked={subForm.allowParallelExecution} onCheckedChange={val => setSubForm({...subForm, allowParallelExecution: val})} />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border">
                          <Label className="text-xs font-bold">{isRtl ? 'مرئية للعميل' : 'Client Visible'}</Label>
                          <Switch checked={subForm.clientVisible} onCheckedChange={val => setSubForm({...subForm, clientVisible: val})} />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border">
                          <Label className="text-xs font-bold">{t('active')}</Label>
                          <Switch checked={subForm.isActive} onCheckedChange={val => setSubForm({...subForm, isActive: val})} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{isRtl ? 'نوع المخرج' : 'Output Type'}</Label>
                        <Select value={subForm.outputType} onValueChange={val => setSubForm({...subForm, outputType: val as any})}>
                          <SelectTrigger className="h-12 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Drawing">{isRtl ? 'مخطط هندسي' : 'Drawing'}</SelectItem>
                            <SelectItem value="Report">{isRtl ? 'تقرير' : 'Report'}</SelectItem>
                            <SelectItem value="Permit">{isRtl ? 'ترخيص / رخصة' : 'Permit'}</SelectItem>
                            <SelectItem value="Physical">{isRtl ? 'عمل إنشائي' : 'Physical Work'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSaveSub} disabled={loadingAction === 'sub'} className="w-full h-14 rounded-2xl font-black bg-primary">
                      {loadingAction === 'sub' ? <Loader2 className="animate-spin" /> : t('save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-8">
              {!selectedTx ? (
                <div className="py-40 text-center space-y-4">
                  <LayoutGrid className="h-16 w-16 mx-auto text-muted-foreground/20" />
                  <p className="text-muted-foreground font-bold italic">{isRtl ? 'يرجى اختيار نوع معاملة لعرض خدماتها' : 'Please select a transaction type'}</p>
                </div>
              ) : (
                subLoading ? <div className="py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div> : (
                  subServices?.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground font-bold italic">{isRtl ? 'لا توجد خدمات فرعية معرّفة' : 'No sub-services defined'}</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {subServices?.map(sub => (
                        <div key={sub.id} className="p-6 rounded-[2rem] border-2 bg-white hover:shadow-2xl hover:border-primary/30 transition-all group flex items-center justify-between text-start">
                          <div className="flex items-center gap-6">
                            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center border font-black text-primary">
                              {sub.order}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-slate-800">{isRtl ? sub.name : sub.nameEn}</span>
                                <Badge variant="outline" className="text-[9px] font-mono">{sub.code}</Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {sub.isBillable && <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px]"><DollarSign className="h-2 w-2 me-1" /> {isRtl ? 'مفوترة' : 'Billable'}</Badge>}
                                {sub.requiresTechnicalStages && <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[9px]"><Layers className="h-2 w-2 me-1" /> WBS</Badge>}
                                {sub.clientVisible && <Badge className="bg-purple-50 text-purple-600 border-purple-100 text-[9px]"><Eye className="h-2 w-2 me-1" /> {isRtl ? 'عميل' : 'Client'}</Badge>}
                                {!sub.isActive && <Badge variant="destructive" className="text-[9px]"><Ban className="h-2 w-2 me-1" /> {isRtl ? 'معطلة' : 'Disabled'}</Badge>}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                             <Button variant="outline" size="sm" className="rounded-xl font-bold gap-2 text-primary border-primary/20 hover:bg-primary/5">
                                <Settings2 className="h-4 w-4" />
                                {isRtl ? 'مراحل المسار' : 'Technical Stages'}
                             </Button>
                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" onClick={() => setSubForm(sub)} className="h-10 w-10 text-blue-600 hover:bg-blue-50"><Edit3 className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => pathService?.deleteSubService(selectedTx.id!, sub.id!)} className="h-10 w-10 text-destructive hover:bg-destructive/5"><Trash2 className="h-5 w-5" /></Button>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
