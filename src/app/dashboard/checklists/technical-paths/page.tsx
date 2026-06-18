'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Workflow, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Search, LayoutGrid, Layers, DollarSign, Settings2
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
import { TransactionType, SubService, ServiceType } from '@/types/reference';
import { TechnicalStagesManager } from './technical-stages-manager';

export default function TechnicalPathsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedTx, setSelectedTx] = useState<TransactionType | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubService | null>(null);
  const [viewMode, setViewMode] = useState<'main' | 'stages'>('main');
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const [txForm, setTxForm] = useState<Partial<TransactionType>>({ code: '', name: '', nameEn: '', serviceTypeId: '', departmentIds: [], isActive: true, order: 0 });
  const [subForm, setSubForm] = useState<Partial<SubService>>({ code: '', name: '', nameEn: '', description: '', isCore: true, isBillable: true, requiresTechnicalStages: true, order: 0, isActive: true });

  const pathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);

  const txQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactionTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const subQuery = useMemo(() => companyId && db && selectedTx?.id ? query(collection(db, paths.subServices(companyId, selectedTx.id)), orderBy('order')) : null, [db, companyId, selectedTx]);
  const serviceTypesQuery = useMemo(() => companyId && db ? query(collection(db, paths.serviceTypes(companyId)), orderBy('order')) : null, [db, companyId]);

  const { data: transactionTypes, loading: txLoading } = useCollection<TransactionType>(txQuery);
  const { data: subServices, loading: subLoading } = useCollection<SubService>(subQuery);
  const { data: serviceTypes } = useCollection<ServiceType>(serviceTypesQuery);

  const handleSaveTx = async () => {
    if (!pathService || !txForm.name || !txForm.code) return;
    setLoadingAction('tx');
    try {
      if (txForm.id) { await pathService.updateTransactionType(txForm.id, txForm); }
      else { await pathService.addTransactionType(txForm as any); }
      toast({ title: t('saved') });
      setTxForm({ code: '', name: '', nameEn: '', serviceTypeId: '', departmentIds: [], isActive: true, order: 0 });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const handleSaveSub = async () => {
    if (!pathService || !selectedTx?.id || !subForm.name || !subForm.code) return;
    setLoadingAction('sub');
    try {
      const data = { ...subForm, transactionTypeId: selectedTx.id, transactionTypeCode: selectedTx.code } as any;
      if (subForm.id) { await pathService.updateSubService(selectedTx.id, subForm.id, data); }
      else { await pathService.addSubService(selectedTx.id, data); }
      toast({ title: t('saved') });
      setSubForm({ code: '', name: '', nameEn: '', description: '', isCore: true, isBillable: true, requiresTechnicalStages: true, order: 0, isActive: true });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  if (viewMode === 'stages' && selectedTx && selectedSub) {
    return (
      <TechnicalStagesManager 
        transactionType={selectedTx} 
        subService={selectedSub} 
        onBack={() => { setViewMode('main'); setSelectedSub(null); }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3">
          <Workflow className="h-6 w-6 text-primary" />
          {isRtl ? 'المسارات الفنية' : 'Technical Paths'}
        </h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setTxForm({ code: '', name: '', nameEn: '', isActive: true, order: (transactionTypes?.length || 0) + 1 })} className="rounded-xl">
              <Plus className="me-2 h-4 w-4" /> {isRtl ? 'معاملة جديدة' : 'New Transaction'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl max-w-2xl" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black">{isRtl ? 'تعريف نوع معاملة' : 'New Transaction Type'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2"><Label>Code</Label><Input value={txForm.code} onChange={e => setTxForm({...txForm, code: e.target.value})} /></div>
              <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={txForm.order || ''} onChange={e => setTxForm({...txForm, order: Number(e.target.value)})} /></div>
              <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={txForm.name} onChange={e => setTxForm({...txForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={txForm.nameEn} onChange={e => setTxForm({...txForm, nameEn: e.target.value})} /></div>
              <div className="space-y-2">
                <Label>{isRtl ? 'نوع النشاط' : 'Service Type'}</Label>
                <Select value={txForm.serviceTypeId} onValueChange={val => setTxForm({...txForm, serviceTypeId: val})}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={t('search')} /></SelectTrigger>
                  <SelectContent>{serviceTypes?.map(st => <SelectItem key={st.id} value={st.id!}>{isRtl ? st.name : st.nameEn}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSaveTx} disabled={loadingAction === 'tx'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'tx' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {txLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                transactionTypes?.map(tx => (
                  <div key={tx.id} onClick={() => setSelectedTx(tx)} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all", selectedTx?.id === tx.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                    <div className="text-start">
                       <p className="text-sm font-black">{isRtl ? tx.name : tx.nameEn}</p>
                       <p className="text-[9px] text-muted-foreground uppercase font-bold">{serviceTypes?.find(s => s.id === tx.serviceTypeId)?.name || '...'}</p>
                    </div>
                    <ChevronRight className={cn("h-4 w-4", isRtl && 'rotate-180', selectedTx?.id === tx.id && 'text-primary scale-110')} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-7", !selectedTx && 'opacity-40')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-lg font-black flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> {isRtl ? 'الخدمات الفرعية' : 'Sub-Services'}</CardTitle>
                <CardDescription>{selectedTx ? (isRtl ? `نوع المعاملة: ${selectedTx.name}` : `TX: ${selectedTx.nameEn}`) : (isRtl ? 'اختر نوع معاملة' : 'Select a type')}</CardDescription>
              </div>
              {selectedTx && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="rounded-xl h-10 px-4"><Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة خدمة' : 'Add Service'}</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl max-w-4xl" dir={dir}>
                    <DialogHeader><DialogTitle className="text-start font-black">{isRtl ? 'إضافة خدمة فرعية' : 'New Sub-Service'}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                      <div className="space-y-4">
                        <div className="space-y-2"><Label>Code</Label><Input value={subForm.code} onChange={e => setSubForm({...subForm, code: e.target.value})} /></div>
                        <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} /></div>
                        <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={subForm.nameEn} onChange={e => setSubForm({...subForm, nameEn: e.target.value})} /></div>
                      </div>
                      <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border-2 border-dashed">
                        <div className="grid grid-cols-2 gap-4">
                           {['isBillable', 'requiresTechnicalStages', 'isActive'].map(key => (
                             <div key={key} className="flex items-center justify-between p-3 bg-white rounded-xl border text-[10px] font-bold">
                               <span>{key}</span><Switch checked={(subForm as any)[key]} onCheckedChange={val => setSubForm({...subForm, [key]: val})} />
                             </div>
                           ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveSub} disabled={loadingAction === 'sub'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'sub' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {!selectedTx ? <div className="py-20 text-center italic text-muted-foreground">{isRtl ? 'يرجى اختيار نوع معاملة' : 'Please select a type'}</div> : (
                subLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="space-y-4">
                    {subServices?.map(sub => (
                      <div key={sub.id} className="p-5 rounded-[2rem] border-2 bg-white hover:shadow-md transition-all flex items-center justify-between group">
                        <div className="text-start">
                          <div className="flex items-center gap-2">
                             <Badge variant="secondary" className="font-black text-primary bg-primary/5">{sub.order}</Badge>
                             <p className="text-base font-black">{isRtl ? sub.name : sub.nameEn}</p>
                          </div>
                          <div className="flex gap-2 mt-1">
                             {sub.isBillable && <Badge className="text-[8px] bg-emerald-50 text-emerald-600 border-emerald-100">Billable</Badge>}
                             {sub.requiresTechnicalStages && <Badge className="text-[8px] bg-blue-50 text-blue-600 border-blue-100">WBS</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <Button onClick={() => { setSelectedSub(sub); setViewMode('stages'); }} variant="outline" size="sm" className="rounded-xl font-black text-primary border-primary/20 hover:bg-primary/5 h-10 px-4">
                              <Settings2 className="h-4 w-4 me-2" /> {isRtl ? 'المراحل الفنية' : 'Work Stages'}
                           </Button>
                           <Button variant="ghost" size="icon" onClick={() => setSubForm(sub)} className="h-8 w-8 text-blue-600 opacity-0 group-hover:opacity-100"><Edit3 className="h-4 w-4" /></Button>
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
    </div>
  );
}
